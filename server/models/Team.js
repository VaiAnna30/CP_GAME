const mongoose = require('mongoose');
const crypto = require('crypto');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      minlength: [2, 'Team name must be at least 2 characters'],
      maxlength: [30, 'Team name cannot exceed 30 characters'],
    },
    tag: {
      type: String,
      required: [true, 'Team tag is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Tag must be 2-5 characters'],
      maxlength: [5, 'Tag must be 2-5 characters'],
    },
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    inviteCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(4).toString('hex').toUpperCase(),
    },
    maxSize: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
    },
    stats: {
      matchesPlayed: { type: Number, default: 0 },
      matchesWon: { type: Number, default: 0 },
      winStreak: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Virtual: average CF rating of members
teamSchema.virtual('avgRating').get(function () {
  // This will be populated at query-time
  return this._avgRating || 0;
});

// Virtual: member count
teamSchema.virtual('memberCount').get(function () {
  return this.members ? this.members.length : 0;
});

// Virtual: win rate
teamSchema.virtual('winRate').get(function () {
  if (this.stats.matchesPlayed === 0) return 0;
  return ((this.stats.matchesWon / this.stats.matchesPlayed) * 100).toFixed(1);
});

teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Team', teamSchema);
