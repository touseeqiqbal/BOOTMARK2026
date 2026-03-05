import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../utils/AuthContext'
import api from '../utils/api'
import { Shield, Smartphone, Mail, ArrowRight, X, Loader, CheckCircle } from 'lucide-react'
export default function MFAOnboarding() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, refreshUserData } = useAuth()
    const [step, setStep] = useState('intro') // 'intro', 'setup', 'verify'
    const [loading, setLoading] = useState(false)
    const [qrCode, setQrCode] = useState('')
    const [token, setToken] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const redirectPath = location.state?.redirect || '/dashboard'

    const handleInitializeTotp = async () => {
        try {
            setLoading(true)
            setError('')
            const response = await api.post('/auth/mfa/totp/setup')
            if (response.data.qrCode) {
                setQrCode(response.data.qrCode)
                setStep('setup')
            }
        } catch (err) {
            setError('Failed to initialize setup. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyTotp = async (e) => {
        e.preventDefault()
        if (token.length < 6) return

        try {
            setLoading(true)
            setError('')
            const response = await api.post('/auth/mfa/totp/verify-setup', { token })
            if (response.data.success) {
                setMessage('Security enabled successfully!')
                await refreshUserData()
                setTimeout(() => {
                    navigate(redirectPath)
                }, 2000)
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Verification failed. Please check the code.')
        } finally {
            setLoading(false)
        }
    }

    const handleSkip = async (permanent = false) => {
        try {
            setLoading(true)
            await api.post('/auth/mfa/skip', { permanent })
            navigate(redirectPath)
        } catch (err) {
            navigate(redirectPath) // Proceed anyway
        } finally {
            setLoading(false)
        }
    }

    if (message) {
        return (
            <div className="auth-container">
                <div className="auth-card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--success-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                        <CheckCircle size={48} color="var(--success-600)" />
                    </div>
                    <h1 style={{ marginBottom: '12px' }}>Account Secured</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>{message}</p>
                    <div className="loader-ring" style={{ margin: '0 auto' }}></div>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: '480px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <Shield size={32} color="var(--primary-600)" />
                    {step === 'intro' && (
                        <button
                            onClick={() => handleSkip(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600' }}
                        >
                            Skip <X size={14} />
                        </button>
                    )}
                </div>

                {step === 'intro' && (
                    <div className="animate-fadeIn">
                        <h1 style={{ marginBottom: '12px', fontSize: '28px' }}>Secure Your Account</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>
                            We recommend adding an extra layer of security to your account with Two-Factor Authentication (MFA).
                            This keeps your business data safe even if your password is compromised.
                        </p>

                        <div className="modern-card" style={{ padding: '24px', background: 'var(--bg-secondary)', marginBottom: '32px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}>
                                    <Smartphone size={20} color="var(--primary-600)" />
                                </div>
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800' }}>Authenticator App</h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '500' }}>
                                        Use Google Authenticator or Authy to get secure verification codes.
                                    </p>
                                </div>
                            </div>

                            <button
                                className="btn-modern btn-modern-primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={handleInitializeTotp}
                                disabled={loading}
                            >
                                {loading ? <Loader className="spinner" size={18} /> : 'Setup Authenticator App'}
                                {!loading && <ArrowRight size={18} style={{ marginLeft: '8px' }} />}
                            </button>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <button
                                className="btn btn-link"
                                style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '700' }}
                                onClick={() => handleSkip(true)}
                            >
                                Skip for 7 days
                            </button>
                        </div>
                    </div>
                )}

                {step === 'setup' && (
                    <div className="animate-fadeIn" style={{ textAlign: 'center' }}>
                        <h1 style={{ marginBottom: '12px', fontSize: '24px' }}>1. Scan QR Code</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                            Open your authenticator app and scan this code.
                        </p>

                        <div style={{
                            background: 'white',
                            padding: '16px',
                            display: 'inline-block',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            marginBottom: '24px',
                            boxShadow: 'var(--shadow-md)'
                        }}>
                            <img src={qrCode} alt="TOTP QR Code" style={{ width: '200px', height: '200px' }} />
                        </div>

                        <form onSubmit={handleVerifyTotp}>
                            <div className="form-group" style={{ maxWidth: '280px', margin: '0 auto 24px auto' }}>
                                <label className="label-modern" style={{ fontSize: '13px', marginBottom: '12px' }}>
                                    2. Enter 6-digit verification code
                                </label>
                                <input
                                    type="text"
                                    className="input-modern"
                                    placeholder="000 000"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '4px', fontWeight: '900', height: '60px' }}
                                    autoFocus
                                />
                                {error && <p style={{ color: 'var(--error-600)', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>{error}</p>}
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    type="button"
                                    className="btn-modern btn-modern-secondary"
                                    style={{ flex: 1 }}
                                    onClick={() => setStep('intro')}
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    className="btn-modern btn-modern-primary"
                                    style={{ flex: 2, justifyContent: 'center' }}
                                    disabled={loading || token.length < 6}
                                >
                                    {loading ? <Loader className="spinner" size={18} /> : 'Complete Setup'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
