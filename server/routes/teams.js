const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST /api/teams
// @desc    Create a new team
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, tag, maxSize } = req.body;

    if (!name || !tag) {
      return res.status(400).json({ success: false, message: 'Team name and tag are required' });
    }

    const team = await Team.create({
      name,
      tag: tag.toUpperCase(),
      captainId: req.user._id,
      members: [req.user._id],
      maxSize: maxSize || 3,
    });

    // Add team to user's teams
    await User.findByIdAndUpdate(req.user._id, {
      $push: { teams: team._id },
    });

    res.status(201).json({ success: true, team });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/teams
// @desc    Get user's teams
router.get('/', auth, async (req, res, next) => {
  try {
    const teams = await Team.find({ members: req.user._id })
      .populate('members', 'username cfHandle cfProfile.rating cfProfile.rank cfProfile.avatar')
      .populate('captainId', 'username');

    res.json({ success: true, teams });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/teams/:id
// @desc    Get team details
router.get('/:id', auth, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('members', 'username cfHandle cfProfile stats')
      .populate('captainId', 'username cfHandle');

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // Calculate average rating
    const ratings = team.members
      .filter((m) => m.cfProfile?.rating)
      .map((m) => m.cfProfile.rating);
    team._avgRating = ratings.length > 0
      ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
      : 0;

    res.json({ success: true, team });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/teams/join
// @desc    Join a team by invite code
router.post('/join', auth, async (req, res, next) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ success: false, message: 'Invite code is required' });
    }

    const team = await Team.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Invalid invite code' });
    }

    if (team.members.includes(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Already a member of this team' });
    }

    if (team.members.length >= team.maxSize) {
      return res.status(400).json({ success: false, message: 'Team is full' });
    }

    team.members.push(req.user._id);
    await team.save();

    await User.findByIdAndUpdate(req.user._id, {
      $push: { teams: team._id },
    });

    const populated = await Team.findById(team._id)
      .populate('members', 'username cfHandle cfProfile.rating cfProfile.rank cfProfile.avatar')
      .populate('captainId', 'username');

    res.json({ success: true, team: populated, message: `Joined team ${team.name}!` });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/teams/:id/members/:userId
// @desc    Remove a member (captain only) or leave team
router.delete('/:id/members/:userId', auth, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const isCaptain = team.captainId.toString() === req.user._id.toString();
    const isSelf = req.params.userId === req.user._id.toString();

    if (!isCaptain && !isSelf) {
      return res.status(403).json({ success: false, message: 'Only the captain can remove members' });
    }

    // Captain can't leave — must transfer or delete team
    if (isSelf && isCaptain) {
      return res.status(400).json({ success: false, message: 'Captain cannot leave. Transfer captaincy or delete the team.' });
    }

    team.members.pull(req.params.userId);
    await team.save();

    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { teams: team._id },
    });

    res.json({ success: true, message: 'Member removed from team' });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/teams/:id
// @desc    Update team settings (captain only)
router.put('/:id', auth, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (team.captainId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the captain can update team settings' });
    }

    const { name, tag, maxSize } = req.body;
    if (name) team.name = name;
    if (tag) team.tag = tag.toUpperCase();
    if (maxSize) team.maxSize = maxSize;

    await team.save();

    res.json({ success: true, team });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/teams/:id
// @desc    Delete team (captain only)
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (team.captainId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the captain can delete the team' });
    }

    // Remove team from all members
    await User.updateMany(
      { _id: { $in: team.members } },
      { $pull: { teams: team._id } }
    );

    await Team.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Team deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
