import { Link } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import './Home.css';

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-grid-bg"></div>
          <div className="hero-glow hero-glow-1"></div>
          <div className="hero-glow hero-glow-2"></div>
        </div>

        <div className="container hero-content">


          <h1 className="hero-title">
            Competitive Programming
            <br />
            Meets <span className="gradient-text">Battle Royale</span>
          </h1>

          <p className="hero-description">
            Build your team, claim the board, and race to solve Codeforces problems
            in a real-time tic-tac-toe showdown. First team to complete a line wins.
          </p>

          <div className="hero-actions">
            {isAuthenticated ? (
              <>
                <Link to="/lobby" className="btn btn-primary btn-lg">
                  Find a Match
                </Link>
                <Link to="/dashboard" className="btn btn-secondary btn-lg">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">
                  Get Started — Free
                </Link>
                <Link to="/login" className="btn btn-secondary btn-lg">
                  Login
                </Link>
              </>
            )}
          </div>

          {/* Animated Board Preview */}
          <div className="hero-board-preview">
            <div className="preview-board">
              {[
                { claimed: 'red', rating: 1400 },
                { claimed: null, rating: 1100 },
                { claimed: 'blue', rating: 1600 },
                { claimed: null, rating: 900 },
                { claimed: 'red', rating: 1200 },
                { claimed: null, rating: 1800 },
                { claimed: 'blue', rating: 1000 },
                { claimed: 'red', rating: 1500 },
                { claimed: 'blue', rating: 1300 },
              ].map((cell, i) => (
                <div
                  key={i}
                  className={`preview-cell ${cell.claimed ? `claimed-${cell.claimed}` : 'unclaimed'}`}
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  <span className="preview-rating mono">{cell.rating}</span>
                  {cell.claimed === 'red' && <span className="preview-mark mark-red">✕</span>}
                  {cell.claimed === 'blue' && <span className="preview-mark mark-blue">○</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header text-center">
            <h2>How It Works</h2>
            <p>Three steps to your first battle</p>
          </div>

          <div className="features-grid">
            <div className="feature-card card">
              <div className="feature-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <h3>Build Your Team</h3>
              <p>
                Create or join a team, link your Codeforces handle, and invite
                your competitive programming friends.
              </p>
            </div>

            <div className="feature-card card">
              <div className="feature-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
              </div>
              <h3>Enter the Arena</h3>
              <p>
                Create a match or join an open lobby. The board auto-generates
                with problems matched to your team's skill level.
              </p>
            </div>

            <div className="feature-card card">
              <div className="feature-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              </div>
              <h3>Race to Win</h3>
              <p>
                Solve problems on Codeforces. The moment you get AC, the cell
                is yours. First team to complete a line wins!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value mono">NxN</span>
              <span className="stat-label">Grid Sizes</span>
            </div>
            <div className="stat-item">
              <span className="stat-value mono">Real-time</span>
              <span className="stat-label">WebSocket Updates</span>
            </div>
            <div className="stat-item">
              <span className="stat-value mono">800–2500</span>
              <span className="stat-label">Rating Range</span>
            </div>
            <div className="stat-item">
              <span className="stat-value mono">∞</span>
              <span className="stat-label">Problems Available</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container text-center">
          <h2>Ready to Battle?</h2>
          <p>Join the competitive programming revolution. Build your team and start winning.</p>
          {!isAuthenticated && (
            <Link to="/register" className="btn btn-primary btn-lg">
              Create Free Account
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'var(--accent-primary)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>CF</div>
              <span>CF Battle Royale</span>
            </div>
            <p className="footer-note">
              Built for the competitive programming community.
              Powered by the Codeforces API.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
