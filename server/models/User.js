const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    cfHandle: {
      type: String,
      default: null,
      trim: true,
    },
    cfHandleVerified: {
      type: Boolean,
      default: false,
    },
    cfVerificationProblem: {
      type: String,
      default: null,
    },
    cfProfile: {
      rating: { type: Number, default: 0 },
      maxRating: { type: Number, default: 0 },
      rank: { type: String, default: 'unrated' },
      avatar: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    stats: {
      matchesPlayed: { type: Number, default: 0 },
      matchesWon: { type: Number, default: 0 },
      totalSolves: { type: Number, default: 0 },
      avgSolveTime: { type: Number, default: 0 },
      fastestWin: { type: Number, default: null },
      eloRating: { type: Number, default: 1200 },
    },
    achievements: [
      {
        type: { type: String },
        name: { type: String },
        description: { type: String },
        unlockedAt: { type: Date, default: Date.now },
      },
    ],
    notifications: {
      email: { type: Boolean, default: false },
      discord: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Generate JWT
userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE,
  });
};

// Compute win rate
userSchema.virtual('winRate').get(function () {
  if (this.stats.matchesPlayed === 0) return 0;
  return ((this.stats.matchesWon / this.stats.matchesPlayed) * 100).toFixed(1);
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
