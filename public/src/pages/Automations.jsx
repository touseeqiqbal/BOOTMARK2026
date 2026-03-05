import { useState, useEffect } from 'react';
import { Zap, Plus, Play, Pause, Trash2, Clock, CheckCircle, AlertCircle, ExternalLink, Mail, Webhook } from 'lucide-react';
import api from '../utils/api';
import PageHeader from '../components/ui/PageHeader';
import '../styles/Reports.css'; // Reusing some reporting styles

export default function Automations() {
    const [rules, setRules] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('rules');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRule, setNewRule] = useState({
        name: '',
        event: 'workOrder.statusChanged',
        actions: [{ type: 'send_email', config: { to: 'customer.email', subject: 'Update on your service' } }]
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rulesRes, logsRes] = await Promise.all([
                api.get('/automations'),
                api.get('/automations/logs')
            ]);
            setRules(rulesRes.data);
            setLogs(logsRes.data);
        } catch (error) {
            console.error('Failed to fetch automations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRule = async () => {
        try {
            await api.post('/automations', newRule);
            setShowCreateModal(false);
            fetchData();
        } catch (error) {
            alert('Failed to create rule');
        }
    };

    const toggleRule = async (rule) => {
        try {
            await api.put(`/automations/${rule.id}`, { ...rule, enabled: !rule.enabled });
            fetchData();
        } catch (error) {
            alert('Failed to toggle rule');
        }
    };

    const deleteRule = async (id) => {
        if (!window.confirm('Are you sure you want to delete this rule?')) return;
        try {
            await api.delete(`/automations/${id}`);
            fetchData();
        } catch (error) {
            alert('Failed to delete rule');
        }
    };

    return (
        <div className="dashboard animate-fadeIn">
            <PageHeader
                title="Automation Center"
                subtitle="Smart triggers and business rules"
                actions={
                    <button className="btn-modern btn-modern-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} /> New Rule
                    </button>
                }
            />

            <div className="container">
                <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)' }}>
                    <button
                        className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rules')}
                        style={{ padding: '12px 24px', background: 'none', border: 'none', fontWeight: 700, color: activeTab === 'rules' ? 'var(--primary-600)' : 'var(--text-tertiary)', borderBottom: activeTab === 'rules' ? '2px solid var(--primary-600)' : 'none', cursor: 'pointer' }}
                    >
                        Active Rules
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('logs')}
                        style={{ padding: '12px 24px', background: 'none', border: 'none', fontWeight: 700, color: activeTab === 'logs' ? 'var(--primary-600)' : 'var(--text-tertiary)', borderBottom: activeTab === 'logs' ? '2px solid var(--primary-600)' : 'none', cursor: 'pointer' }}
                    >
                        Execution Logs
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px' }}>Loading...</div>
                ) : activeTab === 'rules' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                        {rules.map(rule => (
                            <div key={rule.id} className="modern-card" style={{ padding: '24px', opacity: rule.enabled ? 1 : 0.7 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Zap size={20} color="var(--primary-600)" />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{rule.name}</h3>
                                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{rule.event}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn-icon" onClick={() => toggleRule(rule)}>
                                            {rule.enabled ? <Pause size={18} /> : <Play size={18} />}
                                        </button>
                                        <button className="btn-icon text-error" onClick={() => deleteRule(rule.id)}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', fontSize: '14px' }}>
                                    <div style={{ fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Actions</div>
                                    {rule.actions.map((action, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {action.type === 'send_email' ? <Mail size={14} /> : <Webhook size={14} />}
                                            <span>{action.type.replace('_', ' ')}: {action.config.to || action.config.url}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="modern-card" style={{ overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ textAlign: 'left', padding: '16px' }}>Rule</th>
                                    <th style={{ textAlign: 'left', padding: '16px' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '16px' }}>Event</th>
                                    <th style={{ textAlign: 'left', padding: '16px' }}>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '16px' }}>{log.ruleId}</td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {log.status === 'success' ? <CheckCircle size={14} color="var(--success-500)" /> : <AlertCircle size={14} color="var(--error-500)" />}
                                                <span style={{ textTransform: 'capitalize' }}>{log.status}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--text-tertiary)' }}>{log.event}</td>
                                        <td style={{ padding: '16px', color: 'var(--text-tertiary)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modern-card animate-slideUp" style={{ width: '100%', maxWidth: '500px', padding: '32px' }}>
                        <h2 style={{ margin: '0 0 24px 0' }}>Create Automation Rule</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 700 }}>Rule Name</label>
                                <input
                                    className="input-modern"
                                    type="text"
                                    placeholder="e.g., Send welcome email"
                                    value={newRule.name}
                                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 700 }}>Trigger Event</label>
                                <select
                                    className="input-modern"
                                    value={newRule.event}
                                    onChange={(e) => setNewRule({ ...newRule, event: e.target.value })}
                                >
                                    <option value="workOrder.statusChanged">Work Order Status Changed</option>
                                    <option value="lead.aging">Aging Lead Alert (48h)</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                                <button className="btn-modern btn-modern-primary" onClick={handleCreateRule} style={{ flex: 1 }}>Save Rule</button>
                                <button className="btn-modern btn-modern-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
