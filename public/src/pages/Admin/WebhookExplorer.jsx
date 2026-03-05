import React, { useState, useEffect } from 'react';
import {
    Webhook, Search, Filter, RefreshCw,
    CheckCircle2, AlertCircle, Clock, Eye,
    ChevronRight, ExternalLink, Code
} from 'lucide-react';
import api from '../../utils/api';
import PageHeader from '../../components/ui/PageHeader';

const WebhookExplorer = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await api.get('/platform/webhooks');
            setLogs(response.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch webhook logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        log.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.tenantId && log.tenantId.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getStatusIcon = (status) => {
        switch (status) {
            case 'success': return <CheckCircle2 size={16} className="text-success" />;
            case 'error': return <AlertCircle size={16} className="text-danger" />;
            case 'received': return <Clock size={16} className="text-primary" />;
            default: return <Clock size={16} className="text-muted" />;
        }
    };

    return (
        <div className="webhook-explorer animate-fadeIn">
            <PageHeader
                title="Webhook Explorer"
                subtitle="Monitor and troubleshoot external data ingestion logs"
                actions={
                    <button className="btn-modern btn-modern-ghost" onClick={fetchLogs} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh Logs
                    </button>
                }
            />

            <div className="container" style={{ display: 'grid', gridTemplateColumns: selectedLog ? '1fr 400px' : '1fr', gap: '24px' }}>
                <div className="main-content">
                    <div className="modern-card mb-4" style={{ padding: '16px' }}>
                        <div className="search-bar">
                            <Search size={18} className="text-muted" />
                            <input
                                type="text"
                                placeholder="Search by provider, ID, or tenant..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="modern-card no-padding overflow-hidden">
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>ID</th>
                                    <th>Provider</th>
                                    <th>Tenant</th>
                                    <th>Received At</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && logs.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center p-8">Loading logs...</td></tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center p-8">No matching logs found.</td></tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr
                                            key={log.id}
                                            className={selectedLog?.id === log.id ? 'active-row' : ''}
                                            onClick={() => setSelectedLog(log)}
                                        >
                                            <td>{getStatusIcon(log.status)}</td>
                                            <td className="font-mono text-xs">{log.id}</td>
                                            <td><span className="badge badge-primary">{log.provider}</span></td>
                                            <td>{log.tenantId || <span className="text-muted">-</span>}</td>
                                            <td className="text-muted">{new Date(log.receivedAt).toLocaleString()}</td>
                                            <td><ChevronRight size={16} className="text-muted" /></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {selectedLog && (
                    <div className="side-inspector animate-slideInRight">
                        <div className="modern-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div className="inspector-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h4 style={{ margin: 0 }}>Payload Inspector</h4>
                                    <button className="btn-close" onClick={() => setSelectedLog(null)}>&times;</button>
                                </div>
                                <div className="font-mono text-xs text-muted truncate">{selectedLog.id}</div>
                            </div>

                            <div className="inspector-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                                <div className="section mb-4">
                                    <h6 className="section-title"><Clock size={14} /> Basic Info</h6>
                                    <div className="info-grid">
                                        <div className="info-item"><span>Status:</span> <span className={`status-${selectedLog.status}`}>{selectedLog.status}</span></div>
                                        <div className="info-item"><span>Provider:</span> <span>{selectedLog.provider}</span></div>
                                        <div className="info-item"><span>Tenant:</span> <span>{selectedLog.tenantId || 'N/A'}</span></div>
                                    </div>
                                </div>

                                {selectedLog.errorMessage && (
                                    <div className="section mb-4">
                                        <h6 className="section-title text-danger"><AlertCircle size={14} /> Error Message</h6>
                                        <div className="error-box">{selectedLog.errorMessage}</div>
                                    </div>
                                )}

                                <div className="section mb-4">
                                    <h6 className="section-title"><Code size={14} /> Raw Payload</h6>
                                    <pre className="json-box">
                                        {JSON.stringify(selectedLog.payload, null, 2)}
                                    </pre>
                                </div>

                                <div className="section">
                                    <h6 className="section-title"><Filter size={14} /> Headers</h6>
                                    <pre className="json-box">
                                        {JSON.stringify(selectedLog.headers, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            <div className="inspector-footer" style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                <button className="btn-modern btn-modern-primary btn-block" disabled>
                                    <RefreshCw size={16} /> Re-deliver Webhook
                                </button>
                                <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '8px' }}>
                                    Manual re-delivery simulates a fresh request to the ingestion endpoint.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .search-bar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .search-bar input {
                    border: none;
                    background: transparent;
                    width: 100%;
                    font-size: 14px;
                    outline: none;
                    color: var(--text-primary);
                }

                .active-row {
                    background: rgba(var(--primary-rgb), 0.05);
                }

                .side-inspector {
                    height: calc(100vh - 200px);
                    position: sticky;
                    top: 24px;
                }

                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    text-transform: uppercase;
                    color: var(--text-tertiary);
                    margin-bottom: 8px;
                    letter-spacing: 0.5px;
                }

                .info-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .info-item {
                    display: flex;
                    justify-content: space-between;
                    font-size: 13px;
                }

                .info-item span:first-child { color: var(--text-secondary); }

                .json-box {
                    background: #1e293b;
                    color: #e2e8f0;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    overflow-x: auto;
                    max-height: 300px;
                }

                .error-box {
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    color: #991b1b;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 13px;
                }

                .status-success { color: var(--success); font-weight: 600; text-transform: uppercase; }
                .status-error { color: var(--danger); font-weight: 600; text-transform: uppercase; }
                .status-received { color: var(--primary); font-weight: 600; text-transform: uppercase; }

                .btn-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--text-tertiary);
                }

                .truncate {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
            `}</style>
        </div>
    );
};

export default WebhookExplorer;
