const express = require('express');
const router = express.Router();
const User = require('../models/User');
const cfApi = require('../services/cfApi');
const auth = require('../middleware/auth');


router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // 1. Basic Validation
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // 2. Check for Existing User
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? 'Email' : 'Username';
      return res.status(400).json({ success: false, message: `${field} already in use` });
    }

    // 3. Create User
    const user = await User.create({
      username,
      email,
      passwordHash: password,
    });

    // 4. Generate JWT Token
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


router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Basic Validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    // 2. Find User by Email
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 3. Verify Password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 4. Generate JWT Token
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


router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user._id).populate('teams');
  res.json({ success: true, user });
});

router.post('/verify-cf', auth, async (req, res, next) => {
  try {
    const { cfHandle } = req.body;

    if (!cfHandle) {
      return res.status(400).json({ success: false, message: 'CF handle is required' });
    }

    // 1. Verify Handle Exists on Codeforces
    try {
      const users = await cfApi.getUserInfo(cfHandle);
      if (!users || users.length === 0) {
        return res.status(400).json({ success: false, message: 'Codeforces handle not found' });
      }
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Could not verify handle with Codeforces' });
    }

    // 2. Check if Handle is Already Claimed
    const existingUser = await User.findOne({
      cfHandle: cfHandle.toLowerCase(),
      cfHandleVerified: true,
      _id: { $ne: req.user._id },
    });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'This CF handle is already linked to another account' });
    }

    // 3. Assign a Random Verification Problem (OTP)
    const popularProblems = ['4/A', '71/A', '158/A', '231/A', '112/A', '282/A', '50/A', '236/A', '339/A', '266/A'];
    const verificationProblem = popularProblems[Math.floor(Math.random() * popularProblems.length)];

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


router.post('/confirm-cf', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // 1. Validate Verification State
    if (!user.cfHandle || !user.cfVerificationProblem) {
      return res.status(400).json({ success: false, message: 'No pending verification. Start with /verify-cf first.' });
    }
    if (user.cfHandleVerified) {
      return res.status(400).json({ success: false, message: 'Handle already verified' });
    }

    // 2. Look for Compilation Error Submission on CF
    const [contestId, index] = user.cfVerificationProblem.split('/');
    const minTimestamp = Math.floor(user.updatedAt.getTime() / 1000) - 60; // 60s buffer for clock drift

    const submission = await cfApi.checkVerificationSubmission(
      user.cfHandle,
      parseInt(contestId),
      index,
      minTimestamp
    );

    if (!submission) {
      return res.status(400).json({
        success: false,
        message: 'No compile-error submission found. Please submit a CE solution to the verification problem and try again.',
      });
    }

    // 3. Verification Successful! Store CF Profile
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
