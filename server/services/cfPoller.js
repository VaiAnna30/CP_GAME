const cfApi = require('./cfApi');
const matchEngine = require('./matchEngine');
const Match = require('../models/Match');
const User = require('../models/User');

class CFPoller {
  constructor(io) {
    this.io = io;
    this.activePolls = new Map(); // matchId -> intervalId
    this.pollInterval = parseInt(process.env.CF_POLL_INTERVAL, 10) || 4000;
  }

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

  stopPolling(matchId) {
    const intervalId = this.activePolls.get(matchId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activePolls.delete(matchId);
      console.log(`Stopped polling match ${matchId}`);
    }
  }

  stopAll() {
    for (const [matchId, intervalId] of this.activePolls) {
      clearInterval(intervalId);
    }
    this.activePolls.clear();
    console.log('All polling stopped');
  }

  async _pollMatch(matchId) {
    const match = await Match.findById(matchId);

    // Stop polling if match no longer exists or isn't active
    if (!match || match.status !== 'in_progress') {
      this.stopPolling(matchId);
      return;
    }

    // Check if the match time limit has been reached
    if (this._hasMatchTimedOut(match)) {
      await this._handleTimeout(match);
      return;
    }

    // Identify which cells on the board are still unclaimed
    const problemMap = this._getUnclaimedProblemsMap(match.board);

    // Stop polling if there are no more cells to claim
    if (problemMap.size === 0) {
      this.stopPolling(matchId);
      return;
    }

    const matchStartTimeSeconds = Math.floor(new Date(match.startedAt).getTime() / 1000);

    // Check submissions for all players in the match
    for (const team of match.teams) {
      for (const playerId of team.players) {
        await this._processPlayerSubmissions(
          match,
          team,
          playerId,
          problemMap,
          matchStartTimeSeconds
        );
      }
    }
  }

  _hasMatchTimedOut(match) {
    if (!match.settings.timeLimitMinutes || !match.startedAt) return false;

    const elapsedMinutes = (Date.now() - new Date(match.startedAt).getTime()) / 1000 / 60;
    return elapsedMinutes >= match.settings.timeLimitMinutes;
  }

  _getUnclaimedProblemsMap(board) {
    const problemMap = new Map();
    const unclaimedCells = board.filter(cell => !cell.claimedBy);

    for (const cell of unclaimedCells) {
      const key = `${cell.problem.contestId}-${cell.problem.index}`;
      problemMap.set(key, cell);
    }

    return problemMap;
  }

  async _processPlayerSubmissions(match, team, playerId, problemMap, matchStartTimeSeconds) {
    try {
      const user = await User.findById(playerId);
      if (!user || !user.cfHandle) return;

      // Fetch the last 20 submissions for the user
      const submissions = await cfApi.getUserSubmissions(user.cfHandle, 1, 20);
      if (!submissions || !Array.isArray(submissions)) return;

      for (const sub of submissions) {
        // Only care about Accepted submissions made after the match started
        if (sub.verdict !== 'OK') continue;
        if (sub.creationTimeSeconds < matchStartTimeSeconds) continue;

        const problemKey = `${sub.problem.contestId}-${sub.problem.index}`;
        const cell = problemMap.get(problemKey);

        if (cell) {
          // Found a valid solution for an unclaimed cell!
          await this._claimCell(
            match,
            cell,
            team.color,
            playerId,
            new Date(sub.creationTimeSeconds * 1000),
            sub.id
          );

          // Prevent double-claiming in the same poll cycle
          problemMap.delete(problemKey);
        }
      }
    } catch (error) {
      console.warn(`Failed to poll submissions for player ${playerId}:`, error.message);
    }
  }

  async _claimCell(match, cell, color, userId, claimTime, submissionId) {
    // Reload match to avoid race conditions and get the latest board state
    const freshMatch = await Match.findById(match._id);
    const boardCell = freshMatch.board.find(c => c.row === cell.row && c.col === cell.col);

    if (boardCell.claimedBy) return; // Double-check it wasn't claimed

    // Update the cell
    boardCell.claimedBy = color;
    boardCell.claimedByUser = userId;
    boardCell.claimTime = claimTime;
    boardCell.submissionId = submissionId;

    // Increment team's claimed count
    const team = freshMatch.teams.find(t => t.color === color);
    if (team) team.cellsClaimed = (team.cellsClaimed || 0) + 1;

    // Log the event
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

    // Check if this claim wins the game
    const result = matchEngine.evaluateMatch(freshMatch.board, freshMatch.gridSize, freshMatch.startedAt);

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

    // Emit real-time events to players
    const user = await User.findById(userId);
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
      await this._updateStats(freshMatch);
      this.io.to(`match_${match._id}`).emit('match_ended', {
        winner: result.winner,
        condition: result.condition,
        winningLine: result.winningLine,
      });
      this.stopPolling(match._id.toString());
    }

    console.log(`Cell [${cell.row},${cell.col}] claimed by ${color} (${user?.cfHandle}) in match ${match._id}`);
  }


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

  async _updateStats(match) {
    try {
      const Team = require('../models/Team');

      for (const team of match.teams) {
        const isWinner = team.color === match.winner;

        // Update Team stats
        await Team.findByIdAndUpdate(team.teamId, {
          $inc: {
            'stats.matchesPlayed': 1,
            'stats.matchesWon': isWinner ? 1 : 0,
          },
          $set: {
            'stats.winStreak': isWinner ? (team.winStreak || 0) + 1 : 0,
          },
        });

        // Update each player's individual stats
        for (const playerId of team.players) {
          const solves = match.board.filter(
            c => c.claimedByUser && c.claimedByUser.toString() === playerId.toString()
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
