import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Users, UserCircle, ArrowRight, Info } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
export default function RolePicker() {
    const navigate = useNavigate()
    const location = useLocation()
    const { t } = useTranslation()
    const [showClientInfo, setShowClientInfo] = useState(false)

    const googleUser = location.state?.user || null
    const fromGoogle = location.state?.fromGoogle || false

    const handleChoice = (choice) => {
        switch (choice) {
            case 'business':
                navigate('/business-registration')
                break
            case 'staff':
                navigate('/accept-invite', {
                    state: { fromRolePicker: true }
                })
                break
            case 'client':
                setShowClientInfo(true)
                break
            default:
                break
        }
    }

    return (
        <div className="auth-container">
            <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                <LanguageSwitcher />
            </div>

            <div className="auth-card" style={{ maxWidth: '520px' }}>
                {googleUser && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac',
                        borderRadius: '8px', marginBottom: '24px'
                    }}>
                        {googleUser.photoURL && (
                            <img src={googleUser.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                        )}
                        <div>
                            <div style={{ fontWeight: '600', fontSize: '14px', color: '#166534' }}>
                                Signed in as {googleUser.name || googleUser.email}
                            </div>
                            <div style={{ fontSize: '12px', color: '#15803d' }}>{googleUser.email}</div>
                        </div>
                    </div>
                )}

                <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', color: '#111827' }}>
                    How do you want to use BOOTMARK?
                </h1>
                <p className="auth-subtitle" style={{ marginBottom: '28px' }}>
                    Choose your account type to get started
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Option 1: Business Owner */}
                    <button
                        onClick={() => handleChoice('business')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '16px',
                            padding: '20px', border: '2px solid #e5e7eb', borderRadius: '12px',
                            background: '#fff', cursor: 'pointer', textAlign: 'left',
                            transition: 'all 0.2s', width: '100%'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.background = '#eef2ff' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff' }}
                    >
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <Building2 size={26} color="#fff" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '16px', color: '#111827', marginBottom: '4px' }}>
                                Create a business account
                            </div>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                Owner / Admin — Manage your team, clients, and jobs
                            </div>
                        </div>
                        <ArrowRight size={20} color="#9ca3af" />
                    </button>

                    {/* Option 2: Join a Team */}
                    <button
                        onClick={() => handleChoice('staff')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '16px',
                            padding: '20px', border: '2px solid #e5e7eb', borderRadius: '12px',
                            background: '#fff', cursor: 'pointer', textAlign: 'left',
                            transition: 'all 0.2s', width: '100%'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.background = '#f0f9ff' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff' }}
                    >
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <Users size={26} color="#fff" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '16px', color: '#111827', marginBottom: '4px' }}>
                                Join a team
                            </div>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                Staff — Enter your invite code or invitation link
                            </div>
                        </div>
                        <ArrowRight size={20} color="#9ca3af" />
                    </button>

                    {/* Option 3: Client Portal */}
                    <button
                        onClick={() => handleChoice('client')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '16px',
                            padding: '20px', border: '2px solid #e5e7eb', borderRadius: '12px',
                            background: '#fff', cursor: 'pointer', textAlign: 'left',
                            transition: 'all 0.2s', width: '100%'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = '#fffbeb' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff' }}
                    >
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <UserCircle size={26} color="#fff" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '16px', color: '#111827', marginBottom: '4px' }}>
                                Access client portal
                            </div>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                Client — Invitation required from a business
                            </div>
                        </div>
                        <ArrowRight size={20} color="#9ca3af" />
                    </button>
                </div>

                {/* Client info message */}
                {showClientInfo && (
                    <div style={{
                        marginTop: '16px', padding: '16px',
                        background: '#fef3c7', border: '1px solid #fcd34d',
                        borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start'
                    }}>
                        <Info size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            <p style={{ margin: 0, fontWeight: '600', color: '#92400e', fontSize: '14px', marginBottom: '4px' }}>
                                Invitation Required
                            </p>
                            <p style={{ margin: 0, fontSize: '13px', color: '#78350f' }}>
                                To access the client portal, you need an invitation link from a business that uses BOOTMARK.
                                Please contact your service provider and ask them to send you an invitation.
                            </p>
                        </div>
                    </div>
                )}

                <p className="auth-footer" style={{ marginTop: '24px' }}>
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    )
}
