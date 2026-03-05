import React, { useState, useEffect } from 'react';
import {
    ShoppingBag,
    Search,
    Download,
    CheckCircle,
    Star,
    Zap,
    FileText,
    LayoutGrid,
    ArrowRight,
    Puzzle
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/ui/Toast';
import PageHeader from '../components/ui/PageHeader';

export default function Marketplace() {
    const [templates, setTemplates] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [installing, setInstalling] = useState(null);
    const [installedIds, setInstalledIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const res = await api.get('/marketplace/templates');
            setTemplates(res.data || []);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    };

    const categories = ['All', 'Sales', 'Operations', 'CRM', 'Finance'];

    const filteredTemplates = templates.filter(tpl => {
        const matchesSearch = tpl.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tpl.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'All' || tpl.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const handleInstall = async (template) => {
        setInstalling(template.id);
        try {
            await api.post('/marketplace/install', { templateId: template.id });
            setInstalledIds(prev => [...prev, template.id]);
            toast.success(`${template.name} installed successfully!`);
        } catch (error) {
            console.error('Installation failed:', error);
            toast.error('Failed to install template.');
        } finally {
            setInstalling(null);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'workflow': return LayoutGrid;
            case 'automation': return Zap;
            case 'form':
            default: return FileText;
        }
    };

    const getColor = (category) => {
        switch (category) {
            case 'Sales': return '#4f46e5';
            case 'Operations': return '#10b981';
            case 'CRM': return '#f59e0b';
            case 'Finance': return '#8b5cf6';
            default: return '#6366f1';
        }
    };

    return (
        <div className="dashboard animate-fadeIn">
            <PageHeader
                title="BOOTMARK Marketplace"
                subtitle="Discover and install high-performance templates for your landscaping business"
                actions={
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn-modern btn-modern-secondary">
                            <Puzzle size={18} /> My Assets
                        </button>
                    </div>
                }
            />

            <div className="container" style={{ marginTop: '32px' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                    marginBottom: '40px',
                    padding: '24px',
                    background: 'white',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ position: 'relative', maxWidth: '600px', width: '100%' }}>
                        <Search size={20} style={{
                            position: 'absolute',
                            left: '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-tertiary)'
                        }} />
                        <input
                            type="text"
                            placeholder="Find templates, workflows, or automations..."
                            className="input-modern"
                            style={{ paddingLeft: '48px', fontSize: '16px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`btn-modern ${activeCategory === cat ? 'btn-modern-primary' : 'btn-modern-secondary'}`}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: '14px',
                                    fontWeight: '700'
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <div className="loading-spinner"></div>
                        <p style={{ marginTop: '16px', color: 'var(--text-tertiary)' }}>Loading Marketplace...</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '24px'
                    }}>
                        {filteredTemplates.map(tpl => {
                            const Icon = getIcon(tpl.type);
                            const color = getColor(tpl.category);
                            return (
                                <div key={tpl.id} className="modern-card animate-fadeIn" style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    cursor: 'default'
                                }}>
                                    <div style={{ padding: '24px', flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: 'var(--radius-md)',
                                                background: `${color}15`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Icon size={24} color={color} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fef3c7', padding: '4px 10px', borderRadius: 'var(--radius-full)', height: '28px' }}>
                                                <Star size={14} color="#d97706" fill="#d97706" />
                                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#92400e' }}>4.9</span>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: '900', color: color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {tpl.type}
                                        </div>
                                        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>
                                            {tpl.name}
                                        </h3>
                                        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: 0, lineHeight: '1.6' }}>
                                            {tpl.description}
                                        </p>
                                    </div>

                                    <div style={{
                                        padding: '20px 24px',
                                        background: 'var(--bg-secondary)',
                                        borderTop: '1px solid var(--border-color)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                                            Official Template
                                        </div>
                                        <button
                                            className={`btn-modern ${installedIds.includes(tpl.id) ? 'btn-modern-success' : 'btn-modern-primary'}`}
                                            onClick={() => handleInstall(tpl)}
                                            disabled={installing === tpl.id || installedIds.includes(tpl.id)}
                                            style={{
                                                padding: '8px 16px',
                                                fontSize: '13px',
                                                minWidth: '100px'
                                            }}
                                        >
                                            {installing === tpl.id ? (
                                                'Installing...'
                                            ) : installedIds.includes(tpl.id) ? (
                                                <><CheckCircle size={14} style={{ marginRight: '6px' }} /> Installed</>
                                            ) : (
                                                <><Download size={14} style={{ marginRight: '6px' }} /> Install</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!loading && filteredTemplates.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                        <div style={{ width: '80px', height: '80px', background: 'var(--bg-secondary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Search size={32} color="var(--text-tertiary)" />
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>No templates found</h3>
                        <p style={{ color: 'var(--text-tertiary)' }}>Try adjusting your search or filters to find what you're looking for.</p>
                    </div>
                )}

                <div style={{
                    marginTop: '64px',
                    padding: '32px',
                    background: 'linear-gradient(135deg, #4f46e5, #764ba2)',
                    borderRadius: 'var(--radius-xl)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '24px'
                }}>
                    <div style={{ maxWidth: '600px' }}>
                        <h3 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 12px 0' }}>Request a Custom Template</h3>
                        <p style={{ margin: 0, opacity: 0.9, lineHeight: '1.6' }}>
                            Need a specific workflow for your region or specialized landscaping service?
                            Our team of experts can build a custom template tailored to your needs.
                        </p>
                    </div>
                    <button className="btn-modern" style={{
                        background: 'white',
                        color: 'var(--primary-600)',
                        padding: '12px 32px',
                        border: 'none',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        Get in Touch <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
