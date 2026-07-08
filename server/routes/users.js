const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Match = require('../models/Match');
const auth = require('../middleware/auth');


router.get('/:id', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', auth, async (req, res, next) => {
  try {
    const { username, notifications } = req.body;
    const updates = {};

    // 1. Build Updates Object
    if (username) updates.username = username;
    if (notifications) updates.notifications = notifications;

    // 2. Apply Updates to Database
    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-passwordHash');

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});


router.post('/friends/:id', auth, async (req, res, next) => {
  try {
    // 1. Prevent self-friending
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot friend yourself' });
    }

    // 2. Ensure target user exists
    const friend = await User.findById(req.params.id);
    if (!friend) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = await User.findById(req.user._id);
    const isFriend = user.friends.includes(req.params.id);

    // 3. Toggle Logic
    if (isFriend) {
      user.friends.pull(req.params.id);
      await user.save();
      return res.json({ success: true, message: 'Friend removed', isFriend: false });
    } else {
      user.friends.push(req.params.id);
      await user.save();
      return res.json({ success: true, message: 'Friend added', isFriend: true });
    }
  } catch (error) {
    next(error);
  }
});


router.get('/:id/matches', auth, async (req, res, next) => {
  try {
    // 1. Setup Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // 2. Query Database for completed matches involving the user
    const queryFilter = {
      'teams.players': req.params.id,
      status: 'completed',
    };

    const matches = await Match.find(queryFilter)
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('teams.teamId', 'name tag')
      .populate('teams.players', 'username cfHandle');

    // 3. Get Total Count for Pagination Metadata
    const total = await Match.countDocuments(queryFilter);

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


router.get('/leaderboard/global', auth, async (req, res, next) => {
  try {
    // 1. Setup Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sort || 'elo'; // allowed: 'elo', 'wins', 'matches'

    // 2. Determine Sort Field Mapping
    let sortField;
    switch (sortBy) {
      case 'wins':
        sortField = { 'stats.matchesWon': -1 };
        break;
      case 'matches':
        sortField = { 'stats.matchesPlayed': -1 };
        break;
      case 'elo':
      default:
        sortField = { 'stats.eloRating': -1 };
        break;
    }

    // 3. Query Database (Only include users who have actually played)
    const queryFilter = { 'stats.matchesPlayed': { $gt: 0 } };

    const users = await User.find(queryFilter)
      .select('username cfHandle cfProfile stats')
      .sort(sortField)
      .skip(skip)
      .limit(limit);

    // 4. Get Total Count for Pagination Metadata
    const total = await User.countDocuments(queryFilter);

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
