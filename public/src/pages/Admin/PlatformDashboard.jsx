import { useState, useEffect } from 'react'
import {
    Users, Building2, TrendingUp, AlertCircle,
    ShieldCheck, Activity, Globe, Zap
} from 'lucide-react'
import api from '../../utils/api'
import PageHeader from '../../components/ui/PageHeader'

export default function PlatformDashboard() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [metricsRes, logsRes] = await Promise.all([
                    api.get('/platform/metrics'),
                    api.get('/platform/audit-logs')
                ]);
                setStats({
                    ...metricsRes.data,
                    recentLogs: logsRes.data?.data || []
                });
            } catch (error) {
                console.error('Failed to fetch platform metrics:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchStats()
    }, [])

    if (loading) return <div className="p-8 text-center">Loading platform metrics...</div>

    const cards = [
        { title: 'Monthly Revenue', value: stats?.mrr ? `$${stats.mrr.toLocaleString()}` : '$0', icon: <TrendingUp className="text-success" />, trend: 'MRR' },
        { title: 'Total Tenants', value: stats?.totalTenants || 0, icon: <Building2 className="text-primary" />, trend: stats?.planDistribution?.pro ? `${stats.planDistribution.pro} Pro` : 'Standard' },
        { title: 'Platform Users', value: stats?.totalUsers || 0, icon: <Users className="text-secondary" />, trend: 'Global' },
        { title: 'Pending Approvals', value: stats?.pendingTenants || 0, icon: <AlertCircle className="text-warning" />, trend: 'Action Required' }
    ]

    return (
        <div className="dashboard animate-fadeIn">
            <PageHeader
                title="Platform Overview"
                subtitle="Real-time performance and system-wide metrics"
            />

            <div className="container">
                {/* Stats Grid */}
                <div className="stats-grid" style={{ marginTop: '24px' }}>
                    {cards.map((card, i) => (
                        <div key={i} className="modern-card stat-card">
                            <div className="stat-icon-wrapper">
                                {card.icon}
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">{card.title}</span>
                                <h2 className="stat-value">{card.value}</h2>
                                <span className={`stat-trend ${card.trend.includes('+') ? 'positive' : 'neutral'}`}>
                                    {card.trend}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '24px' }}>
                    {/* Activity Feed */}
                    <div className="modern-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Activity size={20} /> System Activity
                            </h3>
                            <button className="btn-modern btn-modern-ghost btn-sm">View All</button>
                        </div>
                        <div className="activity-list">
                            {stats?.recentLogs && stats.recentLogs.length > 0 ? (
                                stats.recentLogs.slice(0, 5).map((log, i) => (
                                    <div key={i} className="activity-item">
                                        <div className={`activity-marker ${log.action.includes('APPROVE') ? 'success' :
                                                log.action.includes('SUSPEND') ? 'danger' :
                                                    log.action.includes('PLAN') ? 'primary' : 'info'
                                            }`}></div>
                                        <div className="activity-info">
                                            <span className="activity-text">
                                                <strong>{log.action.replace(/_/g, ' ')}</strong> - Business ID: {log.targetId}
                                            </span>
                                            <span className="activity-time">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center p-4 text-muted">No recent activity found.</div>
                            )}
                        </div>
                    </div>

                    {/* Security Status */}
                    <div className="modern-card" style={{ padding: '24px', background: 'var(--bg-secondary)' }}>
                        <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck size={20} /> Security Status
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                <span>MFA Enforcement</span>
                                <span className="badge badge-success">ACTIVE</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                <span>Platform Admins</span>
                                <span style={{ fontWeight: 600 }}>2 / 2</span>
                            </div>
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                <Globe size={18} className="text-secondary" />
                                <div>
                                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>IP Access Control</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Restricted to internal VPN ranges</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
