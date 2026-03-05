import { useState, useEffect } from 'react'
import {
    Search, Filter, ChevronRight, MoreHorizontal,
    CheckCircle2, AlertCircle, StopCircle, Clock,
    Download, ExternalLink, ShieldAlert
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/ui/PageHeader'

export default function TenantDirectory() {
    const [tenants, setTenants] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        const fetchTenants = async () => {
            try {
                const response = await api.get('/platform/tenants')
                setTenants(response.data.data || [])
            } catch (error) {
                console.error('Failed to fetch tenants:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchTenants()
    }, [])

    const filteredTenants = tenants.filter(t => {
        const matchesSearch = t.name?.toLowerCase().includes(search.toLowerCase()) ||
            t.slug?.toLowerCase().includes(search.toLowerCase())
        const matchesFilter = filter === 'all' || t.status === filter
        return matchesSearch && matchesFilter
    })

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active': return <span className="badge badge-success"><CheckCircle2 size={12} /> Active</span>
            case 'suspended': return <span className="badge badge-danger"><StopCircle size={12} /> Suspended</span>
            case 'pending_review': return <span className="badge badge-warning"><Clock size={12} /> Pending</span>
            default: return <span className="badge badge-secondary">{status}</span>
        }
    }

    if (loading) return <div className="p-8 text-center">Loading tenant directory...</div>

    return (
        <div className="tenant-directory animate-fadeIn">
            <PageHeader
                title="Tenant Directory"
                subtitle="Manage and monitor all business accounts across the platform"
                actions={
                    <button className="btn-modern btn-modern-secondary btn-sm">
                        <Download size={16} /> Export CSV
                    </button>
                }
            />

            <div className="container">
                {/* Filters Bar */}
                <div className="modern-card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by name, slug or owner email..."
                            className="modern-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="filter-group" style={{ display: 'flex', gap: '8px' }}>
                        {['all', 'active', 'suspended', 'pending_review'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`btn-modern btn-sm ${filter === f ? 'btn-modern-primary' : 'btn-modern-ghost'}`}
                                style={{ textTransform: 'capitalize' }}
                            >
                                {f.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tenant List */}
                <div className="modern-card no-padding">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Business Name</th>
                                <th>Status</th>
                                <th>Plan</th>
                                <th>Onboarded</th>
                                <th>Sync Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTenants.length > 0 ? filteredTenants.map((tenant) => (
                                <tr key={tenant.id} onClick={() => navigate(`/admin/tenants/${tenant.id}`)} style={{ cursor: 'pointer' }}>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600 }}>{tenant.name}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{tenant.slug}.bootmark.com</span>
                                        </div>
                                    </td>
                                    <td>{getStatusBadge(tenant.status)}</td>
                                    <td>
                                        <span style={{ fontWeight: 500 }}>{tenant.plan || 'Standard'}</span>
                                    </td>
                                    <td style={{ fontSize: '13px' }}>
                                        {new Date(tenant.createdAt).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <div title="QuickBooks Sync" className={`status-dot ${tenant.qboConnected ? 'active' : 'inactive'}`}></div>
                                            <div title="SMTP Configured" className={`status-dot ${tenant.smtpVerified ? 'active' : 'inactive'}`}></div>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className="btn-modern btn-modern-ghost btn-sm">
                                            <MoreHorizontal size={18} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                                        No tenants found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .status-dot {
                    width: 8px;
                    height: 8px;
                    borderRadius: 50%;
                    background: var(--border-strong);
                }
                .status-dot.active { background: var(--success); }
                .status-dot.inactive { background: var(--border-strong); }
                .modern-table tr:hover { background: var(--bg-secondary); }
            `}</style>
        </div>
    )
}
