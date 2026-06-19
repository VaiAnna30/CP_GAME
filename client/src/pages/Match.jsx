import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useMatchStore from '../stores/matchStore';
import socketService from '../services/socket';
import './Match.css';

export default function Match() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentMatch, activityFeed, fetchMatch, toggleReady, forfeitMatch,
    updateCell, addActivityEntry, endMatch, updateMatchState, clearMatch,
  } = useMatchStore();

  const [timer, setTimer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [winningLine, setWinningLine] = useState(null);

  // Fetch match and join socket room
  useEffect(() => {
    fetchMatch(id);
    socketService.connect();
    socketService.joinMatch(id);

    return () => {
      socketService.leaveMatch(id);
      clearMatch();
    };
  }, [id]);

  // Socket event listeners
  useEffect(() => {
    const handleCellClaimed = (data) => {
      updateCell(data);
      addActivityEntry({
        type: 'cell_claimed',
        username: data.username || data.cfHandle,
        color: data.color,
        problemName: data.problemName,
        problemRating: data.problemRating,
        time: new Date().toLocaleTimeString(),
      });
    };

    const handleMatchStarted = (data) => {
      fetchMatch(id);
    };

    const handleMatchEnded = (data) => {
      endMatch(data);
      setWinningLine(data.winningLine);
      setTimeout(() => setShowResult(true), 1000);
    };

    const handleReadyUpdate = (data) => {
      updateMatchState(data.match);
    };

    const handleTeamJoined = (data) => {
      updateMatchState(data.match);
    };

    const handleMatchState = (match) => {
      updateMatchState(match);
    };

    socketService.on('cell_claimed', handleCellClaimed);
    socketService.on('match_started', handleMatchStarted);
    socketService.on('match_ended', handleMatchEnded);
    socketService.on('ready_update', handleReadyUpdate);
    socketService.on('team_joined', handleTeamJoined);
    socketService.on('match_state', handleMatchState);

    return () => {
      socketService.off('cell_claimed', handleCellClaimed);
      socketService.off('match_started', handleMatchStarted);
      socketService.off('match_ended', handleMatchEnded);
      socketService.off('ready_update', handleReadyUpdate);
      socketService.off('team_joined', handleTeamJoined);
      socketService.off('match_state', handleMatchState);
    };
  }, [id]);

  // Timer
  useEffect(() => {
    if (currentMatch?.status !== 'in_progress' || !currentMatch?.startedAt) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - new Date(currentMatch.startedAt).getTime()) / 1000;
      const remaining = (currentMatch.settings?.timeLimitMinutes || 60) * 60 - elapsed;
      setTimer(Math.max(0, Math.floor(remaining)));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentMatch?.status, currentMatch?.startedAt]);

  const handleReady = async () => {
    try {
      await toggleReady(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleForfeit = async () => {
    if (!window.confirm('Are you sure you want to forfeit this match?')) return;
    try {
      await forfeitMatch(id);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getUserTeam = () => {
    return currentMatch?.teams?.find((t) =>
      t.players?.some((p) => (p._id || p) === user?.id)
    );
  };

  const isWinningCell = (row, col) => {
    if (!winningLine) return false;
    return winningLine.some((c) => c.row === row && c.col === col);
  };

  if (!currentMatch) {
    return (
      <div className="page match-page">
        <div className="container text-center" style={{ paddingTop: '200px' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto', borderWidth: 3 }}></div>
          <p style={{ marginTop: 'var(--space-4)' }}>Loading match...</p>
        </div>
      </div>
    );
  }

  const redTeam = currentMatch.teams?.find((t) => t.color === 'red');
  const blueTeam = currentMatch.teams?.find((t) => t.color === 'blue');
  const userTeam = getUserTeam();
  const isPlayer = !!userTeam;
  const gridSize = currentMatch.gridSize || 3;

  return (
    <div className="page match-page">
      <div className="match-layout">
        {/* Left Panel — Red Team */}
        <div className="match-panel panel-red">
          <div className="panel-header">
            <div className="team-color-dot" style={{ background: 'var(--team-red)' }}></div>
            <h3>{redTeam?.teamName || 'Red Team'}</h3>
            <span className="badge badge-red">[{redTeam?.teamTag}]</span>
          </div>
          <div className="panel-score">
            <span className="score-value mono">{currentMatch.board?.filter(c => c.claimedBy === 'red').length || 0}</span>
            <span className="score-label">Cells</span>
          </div>
          <div className="panel-players">
            {redTeam?.players?.map((player) => (
              <div key={player._id || player} className="panel-player">
                <div className="avatar avatar-sm">
                  <span className="avatar-initials">{(player.username || '?')[0].toUpperCase()}</span>
                </div>
                <div className="player-info">
                  <span className="player-name">{player.username || 'Player'}</span>
                  <span className="player-handle mono">{player.cfHandle || ''}</span>
                </div>
              </div>
            ))}
          </div>
          {currentMatch.status === 'ready' && redTeam && (
            <div className={`ready-status ${redTeam.ready ? 'is-ready' : ''}`}>
              {redTeam.ready ? '✓ Ready' : 'Not Ready'}
            </div>
          )}
        </div>

        {/* Center — Game Board */}
        <div className="match-center">
          {/* Match Status Bar */}
          <div className="match-status-bar">
            {currentMatch.status === 'waiting' && (
              <div className="status-message">
                <span className="live-indicator">Waiting for opponent</span>
              </div>
            )}
            {currentMatch.status === 'ready' && (
              <div className="status-message">
                <span>Both teams joined! Ready up to start.</span>
                {isPlayer && (
                  <button className="btn btn-primary" onClick={handleReady}>
                    {userTeam?.ready ? 'Cancel Ready' : '✓ Ready Up'}
                  </button>
                )}
              </div>
            )}
            {currentMatch.status === 'in_progress' && (
              <div className="match-timer-bar">
                <div className="live-indicator">LIVE</div>
                <div className={`match-timer mono ${timer !== null && timer < 300 ? 'timer-urgent' : ''}`}>
                  {formatTime(timer)}
                </div>
                {isPlayer && (
                  <button className="btn btn-ghost btn-sm" onClick={handleForfeit} style={{ color: 'var(--error)' }}>
                    Forfeit
                  </button>
                )}
              </div>
            )}
            {currentMatch.status === 'completed' && (
              <div className="status-message">
                <span className="badge badge-success">Match Complete</span>
              </div>
            )}
          </div>

          {/* The Board */}
          <div
            className="game-board"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              animation: 'boardReveal 0.6s ease',
            }}
          >
            {currentMatch.board?.map((cell, idx) => {
              const claimed = cell.claimedBy;
              const winning = isWinningCell(cell.row, cell.col);

              return (
                <a
                  key={idx}
                  href={cell.problem?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    game-cell
                    ${claimed ? `cell-claimed cell-${claimed}` : 'cell-open'}
                    ${claimed === 'red' ? 'cell-claim-red' : ''}
                    ${claimed === 'blue' ? 'cell-claim-blue' : ''}
                    ${winning ? 'cell-winning' : ''}
                  `}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="cell-rating">
                    <span className={`badge badge-rating ${getRatingBadgeClass(cell.problem?.rating)}`}>
                      {cell.problem?.rating || '?'}
                    </span>
                  </div>
                  <div className="cell-problem-name">
                    {cell.problem?.name?.length > 25
                      ? cell.problem.name.substring(0, 22) + '...'
                      : cell.problem?.name}
                  </div>
                  <div className="cell-problem-id mono">
                    {cell.problem?.contestId}{cell.problem?.index}
                  </div>
                  {claimed && (
                    <div className={`cell-mark ${claimed === 'red' ? 'mark-red' : 'mark-blue'}`}>
                      {claimed === 'red' ? '✕' : '○'}
                    </div>
                  )}
                </a>
              );
            })}
          </div>

          {/* Activity Feed */}
          <div className="activity-feed">
            <h4 className="feed-title">Activity Feed</h4>
            <div className="feed-list">
              {activityFeed.length === 0 ? (
                <p className="text-secondary text-center" style={{ padding: 'var(--space-4)' }}>
                  {currentMatch.status === 'in_progress'
                    ? 'Waiting for first solve...'
                    : 'Match not started yet'}
                </p>
              ) : (
                activityFeed.map((entry, i) => (
                  <div key={i} className="feed-entry" style={{ animationDelay: `${i * 0.05}s` }}>
                    <span className={`feed-dot ${entry.color === 'red' ? 'dot-red' : 'dot-blue'}`}></span>
                    <span className="feed-text">
                      <strong className={entry.color === 'red' ? 'text-red' : 'text-blue'}>
                        {entry.username}
                      </strong>
                      {' '}solved{' '}
                      <span className="mono">{entry.problemName}</span>
                      <span className="badge badge-rating" style={{ marginLeft: '4px' }}>
                        {entry.problemRating}
                      </span>
                    </span>
                    <span className="feed-time mono">{entry.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel — Blue Team */}
        <div className="match-panel panel-blue">
          <div className="panel-header">
            <div className="team-color-dot" style={{ background: 'var(--team-blue)' }}></div>
            <h3>{blueTeam?.teamName || 'Waiting...'}</h3>
            {blueTeam && <span className="badge badge-blue">[{blueTeam.teamTag}]</span>}
          </div>
          {blueTeam ? (
            <>
              <div className="panel-score">
                <span className="score-value mono">{currentMatch.board?.filter(c => c.claimedBy === 'blue').length || 0}</span>
                <span className="score-label">Cells</span>
              </div>
              <div className="panel-players">
                {blueTeam.players?.map((player) => (
                  <div key={player._id || player} className="panel-player">
                    <div className="avatar avatar-sm">
                      <span className="avatar-initials">{(player.username || '?')[0].toUpperCase()}</span>
                    </div>
                    <div className="player-info">
                      <span className="player-name">{player.username || 'Player'}</span>
                      <span className="player-handle mono">{player.cfHandle || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
              {currentMatch.status === 'ready' && (
                <div className={`ready-status ${blueTeam.ready ? 'is-ready' : ''}`}>
                  {blueTeam.ready ? '✓ Ready' : 'Not Ready'}
                </div>
              )}
            </>
          ) : (
            <div className="panel-waiting">
              <div className="waiting-pulse"></div>
              <p>Waiting for an opponent to join...</p>
            </div>
          )}
        </div>
      </div>

      {/* Win/Loss Modal */}
      {showResult && (
        <div className="modal-overlay" onClick={() => setShowResult(false)}>
          <div className="modal result-modal" onClick={(e) => e.stopPropagation()}>
            <div className="result-content">
              {currentMatch.winner === 'draw' ? (
                <>
                  <div className="result-icon">🤝</div>
                  <h2>It's a Draw!</h2>
                </>
              ) : userTeam?.color === currentMatch.winner ? (
                <>
                  <div className="result-icon">🏆</div>
                  <h2 className="text-success">Victory!</h2>
                </>
              ) : (
                <>
                  <div className="result-icon">💔</div>
                  <h2 className="text-error">Defeat</h2>
                </>
              )}
              <p className="text-secondary">
                {currentMatch.winCondition === 'line' && 'Won by completing a line!'}
                {currentMatch.winCondition === 'tiebreak_cells' && 'Won by claiming more cells'}
                {currentMatch.winCondition === 'tiebreak_time' && 'Won by faster solve time'}
                {currentMatch.winCondition === 'forfeit' && 'Won by forfeit'}
                {currentMatch.winCondition === 'timeout' && 'Time ran out — decided by tiebreak'}
              </p>
              <div className="result-actions">
                <button className="btn btn-primary" onClick={() => navigate('/lobby')}>
                  Play Again
                </button>
                <button className="btn btn-secondary" onClick={() => setShowResult(false)}>
                  View Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRatingBadgeClass(rating) {
  if (!rating) return '';
  if (rating < 1200) return 'rating-newbie';
  if (rating < 1400) return 'rating-pupil';
  if (rating < 1600) return 'rating-specialist';
  if (rating < 1900) return 'rating-expert';
  if (rating < 2100) return 'rating-cm';
  if (rating < 2400) return 'rating-master';
  return 'rating-gm';
}
