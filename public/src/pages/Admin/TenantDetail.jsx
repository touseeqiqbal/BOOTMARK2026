import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Building2, Activity, CreditCard, ShieldAlert,
    History, UserPlus, StopCircle, RefreshCw,
    ExternalLink, Mail, Phone, MapPin
} from 'lucide-react'
import api from '../../utils/api'
import PageHeader from '../../components/ui/PageHeader'

export default function TenantDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [tenant, setTenant] = useState(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview')
    const [isProcessing, setIsProcessing] = useState(false)
    const [plans, setPlans] = useState([])

    useEffect(() => {
        const fetchTenant = async () => {
            try {
                const [tenantRes, plansRes] = await Promise.all([
                    api.get(`/platform/tenants/${id}`),
                    api.get('/platform/plans')
                ])
                setTenant(tenantRes.data)
                setPlans(plansRes.data?.data || [])
            } catch (error) {
                console.error('Failed to fetch data:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchTenant()
    }, [id])

    const handleAction = async (action, data = {}) => {
        if (!window.confirm('Are you sure? This action will be audited.')) return

        setIsProcessing(true)
        try {
            const response = await api.post(`/platform/tenants/${id}/${action}`, data)

            if (action === 'impersonate' && response.data.targetUrl) {
                // For impersonation, we need a hard reload or context refresh
                window.location.href = response.data.targetUrl;
                return;
            }

            // Refresh tenant data for other actions
            const refreshRes = await api.get(`/platform/tenants/${id}`)
            setTenant(refreshRes.data)
        } catch (error) {
            if (error.response?.data?.code === 'STEP_UP_REQUIRED') {
                alert('MFA Verification required for this sensitive action. Please ensure you have configured MFA.');
                navigate('/admin/mfa-setup');
            } else {
                alert(error.response?.data?.error || 'Action failed')
            }
        } finally {
            setIsProcessing(false)
        }
    }

    const handlePlanChange = async (planId) => {
        if (!window.confirm(`Switch tenant to ${planId} plan?`)) return;
        handleAction('plan', { planId });
    }

    if (loading) return <div className="p-8 text-center">Loading tenant profile...</div>
    if (!tenant) return <div className="p-8 text-center text-danger">Tenant not found.</div>

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <Building2 size={16} /> },
        { id: 'diagnostics', label: 'Diagnostics', icon: <Activity size={16} /> },
        { id: 'billing', label: 'Billing', icon: <CreditCard size={16} /> },
        { id: 'support', label: 'Support & Tools', icon: <ShieldAlert size={16} /> }
    ]

    return (
        <div className="tenant-detail animate-fadeIn">
            <PageHeader
                title={tenant.name || 'Business Profile'}
                subtitle={`Platform Admin View • Slug: ${tenant.slug}`}
                actions={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-modern btn-modern-ghost btn-sm">
                            <ExternalLink size={16} /> Visit Site
                        </button>
                        <button
                            className={`btn-modern btn-sm ${tenant.status === 'suspended' ? 'btn-modern-success' : 'btn-modern-danger'}`}
                            onClick={() => handleAction(tenant.status === 'suspended' ? 'unsuspend' : 'suspend')}
                            disabled={isProcessing}
                        >
                            {tenant.status === 'suspended' ? 'Unsuspend' : 'Suspend Tenant'}
                        </button>
                    </div>
                }
            />

            <div className="container">
                {/* Profile Header Card */}
                <div className="modern-card profile-hero" style={{ padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div className="hero-content" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div className="tenant-avatar" style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: 'white' }}>
                            {tenant.name?.[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>{tenant.name}</h2>
                            <div className="info-chips" style={{ display: 'flex', gap: '16px' }}>
                                <span className="chip"><Mail size={14} /> {tenant.admins?.[0]?.email || 'No email'}</span>
                                <span className="chip"><Phone size={14} /> {tenant.phone || 'No phone'}</span>
                                <span className="chip"><MapPin size={14} /> {tenant.city || 'Remote'}</span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className={`status-pill ${tenant.status}`}>{tenant.status}</div>
                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginTop: '4px' }}>
                                Member since {new Date(tenant.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="tabs-strip" style={{ marginTop: '24px', display: 'flex', gap: '2px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="tab-container">
                    {activeTab === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="modern-card" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ margin: 0 }}>Product Usage</h3>
                                    <span className="badge badge-primary">{tenant.planName || 'Free'} Plan</span>
                                </div>
                                <div className="usage-meter">
                                    <div className="meter-info"><span>Stored Forms</span><span>12 / {tenant.planLimits?.forms || 2}</span></div>
                                    <div className="meter-bar"><div className="fill" style={{ width: `${Math.min(100, (12 / (tenant.planLimits?.forms || 2)) * 100)}%` }}></div></div>
                                </div>
                                <div className="usage-meter">
                                    <div className="meter-info"><span>Monthly Submissions</span><span>142 / {tenant.planLimits?.submissions || 100}</span></div>
                                    <div className="meter-bar"><div className="fill" style={{ width: `${Math.min(100, (142 / (tenant.planLimits?.submissions || 100)) * 100)}%` }}></div></div>
                                </div>
                                <div className="usage-meter">
                                    <div className="meter-info"><span>Team Members</span><span>8 / {tenant.planLimits?.teamMembers || 1}</span></div>
                                    <div className="meter-bar"><div className="fill" style={{ width: `${Math.min(100, (8 / (tenant.planLimits?.teamMembers || 1)) * 100)}%` }}></div></div>
                                </div>
                            </div>

                            <div className="modern-card" style={{ padding: '24px' }}>
                                <h3>Quick Actions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <button className="btn-modern btn-modern-ghost" style={{ justifyContent: 'flex-start' }}>
                                        <History size={18} /> Resend Welcome Email
                                    </button>
                                    <button className="btn-modern btn-modern-ghost" style={{ justifyContent: 'flex-start' }}>
                                        <UserPlus size={18} /> Add Support Admin
                                    </button>
                                    <button className="btn-modern btn-modern-ghost" style={{ justifyContent: 'flex-start' }}>
                                        <RefreshCw size={18} /> Trigger Data Sync
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="modern-card" style={{ padding: '24px' }}>
                                <h3>Subscription Plan</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
                                    Manage this tenant's access level and feature limits.
                                </p>

                                <div className="form-group" style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Active Plan</label>
                                    <select
                                        className="form-control"
                                        value={tenant.planId || 'free'}
                                        onChange={(e) => handlePlanChange(e.target.value)}
                                        disabled={isProcessing}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}
                                    >
                                        {plans.length === 0 ? (
                                            <option value="free">Free Tier</option>
                                        ) : (
                                            plans.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} (${p.price}/{p.interval})</option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <div className="plan-details" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Plan Features:</h4>
                                    <ul style={{ padding: '0 0 0 20px', margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        {(plans.find(p => p.id === (tenant.planId || 'free'))?.features || ['Basic access']).map((f, i) => (
                                            <li key={i} style={{ marginBottom: '4px' }}>{f}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="modern-card" style={{ padding: '24px' }}>
                                <h3>Payment Status</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '14px' }}>Authorize.net Sync</span>
                                        <span className="badge badge-success">Connected</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '14px' }}>Last Transaction</span>
                                        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No data found</span>
                                    </div>
                                    <button className="btn-modern btn-modern-outline btn-sm" style={{ marginTop: 'auto' }}>
                                        View Transaction Logs
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'support' && (
                        <div className="modern-card" style={{ padding: '24px' }}>
                            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid #fecaca', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                <h4 style={{ color: '#dc2626', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldAlert size={18} /> Danger Zone
                                </h4>
                                <p style={{ fontSize: '14px', color: '#7f1d1d', marginBottom: '16px' }}>
                                    These actions are highly sensitive and require step-up re-authentication.
                                    All operations are logged to the platform audit explorer.
                                </p>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        className="btn-modern btn-modern-danger btn-sm"
                                        onClick={() => handleAction('impersonate')}
                                    >
                                        Impersonate Owner
                                    </button>
                                    <button className="btn-modern btn-modern-danger btn-sm"> Reset Data Store </button>
                                    <button className="btn-modern btn-modern-outline btn-sm"> Transfer Ownership </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .info-chips { margin-top: 8px; }
                .chip { font-size: 13px; color: var(--text-tertiary); display: flex; alignItems: center; gap: 4px; }
                .status-pill { padding: 4px 12px; borderRadius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: var(--bg-secondary); }
                .status-pill.active { background: var(--success-light); color: var(--success); }
                .status-pill.suspended { background: var(--danger-light); color: var(--danger); }
                
                .tab-btn { padding: 10px 20px; border: none; background: none; color: var(--text-tertiary); font-size: 14px; font-weight: 500; cursor: pointer; display: flex; alignItems: center; gap: 8px; position: relative; }
                .tab-btn.active { color: var(--primary); }
                .tab-btn.active:after { content: ''; position: absolute; bottom: -16px; left: 0; right: 0; height: 2px; background: var(--primary); }
                
                .usage-meter { margin-bottom: 20px; }
                .meter-info { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
                .meter-bar { height: 8px; background: var(--bg-secondary); borderRadius: 4px; overflow: hidden; }
                .meter-bar .fill { height: 100%; background: var(--primary); borderRadius: 4px; transition: width 0.3s ease; }
            `}</style>
        </div>
    )
}
