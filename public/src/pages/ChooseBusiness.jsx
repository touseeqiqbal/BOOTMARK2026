import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import api from '../utils/api';
import { LayoutDashboard, LogOut, PlusCircle } from 'lucide-react';

export default function ChooseBusiness() {
    const { user, logout, loading: authLoading } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchBusinesses = async () => {
            try {
                // Fetch the list of businesses the user has access to
                const response = await api.get('/businesses/my-membership');
                setBusinesses(response.data || []);
            } catch (error) {
                console.error('Failed to fetch businesses:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user && !authLoading) fetchBusinesses();
    }, [user, authLoading]);

    const handleSelect = (slug) => {
        navigate(`/${slug}/dashboard`);
    };

    if (loading) return <div className="loading-screen">Loading workspaces...</div>;

    return (
        <div className="choose-business-container" style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
        }}>
            <div style={{ maxWidth: '480px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>
                        Welcome back
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Select a workspace to continue
                    </p>
                </div>

                <div className="business-list" style={{ display: 'grid', gap: '16px' }}>
                    {businesses.map(biz => (
                        <button
                            key={biz.id}
                            onClick={() => handleSelect(biz.slug)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '20px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '16px',
                                width: '100%',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                textAlign: 'left'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'var(--primary-color)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <div style={{
                                width: '48px',
                                height: '48px',
                                background: 'var(--primary-color)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white'
                            }}>
                                <LayoutDashboard size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '4px' }}>{biz.name}</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{biz.slug}.bootmarkapp.com</p>
                            </div>
                        </button>
                    ))}

                    <button
                        onClick={() => navigate('/business-registration')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '16px',
                            background: 'transparent',
                            border: '2px dashed var(--border-color)',
                            borderRadius: '16px',
                            width: '100%',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <PlusCircle size={20} />
                        <span style={{ fontWeight: 500 }}>Register a new business</span>
                    </button>
                </div>

                <div style={{ marginTop: '40px', textAlign: 'center' }}>
                    <button
                        onClick={logout}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        <LogOut size={16} />
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );
}
