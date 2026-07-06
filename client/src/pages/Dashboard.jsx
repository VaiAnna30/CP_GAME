import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useMatchStore from '../stores/matchStore';
import api from '../services/api';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { matches, fetchMatches } = useMatchStore();
  const [cfVerifying, setCfVerifying] = useState(false);
  const [cfHandle, setCfHandle] = useState('');
  const [cfMessage, setCfMessage] = useState('');
  const [cfStep, setCfStep] = useState(user?.cfHandleVerified ? 'verified' : 'input');
  const [recentMatches, setRecentMatches] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMatches();
    loadRecentMatches();
  }, []);

  const loadRecentMatches = async () => {
    try {
      const data = await api.get(`/users/${user?.id}/matches?limit=5`);
      setRecentMatches(data.matches || []);
    } catch (err) {
      // Silent fail for match history
    }
  };

  const handleVerifyCF = async () => {
    setCfVerifying(true);
    setCfMessage('');
    try {
      const data = await api.post('/auth/verify-cf', { cfHandle });
      setCfMessage(data.message);
      setCfStep('confirm');
    } catch (err) {
      setCfMessage(err.message);
    }
    setCfVerifying(false);
  };

  const handleConfirmCF = async () => {
    setCfVerifying(true);
    setCfMessage('');
    try {
      const data = await api.post('/auth/confirm-cf');
      setCfMessage(data.message);
      setCfStep('verified');
      useAuthStore.getState().fetchCurrentUser();
    } catch (err) {
      setCfMessage(err.message);
    }
    setCfVerifying(false);
  };

  return (
    <div className="page page-enter">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1>Welcome, {user?.username} 👋</h1>
            <p>Your command center for CF Battle Royale</p>
          </div>
          <Link to="/lobby" className="btn btn-primary">
            Find a Match
          </Link>
        </div>

        <div className="dashboard-grid">
          {/* Stats Overview */}
          <div className="card dashboard-stats">
            <div className="card-header">
              <span className="card-title">Your Stats</span>
              <span className="text-secondary text-sm">Your Stats</span>
            </div>
            <div className="stats-row">
              <div className="stat-box">
                <span className="stat-value">{user?.stats?.matchesPlayed || 0}</span>
                <span className="stat-label">Matches</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{user?.stats?.matchesWon || 0}</span>
                <span className="stat-label">Wins</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{user?.stats?.totalSolves || 0}</span>
                <span className="stat-label">Solves</span>
              </div>

            </div>
          </div>

          {/* CF Handle Verification */}
          {cfStep !== 'verified' && (
            <div className="card cf-verify-card">
              <div className="card-header">
                <span className="card-title">🔗 Link Codeforces Handle</span>
              </div>
              <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
                Link your Codeforces handle to participate in matches.
              </p>

              {cfStep === 'input' && (
                <div className="cf-verify-form">
                  <input
                    id="cf-handle-input"
                    className="form-input"
                    placeholder="Your Codeforces handle"
                    value={cfHandle}
                    onChange={(e) => setCfHandle(e.target.value)}
                  />
                  <button
                    id="cf-verify-btn"
                    className={`btn btn-primary ${cfVerifying ? 'loading' : ''}`}
                    onClick={handleVerifyCF}
                    disabled={!cfHandle || cfVerifying}
                  >
                    {cfVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              )}

              {cfStep === 'confirm' && (
                <div className="cf-verify-steps">
                  <div className="cf-step">
                    <span className="cf-step-number">1</span>
                    <span>Submit a <strong>Compilation Error</strong> solution to the verification problem on Codeforces</span>
                  </div>
                  <div className="cf-step">
                    <span className="cf-step-number">2</span>
                    <span>Click "Confirm" below after submitting</span>
                  </div>
                  <button
                    id="cf-confirm-btn"
                    className={`btn btn-primary ${cfVerifying ? 'loading' : ''}`}
                    onClick={handleConfirmCF}
                    disabled={cfVerifying}
                  >
                    {cfVerifying ? 'Checking...' : 'Confirm Verification'}
                  </button>
                </div>
              )}

              {cfMessage && (
                <p className={`cf-message ${cfStep === 'verified' ? 'text-success' : ''}`}>
                  {cfMessage}
                </p>
              )}
            </div>
          )}

          {cfStep === 'verified' && (
            <div className="card cf-verified-card">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '24px' }}>✅</span>
                <div>
                  <div className="card-title">Codeforces Linked</div>
                  <div className="flex items-center gap-2">
                    <span className="mono text-accent">{user?.cfHandle}</span>
                    {user?.cfProfile?.rating > 0 && (
                      <span className="badge badge-primary mono">
                        {user.cfProfile.rating}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}



          {/* Open Matches */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Open Matches</span>
              <Link to="/lobby" className="btn btn-ghost btn-sm">See All →</Link>
            </div>
            {matches.filter(m => m.status === 'waiting').length === 0 ? (
              <div className="empty-state-mini">
                <p className="text-secondary">No open matches right now</p>
                <Link to="/lobby" className="btn btn-secondary btn-sm">Create a Match</Link>
              </div>
            ) : (
              <div className="match-list">
                {matches.filter(m => m.status === 'waiting').slice(0, 3).map((match) => (
                  <div key={match._id} className="match-row" onClick={() => navigate(`/match/${match._id}`)}>
                    <div className="match-info">
                      <span className="badge badge-warning">{match.gridSize}×{match.gridSize}</span>
                      <span>{match.teams[0]?.teamName || 'Team'} waiting...</span>
                    </div>
                    <span className="badge badge-primary">Join</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Matches */}
          <div className="card dashboard-recent">
            <div className="card-header">
              <span className="card-title">Recent Matches</span>
            </div>
            {recentMatches.length === 0 ? (
              <div className="empty-state-mini">
                <p className="text-secondary">No match history yet. Play your first game!</p>
              </div>
            ) : (
              <div className="match-list">
                {recentMatches.map((match) => {
                  const userTeam = match.teams.find(t =>
                    t.players.some(p => p._id === user?.id || p === user?.id)
                  );
                  const won = userTeam?.color === match.winner;
                  const draw = match.winner === 'draw';

                  return (
                    <div key={match._id} className="match-row" onClick={() => navigate(`/match/${match._id}`)}>
                      <div className="match-info">
                        <span className={`badge ${won ? 'badge-success' : draw ? 'badge-warning' : 'badge-error'}`}>
                          {won ? 'WIN' : draw ? 'DRAW' : 'LOSS'}
                        </span>
                        <span>
                          {match.teams.map(t => t.teamName || t.teamTag).join(' vs ')}
                        </span>
                      </div>
                      <span className="text-secondary text-sm">
                        {match.gridSize}×{match.gridSize}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
