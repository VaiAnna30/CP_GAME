import { useState, useEffect } from 'react';
import api from '../services/api';
import './Leaderboard.css';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('elo');

  useEffect(() => {
    loadLeaderboard();
  }, [sortBy]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/users/leaderboard/global?sort=${sortBy}&limit=50`);
      setUsers(data.leaderboard || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="page page-enter">
      <div className="container container-md" style={{ paddingTop: 'var(--space-8)' }}>
        <div className="page-header">
          <h1>🏆 Leaderboard</h1>
          <p>Top CF Battle Royale competitors</p>
        </div>

        <div className="leaderboard-controls">
          <div className="tabs">
            <button className={`tab ${sortBy === 'elo' ? 'active' : ''}`} onClick={() => setSortBy('elo')}>
              ELO Rating
            </button>
            <button className={`tab ${sortBy === 'wins' ? 'active' : ''}`} onClick={() => setSortBy('wins')}>
              Total Wins
            </button>
            <button className={`tab ${sortBy === 'matches' ? 'active' : ''}`} onClick={() => setSortBy('matches')}>
              Matches Played
            </button>
          </div>
        </div>

        <div className="card leaderboard-card">
          {loading ? (
            <div className="text-center" style={{ padding: 'var(--space-10)' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto', borderWidth: 3 }}></div>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏆</div>
              <h3>No Rankings Yet</h3>
              <p>Play some matches to appear on the leaderboard!</p>
            </div>
          ) : (
            <div className="leaderboard-table">
              <div className="lb-header-row">
                <span className="lb-rank">#</span>
                <span className="lb-player">Player</span>
                <span className="lb-cf">CF Handle</span>
                <span className="lb-stat">ELO</span>
                <span className="lb-stat">W/L</span>
                <span className="lb-stat">Win Rate</span>
              </div>
              {users.map((u, i) => {
                const winRate = u.stats?.matchesPlayed > 0
                  ? ((u.stats.matchesWon / u.stats.matchesPlayed) * 100).toFixed(0)
                  : 0;
                return (
                  <div key={u._id} className={`lb-row ${i < 3 ? `lb-top-${i + 1}` : ''}`}>
                    <span className="lb-rank">
                      {i === 0 && '🥇'}
                      {i === 1 && '🥈'}
                      {i === 2 && '🥉'}
                      {i > 2 && (i + 1)}
                    </span>
                    <span className="lb-player">
                      <div className="avatar avatar-sm">
                        <span className="avatar-initials">{u.username?.[0]?.toUpperCase()}</span>
                      </div>
                      <span className="font-semibold">{u.username}</span>
                    </span>
                    <span className="lb-cf mono">{u.cfHandle || '—'}</span>
                    <span className="lb-stat mono font-bold" style={{ color: 'var(--accent-primary)' }}>
                      {u.stats?.eloRating || 1200}
                    </span>
                    <span className="lb-stat">
                      <span className="text-success">{u.stats?.matchesWon || 0}</span>
                      <span className="text-tertiary">/</span>
                      <span className="text-error">{(u.stats?.matchesPlayed || 0) - (u.stats?.matchesWon || 0)}</span>
                    </span>
                    <span className="lb-stat mono">{winRate}%</span>
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
