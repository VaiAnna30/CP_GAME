const express = require('express');
const router = express.Router();
const User = require('../models/User');
const cfApi = require('../services/cfApi');
const auth = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Check existing user
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? 'Email' : 'Username';
      return res.status(400).json({ success: false, message: `${field} already in use` });
    }

    const user = await User.create({
      username,
      email,
      passwordHash: password,
    });

    const token = user.generateToken();

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        cfHandle: user.cfHandle,
        cfHandleVerified: user.cfHandleVerified,
        cfProfile: user.cfProfile,
        stats: user.stats,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Login user
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = user.generateToken();

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        cfHandle: user.cfHandle,
        cfHandleVerified: user.cfHandleVerified,
        cfProfile: user.cfProfile,
        stats: user.stats,
        teams: user.teams,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user._id).populate('teams');
  res.json({ success: true, user });
});

// @route   POST /api/auth/verify-cf
// @desc    Initiate CF handle verification
router.post('/verify-cf', auth, async (req, res, next) => {
  try {
    const { cfHandle } = req.body;

    if (!cfHandle) {
      return res.status(400).json({ success: false, message: 'CF handle is required' });
    }

    // Check if handle exists on CF
    try {
      const users = await cfApi.getUserInfo(cfHandle);
      if (!users || users.length === 0) {
        return res.status(400).json({ success: false, message: 'Codeforces handle not found' });
      }
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Could not verify handle with Codeforces' });
    }

    // Check if handle already claimed by another user
    const existingUser = await User.findOne({
      cfHandle: cfHandle.toLowerCase(),
      cfHandleVerified: true,
      _id: { $ne: req.user._id },
    });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'This CF handle is already linked to another account' });
    }

    // Set verification problem (use a well-known problem)
    // The user needs to submit a compile-error solution to this problem
    const verificationProblem = '4/A'; // Watermelon — very popular, easy to find

    await User.findByIdAndUpdate(req.user._id, {
      cfHandle: cfHandle.toLowerCase(),
      cfHandleVerified: false,
      cfVerificationProblem: verificationProblem,
    });

    res.json({
      success: true,
      message: `To verify your handle, submit a Compilation Error solution to problem ${verificationProblem} on Codeforces, then click "Confirm".`,
      verificationProblem,
      problemUrl: `https://codeforces.com/problemset/problem/${verificationProblem}`,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/confirm-cf
// @desc    Confirm CF handle verification by checking for CE submission
router.post('/confirm-cf', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.cfHandle || !user.cfVerificationProblem) {
      return res.status(400).json({ success: false, message: 'No pending verification. Start with /verify-cf first.' });
    }

    if (user.cfHandleVerified) {
      return res.status(400).json({ success: false, message: 'Handle already verified' });
    }

    const [contestId, index] = user.cfVerificationProblem.split('/');
    const submission = await cfApi.checkVerificationSubmission(
      user.cfHandle,
      parseInt(contestId),
      index
    );

    if (!submission) {
      return res.status(400).json({
        success: false,
        message: 'No compile-error submission found. Please submit a CE solution to the verification problem and try again.',
      });
    }

    // Verification successful! Fetch and store CF profile
    const cfUsers = await cfApi.getUserInfo(user.cfHandle);
    const cfProfile = cfUsers[0];

    await User.findByIdAndUpdate(req.user._id, {
      cfHandleVerified: true,
      cfProfile: {
        rating: cfProfile.rating || 0,
        maxRating: cfProfile.maxRating || 0,
        rank: cfProfile.rank || 'unrated',
        avatar: cfProfile.avatar || cfProfile.titlePhoto || '',
        country: cfProfile.country || '',
      },
    });

    res.json({
      success: true,
      message: 'Codeforces handle verified successfully!',
      cfProfile: {
        handle: user.cfHandle,
        rating: cfProfile.rating,
        maxRating: cfProfile.maxRating,
        rank: cfProfile.rank,
        avatar: cfProfile.avatar || cfProfile.titlePhoto,
        country: cfProfile.country,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
