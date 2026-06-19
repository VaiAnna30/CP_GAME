const cfApi = require('./cfApi');
const matchEngine = require('./matchEngine');
const Match = require('../models/Match');
const User = require('../models/User');

/**
 * CF Poller — The heart of the project
 * Polls Codeforces user.status for each player in active matches
 * to detect accepted submissions matching board problems.
 */
class CFPoller {
  constructor(io) {
    this.io = io;
    this.activePolls = new Map(); // matchId -> intervalId
    this.pollInterval = parseInt(process.env.CF_POLL_INTERVAL) || 4000;
  }

  /**
   * Start polling for a specific match
   */
  startPolling(matchId) {
    if (this.activePolls.has(matchId)) {
      console.log(`Already polling match ${matchId}`);
      return;
    }

    console.log(`Starting CF poll for match ${matchId}`);

    const intervalId = setInterval(async () => {
      try {
        await this._pollMatch(matchId);
      } catch (error) {
        console.error(`Poll error for match ${matchId}:`, error.message);
      }
    }, this.pollInterval);

    this.activePolls.set(matchId, intervalId);
  }

  /**
   * Stop polling for a match
   */
  stopPolling(matchId) {
    const intervalId = this.activePolls.get(matchId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activePolls.delete(matchId);
      console.log(`Stopped polling match ${matchId}`);
    }
  }

  /**
   * Stop all polling (for shutdown)
   */
  stopAll() {
    for (const [matchId, intervalId] of this.activePolls) {
      clearInterval(intervalId);
    }
    this.activePolls.clear();
    console.log('All polling stopped');
  }

  /**
   * Core polling logic for a single match
   */
  async _pollMatch(matchId) {
    const match = await Match.findById(matchId);
    if (!match || match.status !== 'in_progress') {
      this.stopPolling(matchId);
      return;
    }

    // Check for time limit
    if (match.settings.timeLimitMinutes && match.startedAt) {
      const elapsed = (Date.now() - new Date(match.startedAt).getTime()) / 1000 / 60;
      if (elapsed >= match.settings.timeLimitMinutes) {
        await this._handleTimeout(match);
        return;
      }
    }

    // Get all unclaimed cells
    const unclaimedCells = match.board.filter((c) => !c.claimedBy);
    if (unclaimedCells.length === 0) {
      this.stopPolling(matchId);
      return;
    }

    // Build a map of problem keys to board positions
    const problemMap = new Map();
    for (const cell of unclaimedCells) {
      const key = `${cell.problem.contestId}-${cell.problem.index}`;
      problemMap.set(key, cell);
    }

    // Check submissions for all players across both teams
    for (const team of match.teams) {
      for (const playerId of team.players) {
        try {
          const user = await User.findById(playerId);
          if (!user || !user.cfHandle) continue;

          const submissions = await cfApi.getUserSubmissions(user.cfHandle, 1, 20);
          if (!submissions || !Array.isArray(submissions)) continue;

          // Filter for AC submissions after match start
          const matchStartTime = Math.floor(new Date(match.startedAt).getTime() / 1000);

          for (const sub of submissions) {
            if (sub.verdict !== 'OK') continue;
            if (sub.creationTimeSeconds < matchStartTime) continue;

            const problemKey = `${sub.problem.contestId}-${sub.problem.index}`;
            const cell = problemMap.get(problemKey);

            if (cell) {
              // Cell is unclaimed and this submission solves it!
              await this._claimCell(
                match,
                cell,
                team.color,
                playerId,
                new Date(sub.creationTimeSeconds * 1000),
                sub.id
              );

              // Remove from unclaimed map so other players don't re-claim
              problemMap.delete(problemKey);
            }
          }
        } catch (error) {
          // Log but don't crash — CF might be temporarily down
          console.warn(`Failed to poll submissions for player ${playerId}:`, error.message);
        }
      }
    }
  }

