import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useTeamStore from '../stores/teamStore';
import useMatchStore from '../stores/matchStore';
import './Lobby.css';

export default function Lobby() {
  const { user } = useAuthStore();
  const { teams, fetchMyTeams } = useTeamStore();
  const { matches, fetchMatches, createMatch, joinMatch, loading } = useMatchStore();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [gridSize, setGridSize] = useState(3);
  const [minRating, setMinRating] = useState(800);
  const [maxRating, setMaxRating] = useState(1800);
  const [timeLimit, setTimeLimit] = useState(60);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchMyTeams();
    fetchMatches('waiting');
    const interval = setInterval(() => fetchMatches('waiting'), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    setCreateError('');
    if (!selectedTeam) {
      setCreateError('Select a team first');
      return;
    }
    try {
      const match = await createMatch(selectedTeam, gridSize, {
        difficultyRange: { min: minRating, max: maxRating },
        timeLimitMinutes: timeLimit,
      });
      navigate(`/match/${match._id}`);
    } catch (err) {
      setCreateError(err.message);
    }
  };

  const handleJoin = async (matchId) => {
    if (!selectedTeam) {
      alert('Select a team first from the "Create Match" panel');
      return;
    }
    try {
      await joinMatch(matchId, selectedTeam);
      navigate(`/match/${matchId}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const waitingMatches = matches.filter((m) => m.status === 'waiting');

  return (
    <div className="page page-enter">
      <div className="container">
        <div className="lobby-header" style={{ paddingTop: 'var(--space-8)' }}>
          <div>
            <h1>Battle Lobby</h1>
            <p>Create a match or join an open game</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close' : '+ Create Match'}
          </button>
        </div>

        {/* Create Match Panel */}
        {showCreate && (
          <div className="card create-match-card">
            <h3 style={{ marginBottom: 'var(--space-5)' }}>Create New Match</h3>
            {createError && <div className="auth-error"> {createError}</div>}

            <div className="create-match-grid">
              <div className="form-group">
                <label className="form-label">Select Team</label>
                <select className="form-input" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
                  <option value="">Choose a team...</option>
                  {teams.map((t) => (
                    <option key={t._id} value={t._id}>[{t.tag}] {t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Grid Size</label>
                <select className="form-input" value={gridSize} onChange={(e) => setGridSize(parseInt(e.target.value))}>
                  <option value={3}>3 × 3 (Classic)</option>
                  <option value={4}>4 × 4</option>
                  <option value={5}>5 × 5</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Min Problem Rating</label>
                <input type="number" className="form-input mono" value={minRating} onChange={(e) => setMinRating(parseInt(e.target.value))} min={800} max={3500} step={100} />
              </div>

              <div className="form-group">
                <label className="form-label">Max Problem Rating</label>
                <input type="number" className="form-input mono" value={maxRating} onChange={(e) => setMaxRating(parseInt(e.target.value))} min={800} max={3500} step={100} />
              </div>

              <div className="form-group">
                <label className="form-label">Time Limit (minutes)</label>
                <input type="number" className="form-input mono" value={timeLimit} onChange={(e) => setTimeLimit(parseInt(e.target.value))} min={10} max={180} step={5} />
              </div>
            </div>

            <button className={`btn btn-primary btn-lg ${loading ? 'loading' : ''}`} onClick={handleCreate} disabled={loading} style={{ marginTop: 'var(--space-5)' }}>
              {loading ? 'Creating...' : 'Create Match'}
            </button>
          </div>
        )}

        {/* Team Selection for Joining */}
        {!showCreate && teams.length > 0 && (
          <div className="team-select-bar">
            <span className="text-secondary">Playing as:</span>
            <select className="form-input" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Select team to join...</option>
              {teams.map((t) => (
                <option key={t._id} value={t._id}>[{t.tag}] {t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Open Matches */}
        <div className="lobby-section">
          <h2 className="lobby-section-title">
            Open Matches
            <span className="badge badge-primary">{waitingMatches.length}</span>
          </h2>

          {waitingMatches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect><path d="M6 12h4"></path><path d="M8 10v4"></path><path d="M15 13h.01"></path><path d="M18 11h.01"></path></svg>
              </div>
              <h3>No Open Matches</h3>
              <p>Be the first to create one! Click "Create Match" above.</p>
            </div>
          ) : (
            <div className="lobby-matches-grid">
              {waitingMatches.map((match) => (
                <div key={match._id} className="card lobby-match-card">
                  <div className="lobby-match-header">
                    <div className="flex items-center gap-3">
                      <span className="badge badge-warning mono">{match.gridSize}×{match.gridSize}</span>
                      <div>
                        <div className="font-semibold">{match.teams[0]?.teamName}</div>
                        <span className="badge badge-red mono text-sm">[{match.teams[0]?.teamTag}]</span>
                      </div>
                    </div>
                    <div className="live-indicator">Waiting</div>
                  </div>

                  <div className="lobby-match-details">
                    <div className="lobby-detail">
                      <span className="text-secondary">Rating Range</span>
                      <span className="mono">{match.settings?.difficultyRange?.min}–{match.settings?.difficultyRange?.max}</span>
                    </div>
                    <div className="lobby-detail">
                      <span className="text-secondary">Time Limit</span>
                      <span className="mono">{match.settings?.timeLimitMinutes}min</span>
                    </div>
                    <div className="lobby-detail">
                      <span className="text-secondary">Players</span>
                      <span>{match.teams[0]?.players?.length || 0} per team</span>
                    </div>
                  </div>

                  <button className="btn btn-blue w-full" onClick={() => handleJoin(match._id)} disabled={!selectedTeam}>
                    {selectedTeam ? 'Join Match' : 'Select team first'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
