import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error('Uncaught error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    handleGoHome = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/dashboard';
    };

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div style={{
                    height: '100vh',
                    width: '100vw',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    background: '#f9fafb',
                    color: '#1f2937',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                    <div style={{
                        background: 'white',
                        padding: '3rem',
                        borderRadius: '1.5rem',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        maxWidth: '500px',
                        width: '100%'
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            padding: '1rem',
                            background: '#fee2e2',
                            borderRadius: '50%',
                            marginBottom: '1.5rem',
                            color: '#ef4444'
                        }}>
                            <AlertTriangle size={48} />
                        </div>

                        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem' }}>
                            Something went wrong
                        </h1>

                        <p style={{ color: '#6b7280', marginBottom: '2rem', lineHeight: '1.5' }}>
                            The application encountered an unexpected error. Don't worry, your data is safe.
                        </p>

                        {process.env.NODE_ENV === 'development' && (
                            <div style={{
                                textAlign: 'left',
                                background: '#f3f4f6',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                marginBottom: '2rem',
                                fontSize: '0.75rem',
                                overflow: 'auto',
                                maxHeight: '150px',
                                fontFamily: 'monospace'
                            }}>
                                {this.state.error?.toString()}
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem',
                                    background: '#4f46e5',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                <RefreshCcw size={18} />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem',
                                    background: '#f3f4f6',
                                    color: '#1f2937',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                <Home size={18} />
                                Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
