const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    tag: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 5,
    },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    inviteCode: {
      type: String,
      default: () => Math.random().toString(36).substring(2, 8).toUpperCase(),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Team', teamSchema);
