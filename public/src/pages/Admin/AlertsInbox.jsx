import React, { useState, useEffect } from 'react';
import {
    Bell, AlertTriangle, AlertCircle, Info,
    RefreshCw, ChevronRight, CheckCircle2,
    Clock, ExternalLink, Settings, MessageSquare
} from 'lucide-react';
import api from '../../utils/api';
import PageHeader from '../../components/ui/PageHeader';

const AlertsInbox = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/platform/alerts');
            setAlerts(response.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const filteredAlerts = alerts.filter(alert =>
        filter === 'all' || alert.type === filter
    );

    const getAlertIcon = (type) => {
        switch (type) {
            case 'error': return <AlertCircle size={20} className="text-danger" />;
            case 'warning': return <AlertTriangle size={20} className="text-warning" />;
            case 'info': return <Info size={20} className="text-primary" />;
            case 'success': return <CheckCircle2 size={20} className="text-success" />;
            default: return <Bell size={20} />;
        }
    };

    return (
        <div className="alerts-inbox animate-fadeIn">
            <PageHeader
                title="System-wide Alerts"
                subtitle="Centralized status notifications and platform health monitoring"
                actions={
                    <button className="btn-modern btn-modern-primary" onClick={fetchAlerts} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Sync Real-time Status
                    </button>
                }
            />

            <div className="container">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                    <div className="alerts-list-area">
                        <div className="modern-card mb-4" style={{ padding: '8px 16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <span className="text-muted text-xs uppercase font-bold tracking-wider">Filter:</span>
                            <div className="filter-group">
                                <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
                                <button className={`filter-btn ${filter === 'error' ? 'active' : ''}`} onClick={() => setFilter('error')}>Critical</button>
                                <button className={`filter-btn ${filter === 'warning' ? 'active' : ''}`} onClick={() => setFilter('warning')}>Warnings</button>
                                <button className={`filter-btn ${filter === 'info' ? 'active' : ''}`} onClick={() => setFilter('info')}>Info</button>
                            </div>
                        </div>

                        {loading && alerts.length === 0 ? (
                            <div className="text-center p-12">Checking platform health...</div>
                        ) : filteredAlerts.length === 0 ? (
                            <div className="modern-card p-12 text-center opacity-70">
                                <CheckCircle2 size={48} className="mx-auto mb-4 text-success" />
                                <h3>System Operations Normal</h3>
                                <p className="text-secondary">No active alerts requiring administrative attention.</p>
                            </div>
                        ) : (
                            <div className="alerts-stack">
                                {filteredAlerts.map(alert => (
                                    <div key={alert.id} className={`alert-card modern-card type-${alert.type}`}>
                                        <div className="alert-icon-wrapper">
                                            {getAlertIcon(alert.type)}
                                        </div>
                                        <div className="alert-content">
                                            <div className="alert-header">
                                                <h4 className="alert-title">{alert.title}</h4>
                                                <span className="alert-time">{new Date(alert.timestamp).toLocaleString()}</span>
                                            </div>
                                            <p className="alert-message">{alert.message}</p>
                                            {alert.link && (
                                                <div className="alert-action-links">
                                                    <a href={alert.link} className="alert-link">
                                                        <ExternalLink size={14} /> View Details
                                                    </a>
                                                    <button className="alert-link text-muted">
                                                        Dismiss Alert
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="status-overview">
                        <div className="modern-card p-6 mb-4">
                            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status Summary</h4>
                            <div className="status-item">
                                <span>Ingestion API</span>
                                <span className="status-dot success">Operational</span>
                            </div>
                            <div className="status-item">
                                <span>Database Sync</span>
                                <span className="status-dot success">Operational</span>
                            </div>
                            <div className="status-item">
                                <span>Worker Threads</span>
                                <span className="status-dot active">4 Active</span>
                            </div>
                            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border-subtle)' }} />
                            <div className="status-item">
                                <span>Open Critical</span>
                                <span className="text-danger font-bold">{alerts.filter(a => a.type === 'error').length}</span>
                            </div>
                        </div>

                        <div className="modern-card p-6" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-subtle)' }}>
                            <Settings size={18} className="mb-2 text-muted" />
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Alert Preferences</h4>
                            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                                Manage how you receive platform notifications via Email, Slack, or SMS.
                            </p>
                            <button className="btn-modern btn-modern-outline btn-sm btn-block">Configure Integrations</button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .filter-group {
                    display: flex;
                    gap: 8px;
                }

                .filter-btn {
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    background: transparent;
                    font-size: 13px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .filter-btn:hover {
                    background: var(--bg-secondary);
                }

                .filter-btn.active {
                    background: var(--primary);
                    color: white;
                }

                .alerts-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .alert-card {
                    display: flex;
                    gap: 20px;
                    padding: 24px;
                    transition: transform 0.2s ease;
                }

                .alert-card:hover {
                    transform: translateX(4px);
                }

                .alert-icon-wrapper {
                    padding-top: 4px;
                }

                .alert-content {
                    flex: 1;
                }

                .alert-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 8px;
                }

                .alert-title {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .alert-time {
                    font-size: 11px;
                    color: var(--text-tertiary);
                }

                .alert-message {
                    margin: 0 0 16px 0;
                    font-size: 13px;
                    color: var(--text-secondary);
                    line-height: 1.5;
                }

                .alert-action-links {
                    display: flex;
                    gap: 20px;
                }

                .alert-link {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 12px;
                    font-weight: 500;
                    color: var(--primary);
                    text-decoration: none;
                    background: none;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                }

                .status-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 13px;
                    margin-bottom: 8px;
                }

                .status-dot {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-dot:before {
                    content: '';
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .status-dot.success:before { background: var(--success); }
                .status-dot.active:before { background: var(--primary); }

                .type-error { border-left: 4px solid var(--danger); }
                .type-warning { border-left: 4px solid var(--warning); }
                .type-info { border-left: 4px solid var(--primary); }
                .type-success { border-left: 4px solid var(--success); }
            `}</style>
        </div>
    );
};

export default AlertsInbox;
