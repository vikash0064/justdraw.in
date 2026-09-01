import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Users, Clock, Settings, Sun, Moon, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getInitials, getAvatarColor } from '../../utils/helpers';

export default function Sidebar({ activeTab, onTabChange }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isJoinPage = location.pathname === '/join' || location.pathname.startsWith('/join/');
  const isDashboard = location.pathname === '/dashboard';

  const handleNav = (tab, path) => {
    if (onTabChange) {
      onTabChange(tab);
    }
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  return (
    <aside className="sidebar glass">
      <div className="sidebar-top">
        <div
          className="sidebar-logo"
          onClick={() => navigate('/dashboard')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="26" height="26">
              <circle cx="6" cy="6" r="4.2" fill="#6366f1" />
              <rect x="13.5" y="2" width="8.5" height="8.5" rx="2" fill="#f43f5e" />
              <path d="M 6 13.5 L 10.5 22 L 1.5 22 Z" fill="#10b981" />
              <circle cx="18" cy="18" r="4.2" fill="#f59e0b" />
            </svg>
          </div>
          <span className="sidebar-brand brand-logo-text" style={{ fontSize: '1.35rem' }}>
            <span className="brand-j-box">
              <span className="brand-j-char">j</span>
              <span className="brand-j-sparkle" aria-hidden="true">✦</span>
            </span>
            <span className="brand-rest-ust">ust</span>
            <span className="brand-rest-draw">draw</span>
          </span>
        </div>

        <nav className="sidebar-nav">
          <a
            className={`sidebar-link ${isDashboard && activeTab === 'workspaces' ? 'active' : ''}`}
            onClick={() => handleNav('workspaces', '/dashboard')}
          >
            <Layout size={18} />
            <span>Workspaces</span>
          </a>

          <a
            className={`sidebar-link ${isJoinPage ? 'active' : ''}`}
            onClick={() => handleNav('join', '/join')}
          >
            <Users size={18} />
            <span>Join Room</span>
          </a>

          <a
            className={`sidebar-link ${isDashboard && activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => {
              if (isDashboard && onTabChange) {
                onTabChange('recent');
              } else {
                navigate('/dashboard', { state: { tab: 'recent' } });
              }
            }}
          >
            <Clock size={18} />
            <span>Recent</span>
          </a>

          <a
            className={`sidebar-link ${isDashboard && activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              if (isDashboard && onTabChange) {
                onTabChange('settings');
              } else {
                navigate('/dashboard', { state: { tab: 'settings' } });
              }
            }}
          >
            <Settings size={18} />
            <span>Settings</span>
          </a>
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="avatar" style={{ background: getAvatarColor(user?.name || 'Guest User') }}>
            {getInitials(user?.name || 'Guest')}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name || 'Guest User'}</span>
            <span className="sidebar-user-email">{user?.email || 'Anonymous'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={toggleTheme} className="btn btn-ghost btn-sm sidebar-logout" data-tooltip="Toggle Theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user ? (
            <button onClick={logout} className="btn btn-ghost btn-sm sidebar-logout" data-tooltip="Logout">
              <LogOut size={16} />
            </button>
          ) : (
            <button onClick={() => navigate('/login')} className="btn btn-ghost btn-sm sidebar-logout" data-tooltip="Sign In">
              <LogIn size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
