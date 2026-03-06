import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../utils/AuthContext'
import { Mail, CheckCircle, AlertCircle } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { validatePassword, getPasswordStrength } from '../utils/formValidation'
import logo from '../assets/logo.png'
export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerificationMessage, setShowVerificationMessage] = useState(false)
  const { register, loginWithGoogle } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // Check if redirected from login with email
  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email)
    }
    if (location.state?.message) {
      setInfo(location.state.message)
      // Clear the state
      window.history.replaceState({}, document.title)
      // Clear info message after 8 seconds
      setTimeout(() => setInfo(''), 8000)
    }
  }, [location])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate password
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const result = await register(email, password, name)
      // Show verification message
      setShowVerificationMessage(true)
      // Wait a moment to show the message, then redirect to business registration
      setTimeout(() => {
        navigate('/business-registration')
      }, 3000)
    } catch (err) {
      setError(err.message || err.code || t('common.error'))
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await loginWithGoogle()

      // If user already exists, they should log in instead
      if (result.exists && !result.isNewUser) {
        setError('An account with this email already exists. Please sign in instead.')
        setLoading(false)
        return
      }

      // New user → go to business registration
      navigate('/business-registration')
      setLoading(false)
    } catch (err) {
      setError(err.message || 'Google signup failed')
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
        <h1>Create your Business Account</h1>
        <p className="auth-subtitle">Start managing your field service business with BOOTMARK</p>

        {error && <div className="error-message">{error}</div>}

        {info && (
          <div style={{
            padding: '16px',
            backgroundColor: '#eff6ff',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertCircle size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#1e3a8a' }}>
                {info}
              </p>
            </div>
          </div>
        )}

        {showVerificationMessage && (
          <div style={{
            padding: '16px',
            backgroundColor: '#eff6ff',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <Mail size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: '600', color: '#1e40af', marginBottom: '4px' }}>
                {t('auth.verificationEmailSent')}
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#1e3a8a' }}>
                We've sent a verification email to <strong>{email}</strong>. Please check your inbox.
              </p>
            </div>
          </div>
        )}

        {!showVerificationMessage && (
          <>
            <form onSubmit={handleSubmit} autoComplete="on">
              <div className="form-group">
                <label htmlFor="register-name">{t('common.name')}</label>
                <input
                  id="register-name"
                  name="name"
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="register-email">{t('auth.email')}</label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="register-password">{t('auth.password')}</label>
                <input
                  id="register-password"
                  name="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters with uppercase, lowercase, and number"
                />
                {password && (
                  <div style={{ marginTop: '8px' }}>
                    {(() => {
                      const strength = getPasswordStrength(password)
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            flex: 1,
                            height: '4px',
                            background: '#e5e7eb',
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${(strength.strength / 6) * 100}%`,
                              height: '100%',
                              background: strength.color,
                              transition: 'all 0.3s'
                            }} />
                          </div>
                          <span style={{ fontSize: '12px', color: strength.color, fontWeight: '500' }}>
                            {strength.label}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                )}
                <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  Must be at least 8 characters with uppercase, lowercase, and number
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="register-confirm-password">Confirm Password</label>
                <input
                  id="register-confirm-password"
                  name="confirm-password"
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Re-enter your password"
                />
                {confirmPassword && password !== confirmPassword && (
                  <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Passwords do not match
                  </span>
                )}
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? t('common.loading') : 'Create Business Account'}
              </button>
            </form>


          </>
        )}

        <p className="auth-footer">
          {showVerificationMessage ? (
            <span>Redirecting...</span>
          ) : (
            <>{t('auth.alreadyHaveAccount')} <Link to="/login">{t('auth.login')}</Link></>
          )}
        </p>
      </div>
    </div>
  )
}
