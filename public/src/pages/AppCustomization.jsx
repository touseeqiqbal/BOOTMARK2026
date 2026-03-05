import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../utils/AuthContext'
import { useCustomization } from '../utils/CustomizationContext'
import api from '../utils/api'
import {
  Palette, Save, Image, Globe, Mail, Bell,
  Smartphone, Monitor, CheckCircle, Loader, Lock
} from 'lucide-react'
import ImageUpload from '../components/ImageUpload'
import PageHeader from '../components/ui/PageHeader'
import { hasPermission } from '../utils/permissionUtils'

export default function AppCustomization() {
  const { user, loading: authLoading } = useAuth()
  const { refreshCustomization } = useCustomization()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [accessDenied, setAccessDenied] = useState(false)

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
    appUrl: '',

    // Theme
    theme: 'light', // light, dark, auto
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
      integrations: true
    },

    // Notifications
    notifications: {
      email: true,
      sms: false,
      push: false
    },

    // Custom Domain
    customDomain: '',

    // API Access
    apiEnabled: false,
    apiKey: '',

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
  })

  useEffect(() => {
    if (!authLoading) {
      // Check for business.settings permission or legacy settings permission
      const hasAccess = hasPermission(user, 'business.settings') ||
        hasPermission(user, 'settings') ||
        user?.isBusinessOwner ||
        user?.isAdmin
      if (!hasAccess) {
        setAccessDenied(true)
        setLoading(false)
      } else {
        setAccessDenied(false)
        fetchCustomization()
      }
    }
  }, [authLoading, user])

  const fetchCustomization = async () => {
    try {
      const response = await api.get('/businesses/my-business')
      if (response.data.customization) {
        setCustomization(prev => ({
          ...prev,
          ...response.data.customization
        }))
      }
    } catch (error) {
      console.error('Failed to fetch customization:', error)
      if (error.response?.status === 404) {
        navigate('/business-registration')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      await api.put('/businesses/update', {
        customization: {
          ...customization,
          notifications: { ...customization.notifications },
          taxSettings: { ...customization.taxSettings },
        }
      })

      // Refresh customization context to apply changes immediately
      await refreshCustomization()

      setMessage({
        type: 'success',
        text: 'Customization settings saved successfully! Changes have been applied.'
      })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const generateApiKey = () => {
    const key = `sk_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`
    setCustomization(prev => ({ ...prev, apiKey: key }))
  }

  if (authLoading || loading) {
    return <div className="loading">Loading...</div>
  }

  if (accessDenied) {
    return (
      <div className="app-customization-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <Palette size={64} color="#9ca3af" style={{ marginBottom: '20px' }} />
        <h2>You don&apos;t have permission to customize the app.</h2>
        <p style={{ color: '#6b7280', marginTop: '8px' }}>
          Only business owners or admins with settings access can use this page.
        </p>
        <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="dashboard animate-fadeIn">
      <PageHeader
        title="App Customization"
        subtitle="Manage your white-label branding and platform features"
        actions={
          <button className="btn-modern btn-modern-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader size={18} className="spinner" /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        }
      />

      <div className="container" style={{ paddingTop: 0, marginTop: '24px' }}>
        {message.text && (
          <div className={`badge badge-${message.type === 'error' ? 'error' : message.type === 'success' ? 'success' : 'info'}`} style={{ width: '100%', marginBottom: '24px', padding: '12px', justifyContent: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: '800' }}>{message.text}</span>
          </div>
        )}

        <div className="customization-sections" style={{ display: 'grid', gap: '32px' }}>
          {/* Branding Section */}
          <section className="modern-card animate-fadeIn" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', background: 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Palette size={28} color="var(--primary-600)" />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>Visual Identity</h2>
                <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '14px', fontWeight: '600' }}>Customize your organization's logo, colors and icons</p>
              </div>
            </div>

            <div className="forms-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
              <div className="form-group">
                <label className="label-modern">Main Platform Logo</label>
                <ImageUpload
                  label=""
                  value={customization.logo}
                  onChange={(value) => setCustomization({ ...customization, logo: value })}
                  accept="image/*"
                  maxSize={2 * 1024 * 1024}
                />
              </div>
              <div className="form-group">
                <label className="label-modern">Browser Favicon</label>
                <ImageUpload
                  label=""
                  value={customization.favicon}
                  onChange={(value) => setCustomization({ ...customization, favicon: value })}
                  accept="image/*"
                  maxSize={512 * 1024}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label-modern">Company Display Name</label>
                <input
                  type="text"
                  className="input-modern"
                  value={customization.companyName}
                  onChange={(e) => setCustomization({ ...customization, companyName: e.target.value })}
                  placeholder="Your Corporate Name"
                />
              </div>

              <div className="form-group">
                <label className="label-modern">Primary Brand Color</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="color"
                    className="input-modern"
                    style={{ width: '60px', height: '42px', padding: '4px' }}
                    value={customization.primaryColor}
                    onChange={(e) => setCustomization({ ...customization, primaryColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input-modern"
                    value={customization.primaryColor}
                    onChange={(e) => setCustomization({ ...customization, primaryColor: e.target.value })}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label-modern">Secondary Accent</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="color"
                    className="input-modern"
                    style={{ width: '60px', height: '42px', padding: '4px' }}
                    value={customization.secondaryColor}
                    onChange={(e) => setCustomization({ ...customization, secondaryColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input-modern"
                    value={customization.secondaryColor}
                    onChange={(e) => setCustomization({ ...customization, secondaryColor: e.target.value })}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label-modern">Accent Gradient End</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="color"
                    className="input-modern"
                    style={{ width: '60px', height: '42px', padding: '4px' }}
                    value={customization.accentColor}
                    onChange={(e) => setCustomization({ ...customization, accentColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input-modern"
                    value={customization.accentColor}
                    onChange={(e) => setCustomization({ ...customization, accentColor: e.target.value })}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
              <div className="form-group">
                <label className="label-modern">Border Radius (px)</label>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  value={customization.borderRadius}
                  onChange={(e) => setCustomization({ ...customization, borderRadius: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--primary-600)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', fontWeight: '700' }}>
                  <span>Sharp</span>
                  <span>{customization.borderRadius}px</span>
                  <span>Round</span>
                </div>
              </div>
              <div className="form-group">
                <label className="label-modern">Interface Scale (%)</label>
                <input
                  type="range"
                  min="80"
                  max="120"
                  step="5"
                  value={customization.fontScale}
                  onChange={(e) => setCustomization({ ...customization, fontScale: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--primary-600)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', fontWeight: '700' }}>
                  <span>Compact</span>
                  <span>{customization.fontScale}%</span>
                  <span>Comfortable</span>
                </div>
              </div>
            </div>

            {/* Live Preview Sidebar */}
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>Live Brand Preview</h3>
              <div style={{
                background: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: `${customization.borderRadius}px`,
                padding: '24px',
                boxShadow: 'var(--shadow-lg)',
                maxWidth: '400px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: customization.primaryColor,
                    borderRadius: `${customization.borderRadius * 0.75}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}>
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>{customization.appName || 'BOOTMARK'}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)' }}>{customization.appDescription?.substring(0, 30)}...</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: `${customization.borderRadius * 0.5}px`, marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: customization.primaryColor, marginBottom: '4px' }}>SAMPLE ANALYTICS</div>
                  <div style={{ height: '8px', width: '100%', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '75%', background: `linear-gradient(90deg, ${customization.primaryColor}, ${customization.secondaryColor})` }}></div>
                  </div>
                </div>

                <button style={{
                  width: '100%',
                  padding: '12px',
                  background: customization.accentColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: `${customization.borderRadius}px`,
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'default',
                  boxShadow: `0 4px 12px ${customization.accentColor}30`
                }}>
                  Primary Action Button
                </button>
              </div>
            </div>
          </section>

          {/* App Configuration Section */}
          <section className="modern-card animate-fadeIn" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Monitor size={28} color="var(--primary-600)" />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>Platform Configuration</h2>
                <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '14px', fontWeight: '600' }}>Control app naming, themes and global descriptions</p>
              </div>
            </div>

            <div className="forms-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div className="form-group">
                <label className="label-modern">Application Identifier</label>
                <input
                  type="text"
                  className="input-modern"
                  value={customization.appName}
                  onChange={(e) => setCustomization({ ...customization, appName: e.target.value })}
                  placeholder="BOOTMARK"
                />
              </div>
              <div className="form-group">
                <label className="label-modern">Subdomain / URL</label>
                <input
                  type="url"
                  className="input-modern"
                  value={customization.appUrl}
                  onChange={(e) => setCustomization({ ...customization, appUrl: e.target.value })}
                  placeholder="https://yourcompany.app.com"
                />
              </div>
              <div className="form-group">
                <label className="label-modern">Visual Theme Mode</label>
                <select
                  className="input-modern"
                  value={customization.theme}
                  onChange={(e) => setCustomization({ ...customization, theme: e.target.value })}
                >
                  <option value="light">Standard Light</option>
                  <option value="dark">Pro Dark (2026 Edition)</option>
                  <option value="auto">System Sync</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label-modern">Platform Description</label>
                <textarea
                  className="input-modern"
                  value={customization.appDescription}
                  onChange={(e) => setCustomization({ ...customization, appDescription: e.target.value })}
                  placeholder="Describe your platform for users..."
                  rows={3}
                  style={{ minHeight: '100px' }}
                />
              </div>
            </div>
          </section>

          {/* Feature Orchestration Section */}
          <section className="modern-card animate-fadeIn" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', background: 'var(--success-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={28} color="var(--success-600)" />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>Feature Orchestration</h2>
                <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '14px', fontWeight: '600' }}>Enable or restrict platform capabilities for your organization</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {Object.entries(customization.features).map(([key, value]) => (
                <div key={key} className="modern-card" style={{ padding: '20px', background: value ? 'var(--primary-50)' : 'var(--bg-secondary)', border: value ? '1px solid var(--primary-100)' : '1px solid var(--border-color)', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: value ? 'var(--primary-800)' : 'var(--text-primary)' }}>
                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setCustomization({
                          ...customization,
                          features: { ...customization.features, [key]: e.target.checked }
                        })}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Globalization & Regional Section */}
          <section className="modern-card animate-fadeIn" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={28} color="var(--primary-600)" />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>Globalization & Regional</h2>
                <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '14px', fontWeight: '600' }}>Configure currency, localization and tax specifics for your region</p>
              </div>
            </div>

            <div className="forms-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div className="form-group">
                <label className="label-modern">Base Currency Code</label>
                <select
                  className="input-modern"
                  value={customization.currency}
                  onChange={(e) => setCustomization({ ...customization, currency: e.target.value })}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="PKR">PKR - Pakistani Rupee</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label-modern">Currency Symbol</label>
                <input
                  type="text"
                  className="input-modern"
                  value={customization.currencySymbol}
                  onChange={(e) => setCustomization({ ...customization, currencySymbol: e.target.value })}
                  placeholder="$"
                />
              </div>
              <div className="form-group">
                <label className="label-modern">Regional Locale</label>
                <select
                  className="input-modern"
                  value={customization.currencyLocale}
                  onChange={(e) => setCustomization({ ...customization, currencyLocale: e.target.value })}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="fr-FR">Français (France)</option>
                  <option value="de-DE">Deutsch (Germany)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="ur-PK">Urdu (Pakistan)</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '16px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800' }}>Tax Configuration</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div className="form-group">
                    <label className="label-modern">Tax Label (e.g. VAT, GST)</label>
                    <input
                      type="text"
                      className="input-modern"
                      value={customization.taxSettings?.label}
                      onChange={(e) => setCustomization({
                        ...customization,
                        taxSettings: { ...customization.taxSettings, label: e.target.value }
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label-modern">Default Tax Rate (%)</label>
                    <input
                      type="number"
                      className="input-modern"
                      value={customization.taxSettings?.defaultRate}
                      onChange={(e) => setCustomization({
                        ...customization,
                        taxSettings: { ...customization.taxSettings, defaultRate: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Advanced Tiers Section */}
          <section className="modern-card animate-fadeIn" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', background: 'var(--warning-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={28} color="var(--warning-600)" />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>Advanced & API Provisions</h2>
                <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '14px', fontWeight: '600' }}>Custom domains and secure programmatic access</p>
              </div>
            </div>

            <div className="forms-grid" style={{ gridTemplateColumns: '1fr', gap: '24px' }}>
              <div className="form-group">
                <label className="label-modern">Enterprise Custom Domain</label>
                <input
                  type="text"
                  className="input-modern"
                  value={customization.customDomain}
                  onChange={(e) => setCustomization({ ...customization, customDomain: e.target.value })}
                  placeholder="app.yourcompany.com"
                />
                <small style={{ marginTop: '8px', display: 'block', color: 'var(--text-tertiary)', fontWeight: '600' }}>Requires CNAME configuration to point towards our platform core.</small>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Platform API Engine</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600' }}>Enable programmatic read/write access to your business data</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={customization.apiEnabled}
                      onChange={(e) => setCustomization({ ...customization, apiEnabled: e.target.checked })}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {customization.apiEnabled && (
                  <div className="animate-fadeIn" style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    <label className="label-modern">Production Secret Key</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input
                        type="text"
                        className="input-modern"
                        value={customization.apiKey}
                        readOnly
                        style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em' }}
                        placeholder="Generate a secure key to start integrations"
                      />
                      <button className="btn-modern btn-modern-secondary" onClick={generateApiKey}>
                        Regenerate
                      </button>
                    </div>
                    <div className="badge badge-error" style={{ marginTop: '12px', fontSize: '11px', padding: '6px 12px' }}>
                      <Lock size={12} /> CRITICAL: Do not share your production API secret.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
