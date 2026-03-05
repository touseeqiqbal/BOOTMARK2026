import React, { useState, useEffect } from 'react';
import {
    History,
    Search,
    Filter,
    User,
    Activity,
    Database,
    Calendar,
    ArrowRight,
    Terminal,
    ShieldAlert
} from 'lucide-react';
import api from '../utils/api';
import PageHeader from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';

export default function AuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeResource, setActiveResource] = useState('All');
    const toast = useToast();

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/audit-history');
            setLogs(res.data || []);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            toast.error('Failed to load system activity.');
        } finally {
            setLoading(false);
        }
    };

    const resources = ['All', 'INVOICES', 'ESTIMATES', 'CUSTOMERS', 'FORMS', 'SETTINGS'];

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesResource = activeResource === 'All' || log.resource === activeResource;
        return matchesSearch && matchesResource;
    });

    const getActionColor = (action) => {
        switch (action) {
            case 'DELETE': return '#ef4444';
            case 'PUT': return '#3b82f6';
            case 'POST': return '#10b981';
            default: return '#6b7280';
        }
    };

    return (
        <div className="dashboard animate-fadeIn">
            <PageHeader
                title="Audit History"
                subtitle="Track every administrative action across your organization for full accountability"
                icon={<ShieldAlert size={28} color="var(--primary-600)" />}
            />

            <div className="container" style={{ marginTop: '32px' }}>
                {/* Filters */}
                <div style={{
                    display: 'flex',
                    gap: '24px',
                    marginBottom: '32px',
                    padding: '20px',
                    background: 'white',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                            type="text"
                            placeholder="Search by user email or action..."
                            className="input-modern"
                            style={{ paddingLeft: '44px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {resources.map(res => (
                            <button
                                key={res}
                                onClick={() => setActiveResource(res)}
                                className={`btn-modern ${activeResource === res ? 'btn-modern-primary' : 'btn-modern-secondary'}`}
                                style={{ padding: '8px 16px', fontSize: '13px' }}
                            >
                                {res}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Logs Table */}
                <div className="modern-card" style={{ overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Timestamp</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>User</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Action</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Resource</th>
                                    <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '48px', textAlign: 'center' }}>
                                            <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                            No audit logs found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="hover-row">
                                            <td style={{ padding: '16px 24px', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)' }}>
                                                    <Calendar size={14} />
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifySelf: 'center', fontSize: '12px', fontWeight: '800', justifyContent: 'center' }}>
                                                        {log.userEmail?.[0].toUpperCase()}
                                                    </div>
                                                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{log.userEmail}</div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px' }}>
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: '11px',
                                                    fontWeight: '900',
                                                    background: `${getActionColor(log.action)}15`,
                                                    color: getActionColor(log.action)
                                                }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '700' }}>
                                                {log.resource}
                                            </td>
                                            <td style={{ padding: '16px 24px' }}>
                                                <button className="btn-modern btn-modern-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                                                    <Terminal size={14} style={{ marginRight: '6px' }} /> View Payload
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
