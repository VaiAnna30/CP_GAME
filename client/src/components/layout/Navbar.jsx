import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import './Navbar.css';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'var(--accent-primary)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>CF</div>
            <span className="logo-text">CF Battle Royale</span>
          </div>
        </Link>

        {isAuthenticated && (
          <div className="navbar-links">
            <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link to="/teams" className={`nav-link ${location.pathname === '/teams' ? 'active' : ''}`}>
              Teams
            </Link>
            <Link to="/lobby" className={`nav-link ${location.pathname === '/lobby' ? 'active' : ''}`}>
              Play
            </Link>
            <Link to="/leaderboard" className={`nav-link ${location.pathname === '/leaderboard' ? 'active' : ''}`}>
              Leaderboard
            </Link>
          </div>
        )}

        <div className="navbar-right">
          {isAuthenticated ? (
            <div className="navbar-user">
              <Link to="/profile" className="navbar-profile">
                <div className="avatar avatar-sm">
                  <span className="avatar-initials">
                    {user?.username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <span className="navbar-username">{user?.username}</span>
              </Link>
              {user?.cfHandle && (
                <span className="navbar-cf-handle">
                  {user.cfHandle}
                  {user.cfHandleVerified && <span className="verified-check">✓</span>}
                </span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <div className="navbar-auth">
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}

          <button
            className={`navbar-toggle ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="navbar-mobile">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="mobile-link">Dashboard</Link>
              <Link to="/teams" className="mobile-link">Teams</Link>
              <Link to="/lobby" className="mobile-link">Play</Link>
              <Link to="/leaderboard" className="mobile-link">Leaderboard</Link>
              <Link to="/profile" className="mobile-link">Profile</Link>
              <button className="btn btn-ghost w-full" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="mobile-link">Login</Link>
              <Link to="/register" className="mobile-link">Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
