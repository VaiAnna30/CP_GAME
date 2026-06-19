import { useState, useEffect } from 'react';
import useTeamStore from '../stores/teamStore';
import useAuthStore from '../stores/authStore';
import './Teams.css';

export default function Teams() {
  const { user } = useAuthStore();
  const { teams, loading, error, fetchMyTeams, createTeam, joinTeam, deleteTeam, clearError } = useTeamStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamTag, setTeamTag] = useState('');
  const [maxSize, setMaxSize] = useState(3);
  const [inviteCode, setInviteCode] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchMyTeams();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    clearError();
    try {
      await createTeam(teamName, teamTag, maxSize);
      setShowCreate(false);
      setTeamName('');
      setTeamTag('');
      useAuthStore.getState().fetchCurrentUser();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setFormError('');
    clearError();
    try {
      await joinTeam(inviteCode);
      setShowJoin(false);
      setInviteCode('');
      useAuthStore.getState().fetchCurrentUser();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team?')) return;
    try {
      await deleteTeam(teamId);
      useAuthStore.getState().fetchCurrentUser();
    } catch (err) {
      alert(err.message);
    }
  };

  const copyInvite = (code) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="page page-enter">
      <div className="container">
        <div className="page-header" style={{ paddingTop: 'var(--space-8)' }}>
          <div className="flex justify-between items-center">
            <div>
              <h1>Teams</h1>
              <p>Create and manage your battle squads</p>
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary" onClick={() => { setShowJoin(true); setShowCreate(false); }}>
                Join Team
              </button>
              <button className="btn btn-primary" onClick={() => { setShowCreate(true); setShowJoin(false); }}>
                + Create Team
              </button>
            </div>
          </div>
        </div>

        {/* Create Team Modal */}
        {showCreate && (
          <div className="card team-form-card" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>Create New Team</h3>
            {formError && <div className="auth-error"> {formError}</div>}
            <form onSubmit={handleCreate} className="team-form">
              <div className="form-group">
                <label className="form-label">Team Name</label>
                <input className="form-input" placeholder="e.g., Code Warriors" value={teamName} onChange={e => setTeamName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Team Tag (2-5 chars)</label>
                <input className="form-input" placeholder="e.g., CW" value={teamTag} onChange={e => setTeamTag(e.target.value)} maxLength={5} minLength={2} required style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Max Team Size</label>
                <select className="form-input" value={maxSize} onChange={e => setMaxSize(parseInt(e.target.value))}>
                  <option value={1}>1 (Solo)</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Team'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Join Team */}
        {showJoin && (
          <div className="card team-form-card" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>Join a Team</h3>
            {formError && <div className="auth-error"> {formError}</div>}
            <form onSubmit={handleJoin} className="team-form">
              <div className="form-group">
                <label className="form-label">Invite Code</label>
                <input className="form-input" placeholder="Enter invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Joining...' : 'Join Team'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowJoin(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Teams List */}
        {teams.length === 0 && !showCreate && !showJoin ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <h3>No Teams Yet</h3>
            <p>Create a team to start competing in CF Battle Royale matches.</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="teams-grid">
            {teams.map((team) => (
              <div key={team._id} className="card team-card">
                <div className="team-card-header">
                  <div className="flex items-center gap-3">
                    <div className="team-avatar">
                      <span>{team.tag?.[0]}</span>
                    </div>
                    <div>
                      <h3 className="team-card-name">{team.name}</h3>
                      <span className="badge badge-primary mono">[{team.tag}]</span>
                    </div>
                  </div>
                  {team.captainId?._id === user?.id || team.captainId === user?.id ? (
                    <span className="badge badge-warning">Captain</span>
                  ) : null}
                </div>

                <div className="team-card-stats">
                  <div className="stat-box">
                    <span className="stat-value">{team.members?.length || 0}/{team.maxSize}</span>
                    <span className="stat-label">Members</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-value">{team.stats?.matchesPlayed || 0}</span>
                    <span className="stat-label">Matches</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-value">{team.stats?.matchesWon || 0}</span>
                    <span className="stat-label">Wins</span>
                  </div>
                </div>

                <div className="team-members">
                  <span className="form-label">Members</span>
                  <div className="member-list">
                    {team.members?.map((member) => (
                      <div key={member._id} className="member-chip">
                        <div className="avatar avatar-sm">
                          <span className="avatar-initials">{member.username?.[0]?.toUpperCase()}</span>
                        </div>
                        <span>{member.username}</span>
                        {member.cfHandle && <span className="mono text-tertiary">({member.cfHandle})</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-footer">
                  <div className="flex items-center gap-2">
                    <span className="text-secondary text-sm">Invite:</span>
                    <code className="invite-code mono">{team.inviteCode}</code>
                    <button className="btn btn-ghost btn-sm" onClick={() => copyInvite(team.inviteCode)} title="Copy">
                      Copy
                    </button>
                  </div>
                  {(team.captainId?._id === user?.id || team.captainId === user?.id) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(team._id)} style={{ color: 'var(--error)' }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
