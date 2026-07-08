const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Team = require('../models/Team');
const User = require('../models/User');
const auth = require('../middleware/auth');
const problemPicker = require('../services/problemPicker');


router.post('/', auth, async (req, res, next) => {
  try {
    const { teamId, gridSize, settings } = req.body;
    const user = await User.findById(req.user._id);

    // 1. Verify User Codeforces Handle
    if (!user.cfHandleVerified) {
      return res.status(400).json({ success: false, message: 'You must have a verified Codeforces handle' });
    }

    // 2. Fetch or Create Team for User
    let team = await Team.findOne({ name: user.username });
    if (!team) {
      team = await Team.create({
        name: user.username,
        tag: user.username.substring(0, 4).toUpperCase() || 'PLYR',
        members: [user._id]
      });
    }

    // 3. Setup Match Settings and Generate Board
    const matchSettings = {
      difficultyRange: settings?.difficultyRange || { min: 800, max: 1800 },
      timeLimitMinutes: settings?.timeLimitMinutes || 60,
      allowedTags: settings?.allowedTags || [],
    };
    const board = await problemPicker.generateBoard(gridSize || 3, matchSettings);

    // 4. Create the Match Lobby
    const match = await Match.create({
      gridSize: gridSize || 3,
      teams: [
        {
          teamId: team._id,
          teamName: team.name,
          teamTag: team.tag,
          players: team.members.map(m => m._id || m),
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

    // 5. Populate and Return Match
    const populatedMatch = await Match.findById(match._id)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle cfProfile');

    res.status(201).json({ success: true, match: populatedMatch });
  } catch (error) {
    next(error);
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const { status } = req.query;

    // Default to active statuses if none provided
    const filter = {
      status: status || { $in: ['waiting', 'ready', 'in_progress'] }
    };

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


router.post('/:id/join', auth, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);

    // 1. Validate Match State
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    if (match.status !== 'waiting') return res.status(400).json({ success: false, message: 'Match is not open for joining' });
    if (match.teams.length >= 2) return res.status(400).json({ success: false, message: 'Match already has two teams' });

    // 2. Prevent joining own match
    const isAlreadyInMatch = match.teams[0].players.some(p => p.toString() === req.user._id.toString());
    if (isAlreadyInMatch) {
      return res.status(400).json({ success: false, message: 'Cannot join your own match' });
    }

    // 3. Verify User Codeforces Handle
    const user = await User.findById(req.user._id);
    if (!user.cfHandleVerified) {
      return res.status(400).json({ success: false, message: 'You must have a verified Codeforces handle' });
    }

    // 4. Fetch or Create Team for joining User
    let team = await Team.findOne({ name: user.username });
    if (!team) {
      team = await Team.create({
        name: user.username,
        tag: user.username.substring(0, 4).toUpperCase() || 'PLYR',
        members: [user._id]
      });
    }

    // 5. Add Team to Match
    match.teams.push({
      teamId: team._id,
      teamName: team.name,
      teamTag: team.tag,
      players: team.members.map(m => m._id || m),
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

    // 6. Notify via Socket
    const populatedMatch = await Match.findById(match._id)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle cfProfile');

    const io = req.app.get('io');
    if (io) {
      io.to(`match_${match._id}`).emit('team_joined', {
        teamName: team.name,
        teamTag: team.tag,
        match: populatedMatch,
      });
    }

    res.json({ success: true, match: populatedMatch });
  } catch (error) {
    next(error);
  }
});


router.post('/:id/ready', auth, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);

    // 1. Validate Match State
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    if (match.status !== 'ready' && match.status !== 'waiting') {
      return res.status(400).json({ success: false, message: 'Match is not in ready phase' });
    }

    // 2. Find User's Team
    const teamIndex = match.teams.findIndex(t => t.players.some(p => p.toString() === req.user._id.toString()));
    if (teamIndex === -1) return res.status(403).json({ success: false, message: 'You are not in this match' });

    // 3. Toggle Ready Status
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

    // 4. Check if Match Should Start
    const bothTeamsReady = match.teams.length === 2 && match.teams.every(t => t.ready);
    if (bothTeamsReady) {
      match.status = 'in_progress';
      match.startedAt = new Date();
      match.events.push({ type: 'match_start', data: {}, timestamp: new Date() });
    }

    await match.save();

    // 5. Notify via Socket
    const populatedMatch = await Match.findById(match._id)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle cfProfile');

    const io = req.app.get('io');
    if (io) {
      io.to(`match_${match._id}`).emit('ready_update', {
        teamColor: match.teams[teamIndex].color,
        ready: match.teams[teamIndex].ready,
        match: populatedMatch,
      });

      // Start Codeforces Polling if match started
      if (match.status === 'in_progress') {
        io.to(`match_${match._id}`).emit('match_started', {
          startedAt: match.startedAt,
          match: populatedMatch,
        });

        const poller = req.app.get('cfPoller');
        if (poller) poller.startPolling(match._id.toString());
      }
    }

    res.json({ success: true, match: populatedMatch });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/forfeit', auth, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    if (match.status !== 'in_progress') return res.status(400).json({ success: false, message: 'Match is not in progress' });

    const team = match.teams.find(t => t.players.some(p => p.toString() === req.user._id.toString()));
    if (!team) return res.status(403).json({ success: false, message: 'You are not in this match' });

    const winnerColor = team.color === 'red' ? 'blue' : 'red';

    // 1. Update Match State to Completed
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

    // 2. Notify via Socket
    const io = req.app.get('io');
    if (io) {
      io.to(`match_${match._id}`).emit('match_ended', {
        winner: winnerColor,
        condition: 'forfeit',
        forfeitedBy: team.color,
      });
    }

    // 3. Stop Codeforces Polling
    const poller = req.app.get('cfPoller');
    if (poller) poller.stopPolling(match._id.toString());

    res.json({ success: true, message: 'Match forfeited' });
  } catch (error) {
    next(error);
  }
});


router.post('/:id/spectate', auth, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    // Add to spectators list if not already present
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
