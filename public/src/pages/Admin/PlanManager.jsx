import React, { useState, useEffect } from 'react';
import {
    Database, Zap, Shield, Crown, RefreshCw,
    CheckCircle2, AlertCircle, Save, Plus
} from 'lucide-react';
import api from '../../utils/api';
import PageHeader from '../../components/ui/PageHeader';

const PlanManager = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [message, setMessage] = useState(null);

    const fetchPlans = async () => {
        try {
            const response = await api.get('/platform/plans');
            setPlans(response.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch plans:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const handleSeed = async () => {
        if (!window.confirm('This will seed default plans (Free, Pro, Enterprise). Continue?')) return;

        setIsSeeding(true);
        setMessage({ type: 'info', text: 'Seeding default plans...' });

        try {
            await api.post('/platform/plans/seed');
            await fetchPlans();
            setMessage({ type: 'success', text: 'Default plans seeded successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to seed plans: ' + error.message });
        } finally {
            setIsSeeding(false);
        }
    };

    const getPlanIcon = (planId) => {
        switch (planId) {
            case 'free': return <Zap className="text-muted" size={24} />;
            case 'pro': return <Shield className="text-primary" size={24} />;
            case 'enterprise': return <Crown className="text-warning" size={24} />;
            default: return <Database size={24} />;
        }
    };

    return (
        <div className="plan-manager animate-fadeIn">
            <PageHeader
                title="Subscription Plans"
                subtitle="Manage global tiers, feature limits, and baseline pricing"
                actions={
                    <button
                        className="btn-modern btn-modern-primary"
                        onClick={handleSeed}
                        disabled={isSeeding}
                    >
                        <RefreshCw size={18} className={isSeeding ? 'animate-spin' : ''} />
                        {plans.length === 0 ? 'Seed Default Plans' : 'Refresh Baseline Tiers'}
                    </button>
                }
            />

            <div className="container">
                {message && (
                    <div className={`alert alert-${message.type} mb-4 flex items-center gap-2`}>
                        {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {message.text}
                    </div>
                )}

                {loading ? (
                    <div className="text-center p-12">Loading plan configurations...</div>
                ) : plans.length === 0 ? (
                    <div className="modern-card empty-state p-12 text-center">
                        <Database size={48} className="mx-auto mb-4 text-muted opacity-20" />
                        <h3>No Plans Found</h3>
                        <p className="text-secondary">Initialize the system by seeding the default baseline tiers.</p>
                        <button className="btn-modern btn-modern-primary mt-4" onClick={handleSeed}>
                            Seed Baseline Tiers
                        </button>
                    </div>
                ) : (
                    <div className="plans-grid">
                        {plans.map(plan => (
                            <div key={plan.id} className="modern-card plan-card">
                                <div className="plan-header">
                                    <div className="plan-icon-wrapper">
                                        {getPlanIcon(plan.id)}
                                    </div>
                                    <div className="plan-title-area">
                                        <h4>{plan.name}</h4>
                                        <div className="plan-price">
                                            <span className="amount">${plan.price}</span>
                                            <span className="interval">/{plan.interval}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="plan-body">
                                    <div className="limit-row">
                                        <span className="limit-label">Forms</span>
                                        <span className="limit-value">{plan.limits?.forms || 'Unlimited'}</span>
                                    </div>
                                    <div className="limit-row">
                                        <span className="limit-label">Monthly Submissions</span>
                                        <span className="limit-value">{plan.limits?.submissions || 'Unlimited'}</span>
                                    </div>
                                    <div className="limit-row">
                                        <span className="limit-label">Team Seats</span>
                                        <span className="limit-value">{plan.limits?.teamMembers || 'Unlimited'}</span>
                                    </div>

                                    <div className="features-list">
                                        <h6>Included Features:</h6>
                                        <ul>
                                            {plan.features?.map((f, i) => (
                                                <li key={i}><CheckCircle2 size={14} className="text-success" /> {f}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="plan-footer">
                                    <button className="btn-modern btn-modern-ghost btn-block" disabled>
                                        <Save size={16} /> Edit Configuration
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="modern-card add-plan-dashed">
                            <Plus size={32} />
                            <span>Add Custom Tier</span>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .plans-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 24px;
                    margin-top: 24px;
                }

                .plan-card {
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .plan-card:hover {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow-lg);
                }

                .plan-header {
                    display: flex;
                    gap: 16px;
                    align-items: center;
                    padding: 24px;
                    border-bottom: 1px solid var(--border-subtle);
                }

                .plan-icon-wrapper {
                    width: 50px;
                    height: 50px;
                    border-radius: 12px;
                    background: var(--bg-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .plan-title-area h4 {
                    margin: 0;
                    font-size: 18px;
                    color: var(--text-primary);
                }

                .plan-price {
                    display: flex;
                    align-items: baseline;
                    gap: 2px;
                }

                .amount {
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--primary);
                }

                .interval {
                    font-size: 12px;
                    color: var(--text-tertiary);
                    text-transform: uppercase;
                }

                .plan-body {
                    padding: 24px;
                    flex: 1;
                }

                .limit-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px dashed var(--border-subtle);
                }

                .limit-label {
                    font-size: 13px;
                    color: var(--text-secondary);
                }

                .limit-value {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .features-list {
                    margin-top: 20px;
                }

                .features-list h6 {
                    font-size: 12px;
                    text-transform: uppercase;
                    color: var(--text-tertiary);
                    margin-bottom: 12px;
                    letter-spacing: 0.5px;
                }

                .features-list ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .features-list li {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    color: var(--text-secondary);
                    margin-bottom: 8px;
                }

                .plan-footer {
                    padding: 16px 24px;
                    background: var(--bg-secondary);
                    border-radius: 0 0 16px 16px;
                }

                .add-plan-dashed {
                    border: 2px dashed var(--border-subtle);
                    background: transparent;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    color: var(--text-tertiary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    min-height: 400px;
                }

                .add-plan-dashed:hover {
                    color: var(--primary);
                    border-color: var(--primary);
                    background: rgba(var(--primary-rgb), 0.05);
                }

                .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 12px; border-radius: 8px; }
                .alert-success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 12px; border-radius: 8px; }
                .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 8px; }
            `}</style>
        </div>
    );
};

export default PlanManager;