  /**
   * Claim a cell for a team
   */
  async _claimCell(match, cell, color, userId, claimTime, submissionId) {
    // Reload match to get latest state (avoid race conditions)
    const freshMatch = await Match.findById(match._id);
    const boardCell = freshMatch.board.find(
      (c) => c.row === cell.row && c.col === cell.col
    );

    // Double-check: cell might have been claimed by another poll cycle
    if (boardCell.claimedBy) return;

    // Update cell
    boardCell.claimedBy = color;
    boardCell.claimedByUser = userId;
    boardCell.claimTime = claimTime;
    boardCell.submissionId = submissionId;

    // Update team cell count
    const team = freshMatch.teams.find((t) => t.color === color);
    if (team) team.cellsClaimed = (team.cellsClaimed || 0) + 1;

    // Add event
    freshMatch.events.push({
      type: 'cell_claimed',
      data: {
        row: cell.row,
        col: cell.col,
        color,
        userId,
        problemName: cell.problem.name,
        problemRating: cell.problem.rating,
        claimTime,
        submissionId,
      },
      timestamp: new Date(),
    });

    // Evaluate match state
    const result = matchEngine.evaluateMatch(
      freshMatch.board,
      freshMatch.gridSize,
      freshMatch.startedAt
    );

    if (result.finished) {
      freshMatch.status = 'completed';
      freshMatch.winner = result.winner;
      freshMatch.winCondition = result.condition;
      freshMatch.completedAt = new Date();

      freshMatch.events.push({
        type: 'match_end',
        data: {
          winner: result.winner,
          condition: result.condition,
          winningLine: result.winningLine,
        },
        timestamp: new Date(),
      });
    }

    await freshMatch.save();

    // Get user info for the activity feed
    const user = await User.findById(userId);

    // Emit real-time events
    this.io.to(`match_${match._id}`).emit('cell_claimed', {
      row: cell.row,
      col: cell.col,
      color,
      userId: userId.toString(),
      username: user?.username || 'Unknown',
      cfHandle: user?.cfHandle || 'Unknown',
      problemName: cell.problem.name,
      problemRating: cell.problem.rating,
      claimTime,
      submissionId,
    });

    if (result.finished) {
      // Update player stats
      await this._updateStats(freshMatch);

      this.io.to(`match_${match._id}`).emit('match_ended', {
        winner: result.winner,
        condition: result.condition,
        winningLine: result.winningLine,
      });

      this.stopPolling(match._id.toString());
    }

    console.log(
      `Cell [${cell.row},${cell.col}] claimed by ${color} (${user?.cfHandle}) in match ${match._id}`
    );
  }

  /**
   * Handle match timeout
   */
  async _handleTimeout(match) {
    const result = matchEngine.resolveTiebreak(match.board, match.startedAt);

    match.status = 'completed';
    match.winner = result.winner;
    match.winCondition = 'timeout';
    match.completedAt = new Date();

    match.events.push({
      type: 'match_end',
      data: { winner: result.winner, condition: 'timeout' },
      timestamp: new Date(),
    });

    await match.save();

    await this._updateStats(match);

    this.io.to(`match_${match._id}`).emit('match_ended', {
      winner: result.winner,
      condition: 'timeout',
      winningLine: null,
    });

    this.stopPolling(match._id.toString());
  }

  /**
   * Update player and team stats after match
   */
  async _updateStats(match) {
    try {
      for (const team of match.teams) {
        const isWinner = team.color === match.winner;

        // Update team stats
        const Team = require('../models/Team');
        await Team.findByIdAndUpdate(team.teamId, {
          $inc: {
            'stats.matchesPlayed': 1,
            'stats.matchesWon': isWinner ? 1 : 0,
          },
          $set: {
            'stats.winStreak': isWinner ? (team.winStreak || 0) + 1 : 0,
          },
        });

        // Update player stats
        for (const playerId of team.players) {
          const solves = match.board.filter(
            (c) => c.claimedByUser && c.claimedByUser.toString() === playerId.toString()
          );

          await User.findByIdAndUpdate(playerId, {
            $inc: {
              'stats.matchesPlayed': 1,
              'stats.matchesWon': isWinner ? 1 : 0,
              'stats.totalSolves': solves.length,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error updating stats:', error.message);
    }
  }
}

module.exports = CFPoller;
