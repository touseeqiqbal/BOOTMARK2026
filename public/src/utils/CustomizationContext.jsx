import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from './api';

const CustomizationContext = createContext();

export function CustomizationProvider({ children }) {
    const { user } = useAuth();
    const [customization, setCustomization] = useState({
        // Branding
        logo: '',
        favicon: '',
        companyName: '',
        primaryColor: '#4f46e5',
        secondaryColor: '#667eea',
        accentColor: '#764ba2',
        borderRadius: 8,
        fontScale: 100,

        // App Settings
        appName: 'BOOTMARK',
        appDescription: 'Landscaping Management Platform',
        theme: 'light',
        fontFamily: 'Inter',

        // Features
        features: {
            forms: true,
            analytics: true,
            invoices: true,
            customers: true,
            workflows: true,
            teamCollaboration: true,
            reports: true,
            integrations: true,
            scheduling: true,
            employees: true,
            materials: true,
            workOrders: true,
            properties: true,
            contracts: true,
            estimates: true
        },

        // Notifications
        notifications: {
            email: true,
            sms: false,
            push: false
        },

        // Globalization
        currency: 'USD',
        currencySymbol: '$',
        currencyLocale: 'en-US',
        taxSettings: {
            label: 'Tax',
            defaultRate: 0,
            showTaxNumber: false,
            taxNumber: ''
        }
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.businessId) {
            fetchCustomization();
        } else {
            setLoading(false);
        }
    }, [user?.businessId]);

    const fetchCustomization = async () => {
        try {
            const response = await api.get('/businesses/my-business');
            if (response.data.customization) {
                setCustomization(prev => ({
                    ...prev,
                    ...response.data.customization,
                    features: {
                        ...prev.features,
                        ...response.data.customization.features
                    },
                    notifications: {
                        ...prev.notifications,
                        ...response.data.customization.notifications
                    }
                }));

                // Apply theme and colors immediately
                applyCustomization(response.data.customization);
            }
        } catch (error) {
            console.error('Failed to fetch customization:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyCustomization = (custom) => {
        const root = document.documentElement;

        // Apply colors
        if (custom.primaryColor) {
            root.style.setProperty('--primary-color', custom.primaryColor);
        }
        if (custom.secondaryColor) {
            root.style.setProperty('--secondary-color', custom.secondaryColor);
        }
        if (custom.accentColor) {
            root.style.setProperty('--accent-color', custom.accentColor);
        }

        // Apply theme
        const themeToApply = custom.theme || 'light';

        const applyThemeClass = (isDark) => {
            if (isDark) {
                document.body.classList.add('dark-theme');
                document.body.setAttribute('data-theme', 'dark');
                document.body.classList.remove('light-theme');
            } else {
                document.body.classList.add('light-theme');
                document.body.removeAttribute('data-theme');
                document.body.classList.remove('dark-theme');
            }
        };

        if (themeToApply === 'dark') {
            applyThemeClass(true);
        } else if (themeToApply === 'light') {
            applyThemeClass(false);
        } else if (themeToApply === 'system' || themeToApply === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyThemeClass(prefersDark);

            // Listen for system changes
            const handler = (e) => applyThemeClass(e.matches);
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', handler);
            // Store handler to remove later if needed (simplified for now)
        }

        // Apply font
        if (custom.fontFamily) {
            root.style.setProperty('--font-family', custom.fontFamily);
        }

        // Apply page title
        if (custom.appName) {
            document.title = custom.appName;
        }

        // Apply granular design tokens
        if (custom.borderRadius !== undefined) {
            const br = parseInt(custom.borderRadius);
            root.style.setProperty('--radius-sm', `${br / 4}px`);
            root.style.setProperty('--radius-base', `${br / 2}px`);
            root.style.setProperty('--radius-md', `${br}px`);
            root.style.setProperty('--radius-lg', `${br * 1.5}px`);
            root.style.setProperty('--radius-xl', `${br * 2}px`);
        }

        if (custom.fontScale !== undefined) {
            root.style.setProperty('--font-scale', `${custom.fontScale}%`);
            const scale = custom.fontScale / 100;
            root.style.setProperty('--text-xs', `${0.75 * scale}rem`);
            root.style.setProperty('--text-sm', `${0.875 * scale}rem`);
            root.style.setProperty('--text-base', `${1 * scale}rem`);
            root.style.setProperty('--text-lg', `${1.125 * scale}rem`);
            root.style.setProperty('--text-xl', `${1.25 * scale}rem`);
        }
    };

    const updateCustomization = (newCustomization) => {
        setCustomization(newCustomization);
        applyCustomization(newCustomization);
    };

    const isFeatureEnabled = (featureName) => {
        return customization.features[featureName] !== false;
    };

    const formatPrice = (value = 0) => {
        const amount = Number(value || 0);
        try {
            return new Intl.NumberFormat(customization.currencyLocale || 'en-US', {
                style: 'currency',
                currency: customization.currency || 'USD'
            }).format(amount);
        } catch (e) {
            console.error('Price formatting failed:', e);
            return `${customization.currencySymbol || '$'}${amount.toFixed(2)}`;
        }
    };

    const value = {
        customization,
        updateCustomization,
        isFeatureEnabled,
        formatPrice,
        loading,
        refreshCustomization: fetchCustomization
    };

    return (
        <CustomizationContext.Provider value={value}>
            {children}
        </CustomizationContext.Provider>
    );
}

export function useCustomization() {
    const context = useContext(CustomizationContext);
    if (!context) {
        throw new Error('useCustomization must be used within CustomizationProvider');
    }
    return context;
}
