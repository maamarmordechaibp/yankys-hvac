import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard, Users, Calendar, ClipboardList,
    FileText, Wrench, UserCog, Settings, Shield,
    X, ThermometerSnowflake
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
    const { profile, isAdmin, isManager } = useAuth();
    const location = useLocation();

    const navItems = [
        {
            section: 'Main', items: [
                { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
                { to: '/schedule', icon: Calendar, label: 'Schedule' },
                { to: '/jobs', icon: ClipboardList, label: 'Jobs' },
            ]
        },
        {
            section: 'Management', items: [
                { to: '/customers', icon: Users, label: 'Customers' },
                ...(isManager() ? [{ to: '/proposals', icon: FileText, label: 'Estimates' }, { to: '/invoices', icon: FileText, label: 'Invoices' }] : []),
                { to: '/service-agreements', icon: Wrench, label: 'Service Plans' },
            ]
        },
        ...(isManager() ? [{
            section: 'Team', items: [
                { to: '/technicians', icon: UserCog, label: 'Technicians' },
            ]
        }] : []),
        ...(isAdmin() ? [{
            section: 'Admin', items: [
                { to: '/settings', icon: Settings, label: 'Settings' },
            ]
        }] : []),
    ];

    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <img src="/logo.svg" alt="Yanky's HVAC" style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', objectFit: 'contain' }} />
                    <div className="brand-text">
                        <h1>Yanky's HVAC</h1>
                        <span>Service CRM</span>
                    </div>
                    <button className="mobile-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(section => (
                        <div key={section.section} className="nav-section">
                            <div className="nav-section-title">{section.section}</div>
                            {section.items.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    onClick={onClose}
                                    end={item.to === '/'}
                                >
                                    <item.icon size={20} />
                                    <span>{item.label}</span>
                                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="user-avatar">
                            {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="user-info">
                            <div className="name">{profile?.full_name || 'User'}</div>
                            <div className="role">{profile?.role?.replace('_', ' ') || 'Member'}</div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}

