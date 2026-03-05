import React from 'react';
import { useAuth } from '../../utils/AuthContext';
import { ShieldAlert, LogOut, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ImpersonationBar = () => {
    const { user, stopImpersonation } = useAuth();
    const navigate = useNavigate();

    if (!user || !user.isImpersonating) return null;

    const handleStop = async () => {
        try {
            await stopImpersonation();
            // Redirect to the Super Admin dashboard after stopping
            navigate('/admin/dashboard');
        } catch (error) {
            console.error('Failed to stop impersonation:', error);
            alert('Error stopping impersonation session');
        }
    };

    return (
        <div className="impersonation-banner">
            <div className="impersonation-content">
                <div className="impersonation-info">
                    <ShieldAlert className="impersonation-icon" size={18} />
                    <span className="impersonation-text">
                        <strong>Impersonation Mode:</strong> You are currently acting as
                        <span className="impersonation-target"> {user.email}</span>
                    </span>
                    <div className="impersonation-badge">Preview Mode</div>
                </div>
                <button
                    onClick={handleStop}
                    className="impersonation-stop-btn"
                    title="Stop impersonation and return to Admin Panel"
                >
                    <LogOut size={16} />
                    <span>Exit Session</span>
                </button>
            </div>
            <style sx>{`
                .impersonation-banner {
                    background: linear-gradient(90deg, #dc2626 0%, #ef4444 100%);
                    color: white;
                    padding: 8px 16px;
                    position: sticky;
                    top: 0;
                    z-index: 9999;
                    box-shadow: 0 2px 10px rgba(220, 38, 38, 0.3);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                    animation: slideDown 0.3s ease-out;
                }

                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }

                .impersonation-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .impersonation-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .impersonation-icon {
                    color: #fee2e2;
                }

                .impersonation-text {
                    font-size: 14px;
                    letter-spacing: 0.01em;
                }

                .impersonation-target {
                    background: rgba(255, 255, 255, 0.15);
                    padding: 2px 6px;
                    border-radius: 4px;
                    margin-left: 4px;
                    font-family: monospace;
                    text-decoration: underline;
                }

                .impersonation-badge {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .impersonation-stop-btn {
                    background: white;
                    color: #dc2626;
                    border: none;
                    padding: 6px 14px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .impersonation-stop-btn:hover {
                    background: #fee2e2;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
                }

                .impersonation-stop-btn:active {
                    transform: translateY(0);
                }
            `}</style>
        </div>
    );
};

export default ImpersonationBar;
