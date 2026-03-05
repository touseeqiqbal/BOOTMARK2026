import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, Search, Filter, CheckCircle, Trash2, Home,
    Calendar, DollarSign, Zap, MessageSquare, Briefcase,
    AlertCircle, Info, Check, Clock, ChevronRight
} from 'lucide-react';
import api from '../utils/api';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsCenter() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchNotifications();
    }, [activeCategory, unreadOnly]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (activeCategory !== 'all') params.append('category', activeCategory);
            if (unreadOnly) params.append('unreadOnly', 'true');
            if (search) params.append('search', search);

            const response = await api.get(`/notifications?${params.toString()}`);
            setNotifications(response.data.notifications || []);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle className="text-emerald-500" size={20} />;
            case 'error': return <AlertCircle className="text-rose-500" size={20} />;
            case 'warning': return <Zap className="text-amber-500" size={20} />;
            default: return <Info className="text-blue-500" size={20} />;
        }
    };

    const getCategoryColor = (category) => {
        switch (category) {
            case 'Billing': return '#8b5cf6';
            case 'CRM': return '#3b82f6';
            case 'System': return '#64748b';
            default: return 'var(--primary-500)';
        }
    };

    return (
        <>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 className="heading-responsive" style={{ margin: 0 }}>Communication Hub</h1>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Manage all your system alerts and communications</p>
                    </div>
                    <button className="btn-modern secondary" onClick={handleMarkAllAsRead}>
                        <Check size={18} />
                        Mark all as read
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="modern-card" style={{ marginBottom: '24px', padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search notifications..."
                                style={{ paddingLeft: '40px' }}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchNotifications()}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['all', 'System', 'CRM', 'Billing'].map(cat => (
                                <button
                                    key={cat}
                                    className={`nav-item ${activeCategory === cat ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        background: activeCategory === cat ? 'var(--primary-500)' : 'transparent',
                                        color: activeCategory === cat ? 'white' : 'var(--text-primary)',
                                        border: '1px solid var(--border-color)'
                                    }}
                                >
                                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </button>
                            ))}
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>
                            <input
                                type="checkbox"
                                checked={unreadOnly}
                                onChange={(e) => setUnreadOnly(e.target.checked)}
                            />
                            Unread only
                        </label>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="modern-card" style={{ padding: 0 }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <Clock className="animate-spin" />
                            <p>Loading notifications...</p>
                        </div>
                    ) : notifications.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {notifications.map((n, idx) => (
                                <div
                                    key={n.id}
                                    className="notification-item"
                                    style={{
                                        display: 'flex',
                                        gap: '16px',
                                        padding: '20px 24px',
                                        borderBottom: idx === notifications.length - 1 ? 'none' : '1px solid var(--border-color)',
                                        background: n.isRead ? 'transparent' : 'rgba(14, 165, 233, 0.05)',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleMarkAsRead(n.id)}
                                >
                                    <div style={{ marginTop: '4px' }}>
                                        {getIcon(n.type)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: '800',
                                                textTransform: 'uppercase',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                background: `${getCategoryColor(n.category)}15`,
                                                color: getCategoryColor(n.category)
                                            }}>
                                                {n.category || 'General'}
                                            </span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                {formatDistanceToNow(new Date(n.timestamp || n.createdAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700' }}>{n.title}</h4>
                                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{n.message}</p>

                                        {n.actionUrl && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(n.actionUrl);
                                                }}
                                                className="btn-link"
                                                style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary-500)', fontSize: '13px', fontWeight: '600' }}
                                            >
                                                View Details <ChevronRight size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {!n.isRead && (
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-500)', marginTop: '8px' }}></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '80px 40px', textAlign: 'center' }}>
                            <Bell size={48} style={{ color: 'var(--border-color)', marginBottom: '16px' }} />
                            <h3>No notifications found</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>You're all caught up! Check back later for new updates.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
