import { useEffect, useState } from 'react';
import useAuthStore from '../stores/authStore';
import api from '../services/api';
import './Profile.css';

export default function Profile() {
  const { user } = useAuthStore();
  const [recentMatches, setRecentMatches] = useState([]);

  useEffect(() => {
    if (user?.id) {
      api.get(`/users/${user.id}/matches?limit=10`).then(data => {
        setRecentMatches(data.matches || []);
      }).catch(() => {});
    }
  }, [user?.id]);

  const winRate = user?.stats?.matchesPlayed > 0
    ? ((user.stats.matchesWon / user.stats.matchesPlayed) * 100).toFixed(1)
    : 0;

  return (
    <div className="page page-enter">
      <div className="container container-md" style={{ paddingTop: 'var(--space-8)' }}>
        {/* Profile Header */}
        <div className="profile-header card">
          <div className="profile-avatar-section">
            <div className="avatar avatar-xl">
              <span className="avatar-initials" style={{ fontSize: 'var(--fs-2xl)' }}>
                {user?.username?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="profile-info">
              <h1>{user?.username}</h1>
              <p className="text-secondary">{user?.email}</p>
              {user?.cfHandleVerified && (
                <div className="profile-cf-info">
                  <span className="mono text-accent">{user.cfHandle}</span>
                  <span className="verified-check">✓ Verified</span>
                  {user.cfProfile?.rating > 0 && (
                    <span className="badge badge-primary mono">{user.cfProfile.rating}</span>
                  )}
                  {user.cfProfile?.rank && (
                    <span className="badge badge-secondary">{user.cfProfile.rank}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats-grid">
          <div className="card stat-card">
            <span className="stat-value mono">{user?.stats?.matchesPlayed || 0}</span>
            <span className="stat-label">Matches Played</span>
          </div>
          <div className="card stat-card">
            <span className="stat-value mono" style={{ color: 'var(--success)' }}>{user?.stats?.matchesWon || 0}</span>
            <span className="stat-label">Matches Won</span>
          </div>
          <div className="card stat-card">
            <span className="stat-value mono">{winRate}%</span>
            <span className="stat-label">Win Rate</span>
          </div>
          <div className="card stat-card">
            <span className="stat-value mono">{user?.stats?.totalSolves || 0}</span>
            <span className="stat-label">Total Solves</span>
          </div>
          <div className="card stat-card">
            <span className="stat-value mono" style={{ color: 'var(--accent-primary)' }}>{user?.stats?.eloRating || 1200}</span>
            <span className="stat-label">ELO Rating</span>
          </div>
          <div className="card stat-card">
            <span className="stat-value mono">{user?.teams?.length || 0}</span>
            <span className="stat-label">Teams</span>
          </div>
        </div>

        {/* Match History */}
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <div className="card-header">
            <span className="card-title">Match History</span>
          </div>
          {recentMatches.length === 0 ? (
            <div className="empty-state-mini">
              <p className="text-secondary">No matches played yet</p>
            </div>
          ) : (
            <div className="match-history-list">
              {recentMatches.map((match) => {
                const userTeam = match.teams.find(t =>
                  t.players.some(p => (p._id || p) === user?.id)
                );
                const won = userTeam?.color === match.winner;
                const draw = match.winner === 'draw';

                return (
                  <div key={match._id} className="history-row">
                    <span className={`badge ${won ? 'badge-success' : draw ? 'badge-warning' : 'badge-error'}`}>
                      {won ? 'WIN' : draw ? 'DRAW' : 'LOSS'}
                    </span>
                    <span className="history-teams">
                      {match.teams.map(t => t.teamName || t.teamTag).join(' vs ')}
                    </span>
                    <span className="badge badge-primary mono">{match.gridSize}×{match.gridSize}</span>
                    <span className="history-date text-secondary">
                      {new Date(match.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
