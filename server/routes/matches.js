const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Team = require('../models/Team');
const User = require('../models/User');
const auth = require('../middleware/auth');
const problemPicker = require('../services/problemPicker');

// @route   POST /api/matches
// @desc    Create a new match lobby
router.post('/', auth, async (req, res, next) => {
  try {
    const { teamId, gridSize, settings } = req.body;

    if (!teamId) {
      return res.status(400).json({ success: false, message: 'Team ID is required' });
    }

    const team = await Team.findById(teamId).populate('members', 'cfHandle cfHandleVerified');
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (!team.members.find((m) => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'You are not a member of this team' });
    }

    // Verify all team members have verified CF handles
    const unverified = team.members.filter((m) => !m.cfHandleVerified);
    if (unverified.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All team members must have verified Codeforces handles',
      });
    }

    // Generate board
    const matchSettings = {
      difficultyRange: settings?.difficultyRange || { min: 800, max: 1800 },
      timeLimitMinutes: settings?.timeLimitMinutes || 60,
      allowedTags: settings?.allowedTags || [],
    };

    const board = await problemPicker.generateBoard(gridSize || 3, matchSettings);

    const match = await Match.create({
      gridSize: gridSize || 3,
      teams: [
        {
          teamId: team._id,
          teamName: team.name,
          teamTag: team.tag,
          players: team.members.map((m) => m._id),
          color: 'red',
          ready: false,
        },
      ],
      board,
      settings: matchSettings,
      events: [
        {
          type: 'match_created',
          data: { createdBy: req.user._id, teamName: team.name },
          timestamp: new Date(),
        },
      ],
    });

    const populated = await Match.findById(match._id)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle cfProfile');

    res.status(201).json({ success: true, match: populated });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/matches
// @desc    List open/active match lobbies
router.get('/', auth, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ['waiting', 'ready', 'in_progress'] };
    }

    const matches = await Match.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle cfProfile');

    res.json({ success: true, matches });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/matches/:id
// @desc    Get match state
router.get('/:id', auth, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle cfProfile')
      .populate('spectators', 'username');

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    res.json({ success: true, match });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/matches/:id/join
// @desc    Join a match with your team
router.post('/:id/join', auth, async (req, res, next) => {
  try {
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ success: false, message: 'Team ID is required' });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    if (match.status !== 'waiting') {
      return res.status(400).json({ success: false, message: 'Match is not open for joining' });
    }

    if (match.teams.length >= 2) {
      return res.status(400).json({ success: false, message: 'Match already has two teams' });
    }

    // Can't join your own match
    if (match.teams[0].teamId.toString() === teamId) {
      return res.status(400).json({ success: false, message: 'Cannot join your own match' });
    }

    const team = await Team.findById(teamId).populate('members', 'cfHandle cfHandleVerified');
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (!team.members.find((m) => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'You are not a member of this team' });
    }

    const unverified = team.members.filter((m) => !m.cfHandleVerified);
    if (unverified.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All team members must have verified Codeforces handles',
      });
    }

    match.teams.push({
      teamId: team._id,
      teamName: team.name,
      teamTag: team.tag,
      players: team.members.map((m) => m._id),
      color: 'blue',
      ready: false,
    });

    match.status = 'ready';
    match.events.push({
      type: 'team_joined',
      data: { teamName: team.name, joinedBy: req.user._id },
      timestamp: new Date(),
    });

    await match.save();

    const populated = await Match.findById(match._id)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle cfProfile');

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`match_${match._id}`).emit('team_joined', {
        teamName: team.name,
        teamTag: team.tag,
        match: populated,
      });
    }

    res.json({ success: true, match: populated });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/matches/:id/ready
// @desc    Toggle ready status
router.post('/:id/ready', auth, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    if (match.status !== 'ready' && match.status !== 'waiting') {
      return res.status(400).json({ success: false, message: 'Match is not in ready phase' });
    }

    // Find the user's team
    const teamIndex = match.teams.findIndex((t) =>
      t.players.some((p) => p.toString() === req.user._id.toString())
    );

    if (teamIndex === -1) {
      return res.status(403).json({ success: false, message: 'You are not in this match' });
    }

    match.teams[teamIndex].ready = !match.teams[teamIndex].ready;

    match.events.push({
      type: 'player_ready',
      data: {
        userId: req.user._id,
        teamColor: match.teams[teamIndex].color,
        ready: match.teams[teamIndex].ready,
      },
      timestamp: new Date(),
    });

    // Check if both teams are ready → start match
    if (match.teams.length === 2 && match.teams.every((t) => t.ready)) {
      match.status = 'in_progress';
      match.startedAt = new Date();
      match.events.push({
        type: 'match_start',
        data: {},
        timestamp: new Date(),
      });
    }

    await match.save();

    const populated = await Match.findById(match._id)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle cfProfile');

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`match_${match._id}`).emit('ready_update', {
        teamColor: match.teams[teamIndex].color,
        ready: match.teams[teamIndex].ready,
        match: populated,
      });

      // If match started, begin polling
      if (match.status === 'in_progress') {
        io.to(`match_${match._id}`).emit('match_started', {
          startedAt: match.startedAt,
          match: populated,
        });

        // Start CF polling
        const poller = req.app.get('cfPoller');
        if (poller) {
          poller.startPolling(match._id.toString());
        }
      }
    }

    res.json({ success: true, match: populated });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/matches/:id/forfeit
// @desc    Forfeit match
router.post('/:id/forfeit', auth, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    if (match.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'Match is not in progress' });
    }

    const team = match.teams.find((t) =>
      t.players.some((p) => p.toString() === req.user._id.toString())
    );

    if (!team) {
      return res.status(403).json({ success: false, message: 'You are not in this match' });
    }

    const winnerColor = team.color === 'red' ? 'blue' : 'red';

    match.status = 'completed';
    match.winner = winnerColor;
    match.winCondition = 'forfeit';
    match.completedAt = new Date();
    match.events.push({
      type: 'forfeit',
      data: { forfeitedBy: req.user._id, forfeitedTeam: team.color },
      timestamp: new Date(),
    });

    await match.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`match_${match._id}`).emit('match_ended', {
        winner: winnerColor,
        condition: 'forfeit',
        forfeitedBy: team.color,
      });
    }

    // Stop polling
    const poller = req.app.get('cfPoller');
    if (poller) {
      poller.stopPolling(match._id.toString());
    }

    res.json({ success: true, message: 'Match forfeited' });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/matches/:id/spectate
// @desc    Join as spectator
router.post('/:id/spectate', auth, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    if (!match.spectators.includes(req.user._id)) {
      match.spectators.push(req.user._id);
      await match.save();
    }

    res.json({ success: true, message: 'Joined as spectator' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
