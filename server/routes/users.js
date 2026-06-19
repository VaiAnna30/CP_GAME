const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Match = require('../models/Match');
const auth = require('../middleware/auth');

// @route   GET /api/users/:id
// @desc    Get user profile
router.get('/:id', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash')
      .populate('teams', 'name tag');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
router.put('/profile', auth, async (req, res, next) => {
  try {
    const { username, notifications } = req.body;
    const updates = {};

    if (username) updates.username = username;
    if (notifications) updates.notifications = notifications;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-passwordHash');

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/users/friends/:id
// @desc    Add/remove friend
router.post('/friends/:id', auth, async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot friend yourself' });
    }

    const friend = await User.findById(req.params.id);
    if (!friend) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = await User.findById(req.user._id);
    const isFriend = user.friends.includes(req.params.id);

    if (isFriend) {
      user.friends.pull(req.params.id);
      await user.save();
      return res.json({ success: true, message: 'Friend removed', isFriend: false });
    }

    user.friends.push(req.params.id);
    await user.save();
    res.json({ success: true, message: 'Friend added', isFriend: true });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/:id/matches
// @desc    Get user's match history
router.get('/:id/matches', auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const matches = await Match.find({
      'teams.players': req.params.id,
      status: 'completed',
    })
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle');

    const total = await Match.countDocuments({
      'teams.players': req.params.id,
      status: 'completed',
    });

    res.json({
      success: true,
      matches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/leaderboard
// @desc    Get global leaderboard
router.get('/leaderboard/global', auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sort || 'elo'; // 'elo', 'wins', 'winRate'

    let sortField;
    switch (sortBy) {
      case 'wins':
        sortField = { 'stats.matchesWon': -1 };
        break;
      case 'matches':
        sortField = { 'stats.matchesPlayed': -1 };
        break;
      default:
        sortField = { 'stats.eloRating': -1 };
    }

    const users = await User.find({ 'stats.matchesPlayed': { $gt: 0 } })
      .select('username cfHandle cfProfile stats')
      .sort(sortField)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({ 'stats.matchesPlayed': { $gt: 0 } });

    res.json({
      success: true,
      leaderboard: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
