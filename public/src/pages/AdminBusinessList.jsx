import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building, Search, Users, ExternalLink, Trash2, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react'
import api from '../utils/api'
import PageHeader from '../components/ui/PageHeader'

export default function AdminBusinessList() {
    const [businesses, setBusinesses] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [actionLoading, setActionLoading] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        fetchBusinesses()
    }, [])

    const fetchBusinesses = async () => {
        try {
            setLoading(true)
            const response = await api.get('/businesses') // Reusing existing endpoint which should return all for SuperAdmins
            setBusinesses(response.data)
        } catch (error) {
            console.error('Failed to fetch businesses:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleResetBusiness = async (businessId, name) => {
        if (confirm(`CRITICAL: This will PERMANENTLY clear all functional data (Forms, Work Orders, Invoices) for "${name}". Are you sure?`)) {
            const confirmText = prompt('Type "RESET" to confirm:');
            if (confirmText !== 'RESET') return;

            try {
                setActionLoading(businessId)
                await api.post(`/admin-support/reset-business/${businessId}`, { confirm: 'RESET' })
                alert('Business data reset successfully.')
            } catch (error) {
                alert('Failed to reset business data.')
            } finally {
                setActionLoading(null)
            }
        }
    }

    const handleDeleteBusiness = async (businessId, name) => {
        if (confirm(`PERMANENTLY DELETE business "${name}" and all memberships?`)) {
            try {
                setActionLoading(businessId)
                await api.delete(`/admin-support/business/${businessId}`)
                setBusinesses(prev => prev.filter(b => b.id !== businessId))
            } catch (error) {
                alert('Failed to delete business.')
            } finally {
                setActionLoading(null)
            }
        }
    }

    const filteredBusinesses = businesses.filter(b =>
        b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.slug?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="dashboard animate-fadeIn">
            <PageHeader
                title="Super Admin: Global Businesses"
                subtitle="Support and manage all registered workspaces"
            />

            <div className="container" style={{ marginTop: '24px' }}>
                <div className="modern-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                            <input
                                type="text"
                                className="input-modern"
                                placeholder="Search by name or slug..."
                                style={{ paddingLeft: '40px' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn-modern btn-modern-secondary" onClick={fetchBusinesses}>
                            <RotateCcw size={18} /> Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '48px' }}>Loading global data...</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table-modern">
                                <thead>
                                    <tr>
                                        <th>Business Name</th>
                                        <th>URL Slug</th>
                                        <th>Owner</th>
                                        <th>Members</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBusinesses.map(bus => (
                                        <tr key={bus.id}>
                                            <td style={{ fontWeight: '800' }}>{bus.name}</td>
                                            <td><code>/{bus.slug}</code></td>
                                            <td style={{ fontSize: '12px' }}>{bus.ownerEmail || bus.ownerId}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Users size={14} /> {bus.members?.length || 0}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        className="btn btn-sm btn-outline-primary"
                                                        title="Visit Dashboard"
                                                        onClick={() => navigate(`/${bus.slug}/dashboard`)}
                                                    >
                                                        <ExternalLink size={14} />
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-warning"
                                                        title="Reset Data"
                                                        disabled={actionLoading === bus.id}
                                                        onClick={() => handleResetBusiness(bus.id, bus.name)}
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-error"
                                                        title="Delete Business"
                                                        disabled={actionLoading === bus.id}
                                                        onClick={() => handleDeleteBusiness(bus.id, bus.name)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredBusinesses.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
                                    No businesses found matching your search.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modern-card" style={{ marginTop: '24px', background: 'var(--warning-50)', border: '1px solid var(--warning-200)', padding: '20px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <ShieldCheck size={32} color="var(--warning-600)" />
                        <div>
                            <h4 style={{ margin: 0, color: 'var(--warning-800)', fontWeight: '800' }}>Super Admin Security Advisory</h4>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--warning-700)', fontWeight: '500' }}>
                                You have active "Global Access". All actions performed on business data are recorded in the system audit logs.
                                Use the "Reset Data" tool exclusively for customer onboarding support.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
