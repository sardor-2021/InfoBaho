import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sahifa o'zgarganda mobile menuni yopish
  useEffect(() => {
    setMobileMenuOpen(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  // Sahifa almashganda mastery_percent/level yangilash (markaziy yechim)
  useEffect(() => {
    if (user && user.role === 'student') {
      refreshUser();
    }
  }, [location.pathname]);

  // Foydalanuvchi almashganda UI ni reset qilish
  useEffect(() => {
    setShowUserMenu(false);
    setMobileMenuOpen(false);
  }, [user?.id]);

  // Dropdown tashqarisiga bosganda yopish
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showUserMenu && !e.target.closest('.navbar-user')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserMenu]);

  // Body scroll bloklash
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleName = (role) => {
    const roleNames = {
      student: "O'quvchi",
      teacher: "O'qituvchi",
      admin: 'Administrator'
    };
    return roleNames[role] || role;
  };

  const isActive = (path) => location.pathname === path;

  if (!user) {
    return (
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-logo">
            <span className="logo-gradient">InfoBaho</span>
          </Link>
          <div className="navbar-menu">
            <Link to="/login" className="navbar-link">Kirish</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Ro'yxatdan o'tish</Link>
          </div>
        </div>
      </nav>
    );
  }

  const navLinks = [
    { path: '/dashboard', icon: '🏠', label: 'Bosh sahifa', roles: ['student', 'teacher', 'admin'] },
    { path: '/lessons', icon: '📚', label: 'Darslar', roles: ['student', 'teacher', 'admin'] },
    { path: '/results', icon: '📊', label: 'Natijalar', roles: ['student'] },
    { path: '/students', icon: '👥', label: "O'quvchilar", roles: ['teacher', 'admin'] },
    { path: '/journal', icon: '📒', label: 'Jurnal', roles: ['teacher', 'admin'] },
    { path: '/ai-analytics', icon: '🤖', label: 'AI Tahlil', roles: ['teacher', 'admin'] },
    { path: '/forum', icon: '💬', label: 'Forum', roles: ['student', 'teacher', 'admin'] },
    { path: '/experiment', icon: '📊', label: 'Tajriba', roles: ['admin'] },
    { path: '/admin-users', icon: '👥', label: 'Foydalanuvchilar', roles: ['admin'] },
    { path: '/survey', icon: '📋', label: "So'rovnoma", roles: ['student', 'teacher', 'admin'] },
    { path: '/diagnostic', icon: '🔬', label: 'Diagnostika', roles: ['student', 'teacher', 'admin'] },
    { path: '/leaderboard', icon: '🏆', label: 'Reyting', roles: ['student', 'teacher', 'admin'] },
  ];

  const filteredLinks = navLinks.filter(link => link.roles.includes(user.role));

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/dashboard" className="navbar-logo">
            <span className="logo-gradient">InfoBaho</span>
          </Link>

          {/* Desktop Menu */}
          <div className="navbar-menu navbar-desktop">
            {filteredLinks.map(link => (
              <Link key={link.path} to={link.path}
                className={`navbar-link ${isActive(link.path) ? 'active' : ''}`}>
                <span className="nav-icon">{link.icon}</span>
                {link.label}
              </Link>
            ))}

            <div className="navbar-user">
              <div className="user-menu-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="user-avatar-gradient">{user.full_name.charAt(0).toUpperCase()}</div>
                <div className="user-details">
                  <span className="user-name">{user.full_name}</span>
                  <span className="user-role">{getRoleName(user.role)}</span>
                </div>
                {user.role === 'student' && (
                  <div className="user-stats-inline">
                    <span className="points-badge-small">📊 {user.mastery_percent || 0}%</span>
                  </div>
                )}
                <span className="dropdown-arrow">▼</span>
              </div>

              {showUserMenu && (
                <div className="user-dropdown">
                  <Link to="/profile" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                    <span className="dropdown-icon">👤</span>
                    Profil
                  </Link>
                  {user.role === 'student' && (
                    <Link to="/portfolio" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                      <span className="dropdown-icon">💼</span>
                      Portfolio
                    </Link>
                  )}
                  <div className="dropdown-divider"></div>
                  <button onClick={handleLogout} className="dropdown-item logout-item">
                    <span className="dropdown-icon">🚪</span>
                    Chiqish
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            className={`hamburger-btn ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Menu Sidebar */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        {/* User Info */}
        <div className="mobile-user-section">
          <div className="mobile-user-avatar">{user.full_name.charAt(0).toUpperCase()}</div>
          <div className="mobile-user-info">
            <span className="mobile-user-name">{user.full_name}</span>
            <span className="mobile-user-role">{getRoleName(user.role)}</span>
          </div>
          {user.role === 'student' && (
            <span className="mobile-points">📊 {user.mastery_percent || 0}%</span>
          )}
        </div>

        {/* Nav Links */}
        <div className="mobile-nav-links">
          {filteredLinks.map(link => (
            <Link key={link.path} to={link.path}
              className={`mobile-nav-link ${isActive(link.path) ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}>
              <span className="mobile-nav-icon">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>

        {/* Additional Links */}
        <div className="mobile-extra-links">
          <Link to="/profile" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
            <span className="mobile-nav-icon">👤</span>
            <span>Profil</span>
          </Link>
          {user.role === 'student' && (
            <Link to="/portfolio" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
              <span className="mobile-nav-icon">💼</span>
              <span>Portfolio</span>
            </Link>
          )}
        </div>

        {/* Logout */}
        <button className="mobile-logout-btn" onClick={handleLogout}>
          <span>🚪</span>
          <span>Chiqish</span>
        </button>
      </div>
    </>
  );
};

export default Navbar;
