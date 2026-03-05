import { useState, useEffect } from 'react'
import { ShieldCheck, Key, Copy, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react'
import api from '../../utils/api'
import PageHeader from '../../components/ui/PageHeader'

export default function MFASetup() {
    const [mfaData, setMfaData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [token, setToken] = useState('')
    const [verifying, setVerifying] = useState(false)
    const [step, setStep] = useState(1) // 1: QR, 2: Verify, 3: Success

    useEffect(() => {
        const fetchMFA = async () => {
            try {
                const response = await api.get('/platform/auth/mfa/setup')
                setMfaData(response.data)
            } catch (error) {
                console.error('Failed to initiate MFA setup:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchMFA()
    }, [])

    const handleVerify = async (e) => {
        e.preventDefault()
        setVerifying(true)
        try {
            const response = await api.post('/platform/auth/mfa/verify', { token })
            if (response.data.success) {
                setStep(3)
            }
        } catch (error) {
            alert('Invalid verification code. Please try again.')
        } finally {
            setVerifying(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-primary">Initializing secure environment...</div>

    return (
        <div className="mfa-setup-page animate-fadeIn">
            <PageHeader
                title="Super Admin Security"
                subtitle="Multi-Factor Authentication (MFA) Enrollment"
            />

            <div className="container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div className="modern-card" style={{ padding: '32px' }}>
                    {step === 1 && (
                        <div className="setup-step text-center">
                            <div className="icon-badge primary" style={{ margin: '0 auto 20px' }}>
                                <ShieldCheck size={32} />
                            </div>
                            <h3>Protect Your Control Account</h3>
                            <p style={{ color: 'var(--text-tertiary)', marginBottom: '24px' }}>
                                Use an authenticator app (like Google Authenticator or 1Password) to scan the QR code below.
                            </p>

                            <div className="qr-wrapper" style={{ border: '2px solid var(--border-subtle)', padding: '16px', borderRadius: '16px', display: 'inline-block', background: 'white' }}>
                                <img src={mfaData?.qrCodeUrl} alt="MFA QR Code" style={{ width: '200px', height: '200px' }} />
                            </div>

                            <div className="manual-secret" style={{ marginTop: '24px', textAlign: 'left' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>OR ENTER MANUALLY</span>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                    <code style={{ flex: 1, padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '14px' }}>
                                        {mfaData?.secret}
                                    </code>
                                    <button className="btn-modern btn-modern-ghost btn-sm" onClick={() => navigator.clipboard.writeText(mfaData?.secret)}>
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>

                            <button className="btn-modern btn-modern-primary" style={{ width: '100%', marginTop: '32px' }} onClick={() => setStep(2)}>
                                I've scanned the code <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <form className="setup-step text-center" onSubmit={handleVerify}>
                            <div className="icon-badge warning" style={{ margin: '0 auto 20px' }}>
                                <Key size={32} />
                            </div>
                            <h3>Verify Setup</h3>
                            <p style={{ color: 'var(--text-tertiary)', marginBottom: '24px' }}>
                                Enter the 6-digit code from your authenticator app to complete enrollment.
                            </p>

                            <input
                                type="text"
                                placeholder="000 000"
                                maxLength="6"
                                className="modern-input text-center"
                                style={{ fontSize: '24px', letterSpacing: '8px', maxWidth: '240px' }}
                                value={token}
                                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                                required
                                autoFocus
                            />

                            <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                                <button type="button" className="btn-modern btn-modern-ghost flex-1" onClick={() => setStep(1)}>Back</button>
                                <button type="submit" className="btn-modern btn-modern-primary flex-1" disabled={verifying}>
                                    {verifying ? 'Verifying...' : 'Complete Setup'}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <div className="setup-step text-center animate-bounceIn">
                            <div className="icon-badge success" style={{ margin: '0 auto 20px' }}>
                                <CheckCircle2 size={32} />
                            </div>
                            <h3>Enrollment Complete</h3>
                            <p style={{ color: 'var(--text-tertiary)', marginBottom: '32px' }}>
                                MFA is now active for your Super Admin account. You will be prompted for codes during sensitive operations.
                            </p>

                            <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '16px', borderRadius: '12px', textAlign: 'left', marginBottom: '32px' }}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertTriangle size={16} className="text-warning" /> Security Policy
                                </h4>
                                <ul style={{ fontSize: '13px', margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                                    <li>Step-up re-authentication required every 5 minutes for support tools.</li>
                                    <li>Logs will reflect if mfa_verified was active during actions.</li>
                                </ul>
                            </div>

                            <button className="btn-modern btn-modern-primary" style={{ width: '100%' }} onClick={() => navigate('/admin/dashboard')}>
                                Return to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .icon-badge {
                    width: 64px; height: 64px; borderRadius: 50%;
                    display: flex; alignItems: center; justifyContent: center;
                }
                .icon-badge.primary { background: var(--primary-light); color: var(--primary); }
                .icon-badge.warning { background: var(--warning-light); color: var(--warning); }
                .icon-badge.success { background: var(--success-light); color: var(--success); }
                
                @keyframes bounceIn {
                    0% { transform: scale(0.9); opacity: 0; }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-bounceIn { animation: bounceIn 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
            `}</style>
        </div>
    )
}
