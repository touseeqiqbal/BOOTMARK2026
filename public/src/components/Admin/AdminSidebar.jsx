import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
    LayoutDashboard,
    Building2,
    ShieldCheck,
    Activity,
    Users,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Lock,
    Key,
    Database,
    Zap,
    Webhook,
    CreditCard,
    Bell
} from 'lucide-react'
import { useAuth } from '../../utils/AuthContext'
import logo from '../../assets/logo.jpeg'

export default function AdminSidebar() {
    const [collapsed, setCollapsed] = useState(false)
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const menuItems = [
        { icon: LayoutDashboard, label: 'Platform Overview', path: '/admin/dashboard' },
        { icon: Building2, label: 'Tenants Directory', path: '/admin/tenants' },
        { icon: Lock, label: 'Approve & Onboard', path: '/admin/approvals' },
        { icon: ShieldCheck, label: 'Audit Explorer', path: '/admin/audit-logs' },
        { icon: Database, label: 'Plan Manager', path: '/admin/plans' },
        { icon: Webhook, label: 'Webhook Explorer', path: '/admin/webhooks' },
        { icon: CreditCard, label: 'Billing Ledger', path: '/admin/billing' },
        { icon: Bell, label: 'System Alerts', path: '/admin/alerts' },
        { icon: Activity, label: 'System Health', path: '/admin/system-health' },
    ]

    const isActive = (path) => location.pathname === path

    return (
        <div className="modern-layout admin-mode">
            <aside className={`modern-sidebar ${collapsed ? 'collapsed' : ''}`} style={{ background: '#0f172a' }}>
                <div className="sidebar-content-wrapper">
                    {/* Admin Branding */}
                    <div className="sidebar-logo">
                        <img src={logo} alt="BOOTMARK" className="logo-image" style={{ filter: 'grayscale(1) brightness(2)' }} />
                        {!collapsed && (
                            <div className="logo-text">
                                <h1 className="logo-title" style={{ color: '#f8fafc' }}>ADMIN</h1>
                                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform Control</span>
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="sidebar-nav" style={{ flex: 1, marginTop: '20px' }}>
                        {menuItems.map((item, idx) => {
                            const Icon = item.icon
                            const active = isActive(item.path)
                            return (
                                <button
                                    key={idx}
                                    onClick={() => navigate(item.path)}
                                    className={`nav-item ${active ? 'active' : ''}`}
                                    style={{
                                        color: active ? '#38bdf8' : '#94a3b8',
                                        background: active ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                                        margin: '4px 8px',
                                        borderRadius: '8px'
                                    }}
                                >
                                    <Icon size={20} />
                                    {!collapsed && <span className="nav-label" style={{ fontWeight: active ? 600 : 400 }}>{item.label}</span>}
                                    {active && <div className="nav-indicator" style={{ background: '#38bdf8' }} />}
                                </button>
                            )
                        })}

                        <div style={{ margin: '20px 16px 10px', fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>
                            {!collapsed && 'Security'}
                        </div>

                        <button
                            onClick={() => navigate('/admin/mfa-setup')}
                            className="nav-item"
                            style={{ color: '#94a3b8', margin: '4px 8px' }}
                        >
                            <Key size={20} />
                            {!collapsed && <span className="nav-label">MFA Settings</span>}
                        </button>
                    </nav>

                    {/* Footer */}
                    <div className="sidebar-footer" style={{ borderTop: '1px solid #1e293b' }}>
                        <div className="sidebar-profile" style={{ marginBottom: '16px' }}>
                            <div className="profile-avatar" style={{ background: '#1e293b' }}>
                                <ShieldCheck size={20} className="text-primary" />
                            </div>
                            {!collapsed && (
                                <div className="profile-info">
                                    <p className="profile-name" style={{ color: '#f8fafc' }}>Super Admin</p>
                                    <p className="profile-role" style={{ color: '#64748b' }}>Platform Owner</p>
                                </div>
                            )}
                        </div>

                        <button
                            className="logout-button"
                            onClick={logout}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}
                        >
                            <LogOut size={20} />
                            {!collapsed && <span>Exit Panel</span>}
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="sidebar-toggle"
                    style={{ background: '#1e293b', color: '#f8fafc' }}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </aside>

            <main className={`modern-content ${collapsed ? 'expanded' : ''}`} style={{ background: '#f1f5f9' }}>
                <Outlet />
            </main>
        </div>
    )
}
