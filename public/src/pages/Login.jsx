import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../utils/AuthContext'
import api from '../utils/api'
import { AlertCircle, Mail, CheckCircle } from 'lucide-react'
import logo from '../assets/logo.svg'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { validateEmail, validateRequired } from '../utils/formValidation'
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerificationWarning, setShowVerificationWarning] = useState(false)

  // Form validation state
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const { login, user, loading: authLoading, sendVerificationEmail } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // Check for success message from password reset
  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message)
      window.history.replaceState({}, document.title)
      setTimeout(() => setSuccess(''), 5000)
    }
  }, [location])

  // Check if user is already logged in
  useEffect(() => {
    if (location.pathname === '/login' && !authLoading && user) {
      const searchParams = new URLSearchParams(location.search)
      const redirect = searchParams.get('redirect')
      const defaultPath = user.role === 'client' ? '/client/dashboard' : '/dashboard'
      const redirectPath = redirect && redirect.startsWith('/') ? redirect : defaultPath
      setTimeout(() => {
        navigate(redirectPath, { replace: true })
      }, 100)
    }
  }, [user, authLoading, location.pathname, location.search, navigate])

  const getRedirectByRole = (role) => {
    const searchParams = new URLSearchParams(location.search)
    const redirect = searchParams.get('redirect')
    if (redirect && redirect.startsWith('/')) return redirect
    return role === 'client' ? '/client/dashboard' : '/dashboard'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Check if user exists first
      try {
        const checkResponse = await api.post('/auth/check-user', { email })
        if (!checkResponse.data.exists) {
          setLoading(false)
          navigate('/register', {
            state: { email: email, message: t('auth.userNotFound') }
          })
          return
        }
      } catch (checkError) {
        console.warn('User check endpoint not available:', checkError)
      }

      // 2. Perform Login
      const result = await login(email, password)

      // 3. Check 2FA
      if (result.requires2FA) {
        localStorage.setItem('2fa_temp_token', result.token)
        localStorage.setItem('2fa_user_email', result.user.email)
        navigate('/verify-2fa', {
          state: { email: result.user.email, redirect: '/dashboard' }
        })
        setLoading(false)
        return
      }

      // 4. Check Email Verification
      if (result.user && !result.user.emailVerified) {
        setShowVerificationWarning(true)
      }

      // 5. Fetch Account Details & Auto-route by role
      try {
        const accountResponse = await api.get('/auth/account')
        const accountRole = accountResponse.data?.role || 'user'
        const accountStatus = accountResponse.data?.accountStatus

        // Check Account Status — super admins bypass this gate entirely
        const isSuperAdmin = accountResponse.data?.isSuperAdmin
        if (isSuperAdmin) {
          setTimeout(() => { navigate('/admin/dashboard') }, 200)
          setLoading(false)
          return
        }
        if (accountStatus && accountStatus !== 'active') {
          navigate('/account-review')
          setLoading(false)
          return
        }

        // Auto-route by detected role
        const redirectPath = getRedirectByRole(accountRole)

        // 6. MFA Onboarding Check
        const mfaSetupSkippedUntil = accountResponse.data?.mfaSetupSkippedUntil;
        const isMfaSkipped = mfaSetupSkippedUntil && new Date(mfaSetupSkippedUntil) > new Date();

        if (!accountResponse.data?.twoFactorEnabled && !isMfaSkipped) {
          setTimeout(() => { navigate('/mfa-onboarding', { state: { redirect: redirectPath } }) }, 200)
        } else {
          setTimeout(() => { navigate(redirectPath) }, 200)
        }
      } catch (accountError) {
        if (accountError.response?.data?.error === '2fa_required' || accountError.response?.data?.error === 'mfa_required') {
          // The account endpoint recognized the user needs 2FA
          const tempToken = await auth.currentUser?.getIdToken() || result?.token;
          if (tempToken) {
            localStorage.setItem('2fa_temp_token', tempToken);
            localStorage.setItem('2fa_user_email', email);
          }
          navigate('/verify-2fa', { state: { email, redirect: getRedirectByRole('user') } });
          setLoading(false);
          return;
        }

        console.warn('Failed to check account details:', accountError)
        // Fallback: go to dashboard
        setTimeout(() => { navigate('/dashboard') }, 200)
      }

    } catch (err) {
      const code = err.code || ''
      const msg = err.message || ''

      // Redirect to register if user not found
      if (code === 'auth/user-not-found' || msg.toLowerCase().includes('user not found')) {
        setLoading(false)
        navigate('/register', {
          state: { email: email, message: t('auth.userNotFound') }
        })
        return
      }

      // Map Firebase error codes to friendly messages
      const friendlyErrors = {
        'auth/invalid-credential': 'Incorrect email or password. Please try again.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/too-many-requests': 'Too many failed attempts. Please wait a moment and try again.',
        'auth/user-disabled': 'This account has been disabled. Please contact support.',
        'auth/network-request-failed': 'Network error. Please check your connection and try again.',
        'auth/invalid-email': 'Please enter a valid email address.',
      }

      setError(friendlyErrors[code] || t('auth.loginFailed'))
      setLoading(false)
    }
  }



  return (
    <div className="auth-container">
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <LanguageSwitcher />
      </div>


      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <img src={logo} alt="Bootmark" style={{ height: '64px', objectFit: 'contain' }} />
        </div>
        <h1>{t('auth.signInTitle')}</h1>
        <p className="auth-subtitle">{t('auth.signInSubtitle')}</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>{success}</div>}

        {showVerificationWarning && (
          <div style={{
            padding: '16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertCircle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                {t('auth.emailNotVerified')}
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#78350f', marginBottom: '8px' }}>
                {t('auth.emailNotVerifiedMessage')}
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    await sendVerificationEmail()
                    setSuccess(t('auth.verificationEmailSent'))
                    setTimeout(() => setSuccess(''), 5000)
                  } catch (err) {
                    setError(err.message || 'Failed to send verification email')
                  }
                }}
                style={{ marginTop: '8px' }}
              >
                <Mail size={14} />
                {t('auth.resendVerificationEmail')}
              </button>
            </div>
          </div>
        )}


        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="form-group">
            <label htmlFor="email">
              {t('auth.email')} <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="email"
                name="email"
                type="email"
                className={`input ${emailError ? 'input-error' : emailTouched && !emailError ? 'input-success' : ''}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailTouched) {
                    const error = validateEmail(e.target.value) || validateRequired(e.target.value, 'Email')
                    setEmailError(error || '')
                  }
                }}
                onBlur={() => {
                  setEmailTouched(true)
                  const error = validateEmail(email) || validateRequired(email, 'Email')
                  setEmailError(error || '')
                }}
                autoComplete="email"
                required
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
              />
              {emailTouched && !emailError && email && (
                <CheckCircle size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-success)' }} aria-hidden="true" />
              )}
            </div>
            {emailError && (
              <span id="email-error" className="field-error" role="alert">
                {emailError}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">
              {t('auth.password')} <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                name="password"
                type="password"
                className={`input ${passwordError ? 'input-error' : passwordTouched && !passwordError ? 'input-success' : ''}`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordTouched) {
                    const error = validateRequired(e.target.value, 'Password')
                    setPasswordError(error || '')
                  }
                }}
                onBlur={() => {
                  setPasswordTouched(true)
                  const error = validateRequired(password, 'Password')
                  setPasswordError(error || '')
                }}
                inputMode="text"
                autoComplete="current-password"
                required
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
              />
              {passwordTouched && !passwordError && password && (
                <CheckCircle size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-success)' }} aria-hidden="true" />
              )}
            </div>
            {passwordError && (
              <span id="password-error" className="field-error" role="alert">
                {passwordError}
              </span>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>



        <p className="auth-footer">
          <Link to="/forgot-password" style={{ display: 'block', marginBottom: '10px', color: '#4f46e5' }}>
            {t('auth.forgotPassword')}
          </Link>
          {t('auth.dontHaveAccount')} <Link to="/register">{t('auth.register')}</Link>
        </p>
      </div>
    </div>
  )
}

