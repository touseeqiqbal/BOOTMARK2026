import React, { useState, useEffect } from 'react';
import {
    CreditCard, Search, Filter, RefreshCw,
    CheckCircle2, AlertCircle, Calendar,
    ChevronRight, ExternalLink, Download,
    TrendingUp, TrendingDown, Landmark
} from 'lucide-react';
import api from '../../utils/api';
import PageHeader from '../../components/ui/PageHeader';

const BillingHistory = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const response = await api.get('/platform/billing/transactions');
            setTransactions(response.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const filteredTransactions = transactions.filter(tx => {
        const matchesSearch =
            tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (tx.transactionId && tx.transactionId.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (tx.error && tx.error.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status) => {
        switch (status) {
            case 'success': return <span className="badge badge-success">Success</span>;
            case 'failed': return <span className="badge badge-danger">Failed</span>;
            case 'processing': return <span className="badge badge-primary">Processing</span>;
            default: return <span className="badge">{status}</span>;
        }
    };

    const stats = {
        total: transactions.length,
        successful: transactions.filter(t => t.status === 'success').length,
        failed: transactions.filter(t => t.status === 'failed').length,
        processing: transactions.filter(t => t.status === 'processing').length
    };

    return (
        <div className="billing-history animate-fadeIn">
            <PageHeader
                title="Platform Billing Ledger"
                subtitle="Centralized transaction history and payment performance across all business nodes"
                actions={
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn-modern btn-modern-outline" disabled>
                            <Download size={18} /> Export CSV
                        </button>
                        <button className="btn-modern btn-modern-primary" onClick={fetchTransactions} disabled={loading}>
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            Sync Ledger
                        </button>
                    </div>
                }
            />

            <div className="container">
                {/* Stats Summary */}
                <div className="stats-grid mb-6">
                    <div className="modern-card p-6 flex items-center gap-4">
                        <div className="stat-icon-wrapper bg-soft-primary"><Landmark size={20} className="text-primary" /></div>
                        <div><div className="text-xs text-muted uppercase font-bold">Total Attempts</div><div className="text-xl font-bold">{stats.total}</div></div>
                    </div>
                    <div className="modern-card p-6 flex items-center gap-4">
                        <div className="stat-icon-wrapper bg-soft-success"><TrendingUp size={20} className="text-success" /></div>
                        <div><div className="text-xs text-muted uppercase font-bold">Successful</div><div className="text-xl font-bold">{stats.successful}</div></div>
                    </div>
                    <div className="modern-card p-6 flex items-center gap-4">
                        <div className="stat-icon-wrapper bg-soft-danger"><TrendingDown size={20} className="text-danger" /></div>
                        <div><div className="text-xs text-muted uppercase font-bold">Failed</div><div className="text-xl font-bold">{stats.failed}</div></div>
                    </div>
                    <div className="modern-card p-6 flex items-center gap-4">
                        <div className="stat-icon-wrapper bg-soft-info"><RefreshCw size={20} className="text-primary" /></div>
                        <div><div className="text-xs text-muted uppercase font-bold">In Progress</div><div className="text-xl font-bold">{stats.processing}</div></div>
                    </div>
                </div>

                <div className="modern-card p-4 mb-6 flex justify-between items-center gap-4">
                    <div className="search-bar flex-1" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Search size={18} className="text-muted" />
                        <input
                            type="text"
                            placeholder="Search by ID, Transaction, or Error..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
                        />
                    </div>
                    <div className="filter-group" style={{ display: 'flex', gap: '8px' }}>
                        <button className={`btn-sm btn-modern ${statusFilter === 'all' ? 'btn-modern-primary' : 'btn-modern-outline'}`} onClick={() => setStatusFilter('all')}>All</button>
                        <button className={`btn-sm btn-modern ${statusFilter === 'success' ? 'btn-modern-primary' : 'btn-modern-outline'}`} onClick={() => setStatusFilter('success')}>Success</button>
                        <button className={`btn-sm btn-modern ${statusFilter === 'failed' ? 'btn-modern-primary' : 'btn-modern-outline'}`} onClick={() => setStatusFilter('failed')}>Failed</button>
                    </div>
                </div>

                <div className="modern-card no-padding overflow-hidden">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Transaction ID</th>
                                <th>Attempt ID</th>
                                <th>Date</th>
                                <th>Error Details</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && transactions.length === 0 ? (
                                <tr><td colSpan="6" className="text-center p-8">Loading billing data...</td></tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr><td colSpan="6" className="text-center p-8">No transactions found matching your criteria.</td></tr>
                            ) : (
                                filteredTransactions.map(tx => (
                                    <tr key={tx.id}>
                                        <td>{getStatusBadge(tx.status)}</td>
                                        <td className="font-mono text-xs">{tx.transactionId || <span className="text-muted">N/A</span>}</td>
                                        <td className="font-mono text-xs text-muted">{tx.id}</td>
                                        <td className="text-sm font-medium">{new Date(tx.createdAt || tx.completedAt || tx.failedAt).toLocaleString()}</td>
                                        <td className="text-xs text-danger max-w-xs truncate">{tx.error || '-'}</td>
                                        <td className="text-right">
                                            <button className="btn-icon">
                                                <ExternalLink size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .bg-soft-primary { background: rgba(var(--primary-rgb), 0.1); }
                .bg-soft-success { background: rgba(34, 197, 94, 0.1); }
                .bg-soft-danger { background: rgba(239, 68, 68, 0.1); }
                .bg-soft-info { background: rgba(59, 130, 246, 0.1); }
                
                .modern-table td { padding: 16px; vertical-align: middle; }
                .max-w-xs { max-width: 250px; }
            `}</style>
        </div>
    );
};

export default BillingHistory;
