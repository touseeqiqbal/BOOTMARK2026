import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams, Outlet, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
    LayoutDashboard,
    Users,
    ClipboardList,
    Wrench,
    Package,
    FileText,
    CreditCard,
    Calendar,
    UserCircle,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    Home,
    MapPin,
    Briefcase,
    TrendingUp,
    LogOut,
    Menu,
    X,
    CheckCircle,
    Shield,
    Search,
    Star,
    Zap,
    Bell,
    ChevronDown,
    ChevronUp,
    Wifi,
    WifiOff,
    ShoppingBag,
    LayoutGrid,
    ShieldCheck,
    Activity,
    Edit3,
    Eye,
    EyeOff,
    Building
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { useAuth } from '../utils/AuthContext'
import { hasPermission } from '../utils/permissionUtils'
import LanguageSwitcher from './LanguageSwitcher'
import MobileBottomNav from './MobileBottomNav'
import logo from '../assets/logo.jpeg'
export default function ModernSidebar() {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [isCustomizing, setIsCustomizing] = useState(false)
    const [showFooterTools, setShowFooterTools] = useState(false)
    const [hiddenItems, setHiddenItems] = useState([])
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const { tenantSlug } = useParams()
    const { t } = useTranslation()

    // Redirect if tenantSlug is invalid
    if (tenantSlug === 'undefined' || tenantSlug === 'null') {
        return <Navigate to="/choose-business" replace />
    }
    const [isOnline, setIsOnline] = useState(navigator.onLine)

    // Tenant-specific storage keys
    const businessId = user?.businessId || 'default'
    const STORAGE_KEY_ORDER = `sidebar_order_${businessId}`
    const STORAGE_KEY_EXPANDED = `sidebar_expanded_${businessId}`
    const STORAGE_KEY_FAVORITES = `sidebar_favorites_${businessId}`
    const STORAGE_KEY_RECENT = `sidebar_recent_${businessId}`
    const STORAGE_KEY_HIDDEN = `sidebar_hidden_${businessId}`

    const [expandedSections, setExpandedSections] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_EXPANDED)
        return saved ? JSON.parse(saved) : { main: true, operations: true }
    })
    const [favorites, setFavorites] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_FAVORITES)
        return saved ? JSON.parse(saved) : []
    })
    const [recentItems, setRecentItems] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_RECENT)
        return saved ? JSON.parse(saved) : []
    })
    const [customOrder, setCustomOrder] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_ORDER)
        return saved ? JSON.parse(saved) : null
    })

    useEffect(() => {
        const savedHidden = localStorage.getItem(STORAGE_KEY_HIDDEN)
        if (savedHidden) setHiddenItems(JSON.parse(savedHidden))
    }, [businessId])

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const canManageForms = hasPermission(user, 'forms')
    const canManageCustomers = hasPermission(user, 'customers')
    const canManageProperties = hasPermission(user, 'properties')
    const canManageWorkOrders = hasPermission(user, 'workOrders')
    const canManageInvoices = hasPermission(user, 'invoices')
    const canManageScheduling = hasPermission(user, 'scheduling')
    const canManageContracts = hasPermission(user, 'contracts')
    const canManageServices = hasPermission(user, 'services')
    const canManageProducts = hasPermission(user, 'products')
    const canManageTeam = hasPermission(user, 'team')
    const canManageReports = hasPermission(user, 'reports')
    const canManageSettings = hasPermission(user, 'business.settings') || hasPermission(user, 'settings')

    const menuItems = [
        {
            id: 'main',
            section: t('sidebar.main'),
            items: [
                { icon: LayoutDashboard, label: t('sidebar.dashboard'), path: '/dashboard', permission: true },
                { icon: FileText, label: t('sidebar.forms'), path: '/forms', permission: canManageForms },
                { icon: Users, label: t('sidebar.clients'), path: '/clients', permission: canManageCustomers },
                { icon: MapPin, label: t('sidebar.properties'), path: '/properties', permission: canManageProperties || canManageCustomers },
            ]
        },
        {
            id: 'operations',
            section: t('sidebar.operations'),
            items: [
                { icon: ClipboardList, label: t('sidebar.workOrders'), path: '/work-orders', permission: canManageWorkOrders },
                { icon: Settings, label: 'Workflows', path: '/job-workflows', permission: canManageWorkOrders },
                { icon: Zap, label: 'Automations', path: '/automations', permission: canManageSettings },
                { icon: Bell, label: 'Notification Hub', path: '/notifications', permission: true },
                { icon: Calendar, label: t('sidebar.scheduling'), path: '/scheduling', permission: canManageScheduling },
                { icon: Briefcase, label: t('sidebar.contracts'), path: '/contracts', permission: canManageContracts },
                { icon: ShoppingBag, label: 'Marketplace', path: '/marketplace', permission: true },
            ]
        },
        {
            id: 'catalog',
            section: t('sidebar.catalog'),
            items: [
                { icon: Wrench, label: t('sidebar.services'), path: '/services', permission: canManageServices },
                { icon: Package, label: t('sidebar.products'), path: '/products', permission: canManageProducts },
                { icon: Package, label: t('sidebar.materials'), path: '/materials', permission: canManageProducts },
            ]
        },
        {
            id: 'finance',
            section: t('sidebar.finance'),
            items: [
                { icon: FileText, label: t('sidebar.estimates'), path: '/estimates', permission: canManageInvoices },
                { icon: CreditCard, label: t('sidebar.invoices'), path: '/invoices', permission: canManageInvoices },
            ]
        },
        {
            id: 'team',
            section: t('sidebar.team'),
            items: [
                { icon: UserCircle, label: t('sidebar.employees'), path: '/employees', permission: canManageTeam },
                { icon: Home, label: t('sidebar.crewMobile'), path: '/crew-mobile', permission: canManageTeam },
            ]
        },
        {
            id: 'analytics',
            section: t('sidebar.analytics'),
            items: [
                { icon: BarChart3, label: t('sidebar.businessReports'), path: '/business-reports', permission: canManageReports },
                { icon: TrendingUp, label: 'Analytics', path: '/analytics', permission: canManageReports },
            ]
        },
        {
            id: 'security',
            section: 'Security & Monitoring',
            items: [
                { icon: ShieldCheck, label: 'Audit Logs', path: '/audit-log', permission: canManageSettings },
                { icon: Activity, label: 'System Health', path: '/system-health', permission: canManageSettings },
            ]
        },
        {
            id: 'admin',
            section: t('sidebar.admin'),
            items: [
                { icon: Building, label: 'Global Businesses', path: '/admin/global-businesses', permission: user?.isSuperAdmin },
                { icon: CheckCircle, label: t('sidebar.businessApprovals'), path: '/admin/approvals', permission: user?.isSuperAdmin },
                { icon: Shield, label: t('sidebar.managePermissions'), path: '/admin/business-permissions', permission: user?.isSuperAdmin },
            ]
        },
        {
            id: 'settings',
            section: t('sidebar.settings'),
            items: [
                { icon: Settings, label: t('sidebar.settings'), path: '/account-settings', permission: true },
                { icon: Settings, label: t('sidebar.customizeApp'), path: '/app-customization', permission: canManageSettings },
                { icon: Wrench, label: t('sidebar.quickbooks'), path: '/quickbooks', permission: canManageSettings },
            ]
        }
    ]

    const orderedMenuItems = [...menuItems].sort((a, b) => {
        if (!customOrder) return 0
        const indexA = customOrder.indexOf(a.id)
        const indexB = customOrder.indexOf(b.id)
        if (indexA === -1 && indexB === -1) return 0
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
    })

    const onDragEnd = (result) => {
        if (!result.destination) return
        const items = customOrder ? [...customOrder] : menuItems.map(m => m.id)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)
        setCustomOrder(items)
        localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(items))
    }

    const filteredMenuItems = orderedMenuItems.map(section => ({
        ...section,
        items: section.items.filter(item => {
            if (!item.permission) return false
            if (!isCustomizing && hiddenItems.includes(item.path)) return false
            return true
        })
    })).filter(section => section.items.length > 0)

    const handleNavigation = (path, label) => {
        if (isCustomizing) return

        // Define system-wide global routes that should NOT be prefixed with a tenant slug
        const globalPrefixes = ['/admin', '/marketplace'];
        const isGlobal = globalPrefixes.some(prefix => path.startsWith(prefix));

        // Use params.tenantSlug if available, otherwise fallback to the user's current business slug
        const effectiveSlug = tenantSlug || user?.currentBusiness?.slug;

        const fullPath = isGlobal ? path : `/${effectiveSlug}${path}`
        navigate(fullPath)
        setMobileOpen(false)
        setRecentItems(prev => {
            const filtered = prev.filter(item => item.path !== path)
            const updated = [{ path, label, timestamp: Date.now() }, ...filtered].slice(0, 5)
            localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated))
            return updated
        })
    }

    const toggleSection = (sectionId) => {
        setExpandedSections(prev => {
            const updated = { ...prev, [sectionId]: !prev[sectionId] }
            localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify(updated))
            return updated
        })
    }

    const toggleFavorite = (path, label, e) => {
        e.stopPropagation()
        setFavorites(prev => {
            const isFavorite = prev.some(fav => fav.path === path)
            const updated = isFavorite
                ? prev.filter(fav => fav.path !== path)
                : [...prev, { path, label, timestamp: Date.now() }]
            localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated))
            return updated
        })
    }

    const toggleHideItem = (path, e) => {
        e.stopPropagation()
        setHiddenItems(prev => {
            const updated = prev.includes(path)
                ? prev.filter(p => p !== path)
                : [...prev, path]
            localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(updated))
            return updated
        })
    }

    const isFavorite = (path) => favorites.some(fav => fav.path === path)
    const isActive = (path) => {
        // Detect if the path is a project-wide global route
        const globalPrefixes = ['/admin', '/marketplace'];
        const isGlobal = globalPrefixes.some(prefix => path.startsWith(prefix));

        if (isGlobal) {
            // Compare directly against the full location pathname
            return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
        }

        const currentRest = location.pathname.replace(`/${tenantSlug}`, '') || '/'
        return currentRest === path || (path !== '/' && currentRest.startsWith(path))
    }

    const sidebarContent = (
        <div className="sidebar-content-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Logo Section */}
            <div className={`sidebar-logo ${collapsed ? 'collapsed' : ''}`} style={{ margin: '4px 8px 8px' }}>
                <img src={logo} alt="BOOTMARK" className="logo-image" />
                {!collapsed && (
                    <div className="logo-text">
                        <h1 className="logo-title gradient-text">BOOTMARK</h1>
                    </div>
                )}
            </div>

            {/* User Profile */}
            <div className={`sidebar-profile ${collapsed ? 'collapsed' : ''}`} style={{ margin: '0 8px 8px' }}>
                <div className="profile-avatar">
                    <UserCircle size={collapsed ? 32 : 40} />
                </div>
                {!collapsed && (
                    <div className="profile-info">
                        <p className="profile-name">{user?.name || user?.email}</p>
                        <p className="profile-role">{user?.businessRole || 'Member'}</p>
                    </div>
                )}
            </div>


            {/* Scrollable Area */}
            <div className="sidebar-scroll-container" style={{ flex: 1, overflowY: 'auto' }}>
                {/* Favorites */}
                {!collapsed && favorites.length > 0 && !isCustomizing && (
                    <div className="nav-section" style={{ marginBottom: '8px' }}>
                        <div className="nav-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}>
                            <Star size={12} fill="currentColor" />
                            <span>Favorites</span>
                        </div>
                        {favorites.map((fav, idx) => {
                            const menuItem = menuItems.flatMap(s => s.items).find(i => i.path === fav.path && i.permission)
                            if (!menuItem) return null
                            const Icon = menuItem.icon
                            const active = isActive(fav.path)
                            return (
                                <button key={idx} onClick={() => handleNavigation(fav.path, fav.label)} className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}>
                                    <Icon size={18} />
                                    <span className="nav-label">{fav.label}</span>
                                </button>
                            )
                        })}
                    </div>
                )}

                <div className="sidebar-search-trigger"
                    onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }))}
                    style={{ margin: '0 8px 8px' }}
                >
                    <Search size={18} />
                    {!collapsed && <span>Search...</span>}
                    {!collapsed && <div className="search-shortcut">⌘K</div>}
                </div>

                {/* Main Navigation with DnD */}
                <DragDropContext onDragEnd={onDragEnd}>
                    <StrictModeDroppable droppableId="sidebar-sections" type="SECTION">
                        {(provided) => (
                            <nav {...provided.droppableProps} ref={provided.innerRef} className="sidebar-nav">
                                {filteredMenuItems.map((section, idx) => {
                                    const isExpanded = expandedSections[section.id] !== false
                                    const hasMultipleItems = section.items.length > 1

                                    return (
                                        <Draggable key={section.id} draggableId={section.id} index={idx} isDragDisabled={!isCustomizing}>
                                            {(dragProvided, snapshot) => (
                                                <div
                                                    ref={dragProvided.innerRef}
                                                    {...dragProvided.draggableProps}
                                                    className={`nav-section ${snapshot.isDragging ? 'dragging' : ''}`}
                                                    style={{
                                                        ...dragProvided.draggableProps.style,
                                                        background: snapshot.isDragging ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                        borderRadius: '8px',
                                                        marginBottom: '0'
                                                    }}
                                                >
                                                    {!collapsed && (
                                                        <div className="section-header" style={{ display: 'flex', alignItems: 'center' }} {...dragProvided.dragHandleProps}>
                                                            <button
                                                                className="nav-section-title"
                                                                onClick={() => !isCustomizing && toggleSection(section.id)}
                                                                style={{
                                                                    flex: 1,
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    padding: '2px 8px',
                                                                    textAlign: 'left',
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    cursor: !isCustomizing ? 'pointer' : 'default'
                                                                }}
                                                            >
                                                                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    {section.section}
                                                                </span>
                                                                {!isCustomizing && (
                                                                    isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {((!collapsed && isExpanded) || (collapsed && !isCustomizing)) && (
                                                        <div className="section-items">
                                                            {section.items.map((item, itemIdx) => {
                                                                const Icon = item.icon
                                                                const active = isActive(item.path)
                                                                const favorite = isFavorite(item.path)
                                                                return (
                                                                    <div
                                                                        key={itemIdx}
                                                                        onClick={() => handleNavigation(item.path, item.label)}
                                                                        className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''} ${hiddenItems.includes(item.path) ? 'is-hidden' : ''}`}
                                                                        style={{ opacity: isCustomizing ? 0.6 : 1 }}
                                                                    >
                                                                        <Icon size={20} className="nav-icon" />
                                                                        {!collapsed && (
                                                                            <>
                                                                                <span className="nav-label">{item.label}</span>
                                                                                {isCustomizing && (
                                                                                    <button
                                                                                        onClick={(e) => toggleHideItem(item.path, e)}
                                                                                        className="nav-hide-btn"
                                                                                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: hiddenItems.includes(item.path) ? '#ef4444' : 'rgba(255,255,255,0.4)' }}
                                                                                        title={hiddenItems.includes(item.path) ? 'Show Item' : 'Hide Item'}
                                                                                    >
                                                                                        {hiddenItems.includes(item.path) ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                                    </button>
                                                                                )}
                                                                                {!isCustomizing && (
                                                                                    <button
                                                                                        onClick={(e) => toggleFavorite(item.path, item.label, e)}
                                                                                        className="nav-favorite-btn"
                                                                                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: favorite ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}
                                                                                    >
                                                                                        <Star size={12} fill={favorite ? 'currentColor' : 'none'} />
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                        {active && <div className="nav-indicator" />}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    )
                                })}
                                {provided.placeholder}
                            </nav>
                        )}
                    </StrictModeDroppable>
                </DragDropContext>
            </div>

            {/* Footer */}
            <div className={`sidebar-footer ${collapsed ? 'collapsed' : ''}`} style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {!collapsed && (
                    <button
                        onClick={() => setShowFooterTools(!showFooterTools)}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '12px',
                            cursor: 'pointer',
                            marginBottom: showFooterTools ? '12px' : '0'
                        }}
                    >
                        <span style={{ opacity: 0.6 }}>{showFooterTools ? 'Hide Settings' : 'Settings & Tools'}</span>
                        <ChevronDown size={14} style={{ transform: showFooterTools ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease', opacity: 0.6 }} />
                    </button>
                )}

                {!collapsed && showFooterTools && (
                    <div className="footer-tools-expanded" style={{ animation: 'slideDown 0.3s ease-out' }}>
                        <button
                            onClick={() => setIsCustomizing(!isCustomizing)}
                            className={`customize-btn ${isCustomizing ? 'active' : ''}`}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px',
                                borderRadius: '8px',
                                background: isCustomizing ? 'var(--primary-light)' : 'rgba(255,255,255,0.05)',
                                color: isCustomizing ? 'white' : 'inherit',
                                border: 'none',
                                marginBottom: '12px',
                                cursor: 'pointer',
                                fontSize: '13px'
                            }}
                        >
                            <Edit3 size={16} />
                            <span>{isCustomizing ? 'Save Layout' : 'Customize Sidebar'}</span>
                        </button>

                        <div style={{ marginBottom: '12px' }}>
                            <LanguageSwitcher compact={collapsed} />
                        </div>

                        <div className="status-indicator" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: isOnline ? '#10b981' : '#ef4444',
                            marginBottom: '12px'
                        }}>
                            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                            <span>{isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                    </div>
                )}

                <button className="logout-button" onClick={() => { logout(); setMobileOpen(false); }} style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: !collapsed && !showFooterTools ? '12px' : '0'
                }}>
                    <LogOut size={20} />
                    {!collapsed && <span>{t('sidebar.logout')}</span>}
                </button>
            </div>
        </div>
    )

    return (
        <div className="modern-layout">
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <aside className={`modern-sidebar ${collapsed ? 'collapsed' : ''}`}>
                {sidebarContent}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="sidebar-toggle"
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </aside>

            {mobileOpen && (
                <>
                    <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
                    <aside className="modern-sidebar mobile">
                        {sidebarContent}
                    </aside>
                </>
            )}

            <main className={`modern-content ${collapsed ? 'expanded' : ''}`}>
                <Outlet />
            </main>

            <MobileBottomNav />
        </div>
    )
}

// StrictModeDroppable for React 18+ Compatibility
const StrictModeDroppable = ({
    children,
    direction = "vertical",
    isDropDisabled = false,
    isCombineEnabled = false,
    ignoreContainerClipping = false,
    ...props
}) => {
    const [enabled, setEnabled] = useState(false)
    useEffect(() => {
        const animation = requestAnimationFrame(() => setEnabled(true))
        return () => {
            cancelAnimationFrame(animation)
            setEnabled(false)
        }
    }, [])
    if (!enabled) return null
    return (
        <Droppable
            direction={direction}
            isDropDisabled={isDropDisabled}
            isCombineEnabled={isCombineEnabled}
            ignoreContainerClipping={ignoreContainerClipping}
            {...props}
        >
            {children}
        </Droppable>
    )
}
