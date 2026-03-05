import React, { useState, useEffect } from 'react';
import {
    ShieldAlert,
    Search,
    Calendar,
    User,
    Activity,
    Terminal,
    ArrowUpDown,
    Filter
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Skeleton from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

export default function AuditExplorer() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const toast = useToast();

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/platform/audit-logs');
            const result = await response.json();
            if (result.data) {
                setLogs(result.data);
            } else {
                throw new Error('Invalid data format');
            }
        } catch (error) {
            console.error('Failed to fetch platform audit logs:', error);
            toast.error('Could not load platform audit history.');
        } finally {
            setLoading(false);
        }
    };

    const auditTypes = [
        { label: 'All Activity', value: 'all' },
        { label: 'Security', value: 'SECURITY' },
        { label: 'Tenant Management', value: 'TENANT' },
        { label: 'Impersonation', value: 'USER_IMPERSONATION' },
        { label: 'Infrastructure', value: 'PLATFORM' }
    ];

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.adminId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.targetId?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = filterType === 'all' || log.action?.includes(filterType);

        return matchesSearch && matchesType;
    });

    const getActionBadge = (action) => {
        let color = '#64748b'; // Slate
        if (action.includes('MFA') || action.includes('IMPERSONATION')) color = '#a855f7'; // Purple
        if (action.includes('SUSPEND') || action.includes('DENY')) color = '#ef4444'; // Red
        if (action.includes('APPROVE') || action.includes('SEED')) color = '#10b981'; // Green
        if (action.includes('TENANT_PLAN')) color = '#3b82f6'; // Blue

        return (
            <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: `${color}15`,
                color: color,
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.5px'
            }}>
                {action.replace(/_/g, ' ')}
            </span>
        );
    };

    return (
        <div className="admin-page animate-fadeIn">
            <PageHeader
                title="Audit Explorer"
                subtitle="Comprehensive immutable ledger of all high-impact Super Admin actions across the platform"
                icon={<ShieldAlert size={28} color="#a855f7" />}
            />

            {/* Filter Bar */}
            <div className="platform-filter-card" style={{
                display: 'flex',
                gap: '16px',
                padding: '16px',
                background: 'white',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '24px',
                alignItems: 'center'
            }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search by Admin ID or Action..."
                        className="platform-input"
                        style={{ paddingLeft: '40px', width: '100%', height: '40px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {auditTypes.map(type => (
                        <button
                            key={type.value}
                            onClick={() => setFilterType(type.value)}
                            className={`platform-pill ${filterType === type.value ? 'active' : ''}`}
                            style={{
                                padding: '8px 16px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '20px',
                                fontSize: '13px',
                                background: filterType === type.value ? '#a855f7' : 'white',
                                color: filterType === type.value ? 'white' : '#64748b'
                            }}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ledger Table */}
            <div className="platform-table-card" style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Timestamp</th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Admin</th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Action</th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Target</th>
                            <th style={{ padding: '16px', textAlign: 'right', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Metadata</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <tr key={i}>
                                    <td colSpan="5" style={{ padding: '16px' }}><Skeleton height="40px" /></td>
                                </tr>
                            ))
                        ) : filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                                    No audit records found matching your filters.
                                </td>
                            </tr>
                        ) : (
                            filteredLogs.map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                                    <td style={{ padding: '16px', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar size={14} />
                                            {new Date(log.timestamp).toLocaleString()}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <User size={14} color="#64748b" />
                                            </div>
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{log.adminId}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>{getActionBadge(log.action)}</td>
                                    <td style={{ padding: '16px', fontSize: '13px', color: '#64748b' }}>
                                        {log.targetId ? `ID: ${log.targetId}` : 'Platform Global'}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <button className="platform-btn-mini" style={{ color: '#64748b' }}>
                                            <Terminal size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
