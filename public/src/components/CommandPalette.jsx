import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Search,
    Command,
    X,
    ArrowRight,
    LayoutDashboard,
    Users,
    ClipboardList,
    Settings,
    FileText,
    Shield,
    Clock
} from 'lucide-react'
import { useAuth } from '../utils/AuthContext'

const CommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const navigate = useNavigate()
    const inputRef = useRef(null)
    const { user } = useAuth()
    const baseUrl = `/${user?.tenantSlug || user?.businessId || 'bootmarksuperadmin'}`

    const pages = [
        { icon: LayoutDashboard, label: 'Dashboard', path: `${baseUrl}/dashboard`, category: 'Pages' },
        { icon: Users, label: 'Clients', path: `${baseUrl}/clients`, category: 'Pages' },
        { icon: ClipboardList, label: 'Work Orders', path: `${baseUrl}/work-orders`, category: 'Pages' },
        { icon: FileText, label: 'Invoices', path: `${baseUrl}/invoices`, category: 'Pages' },
        { icon: Settings, label: 'Account Settings', path: '/account-settings', category: 'Pages' },
        { icon: Shield, label: 'Security & Audit', path: `${baseUrl}/audit-log`, category: 'Pages' }
    ]

    const actions = [
        { icon: Users, label: 'New Client', path: `${baseUrl}/clients/new`, category: 'Actions', shortcut: '/new-client' },
        { icon: ClipboardList, label: 'New Work Order', path: `${baseUrl}/work-orders/new`, category: 'Actions', shortcut: '/new-wo' },
        { icon: FileText, label: 'New Invoice', path: `${baseUrl}/invoices/new`, category: 'Actions', shortcut: '/new-inv' }
    ]

    const allItems = [...pages, ...actions]

    const filteredItems = allItems.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase())
    )

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(prev => !prev)
            }
            if (e.key === 'Escape') {
                setIsOpen(false)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        if (isOpen) {
            setSearch('')
            setActiveIndex(0)
            setTimeout(() => inputRef.current?.focus(), 10)
        }
    }, [isOpen])

    const handleSelect = (item) => {
        navigate(item.path)
        setIsOpen(false)
    }

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex(prev => (prev + 1) % filteredItems.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length)
        } else if (e.key === 'Enter') {
            if (filteredItems[activeIndex]) {
                handleSelect(filteredItems[activeIndex])
            }
        }
    }

    if (!isOpen) return null

    return (
        <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
            <div className="command-palette-container" onClick={e => e.stopPropagation()}>
                <div className="command-palette-search">
                    <Search className="search-icon" size={18} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search for pages, clients, or type a command..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setActiveIndex(0); }}
                        onKeyDown={onKeyDown}
                    />
                    <div className="search-esc">ESC</div>
                </div>

                <div className="command-palette-results">
                    {filteredItems.length === 0 ? (
                        <div className="no-results">
                            <p>No results found for "{search}"</p>
                        </div>
                    ) : (
                        filteredItems.map((item, index) => (
                            <div
                                key={index}
                                className={`result-item ${index === activeIndex ? 'active' : ''}`}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setActiveIndex(index)}
                            >
                                <div className="result-icon-wrapper">
                                    <item.icon size={16} />
                                </div>
                                <div className="result-info">
                                    <span className="result-label">{item.label}</span>
                                    <span className="result-category">{item.category}</span>
                                </div>
                                {index === activeIndex && (
                                    <div className="result-action">
                                        <span>Go to</span>
                                        <ArrowRight size={14} />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="command-palette-footer">
                    <div className="footer-item">
                        <kbd>↑↓</kbd> <span>to navigate</span>
                    </div>
                    <div className="footer-item">
                        <kbd>↵</kbd> <span>to select</span>
                    </div>
                    <div className="footer-item">
                        <kbd>⌘K</kbd> <span>to close</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CommandPalette
