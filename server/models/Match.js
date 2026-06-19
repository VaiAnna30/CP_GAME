const mongoose = require('mongoose');

const cellSchema = new mongoose.Schema(
  {
    row: { type: Number, required: true },
    col: { type: Number, required: true },
    problem: {
      contestId: { type: Number, required: true },
      index: { type: String, required: true },
      name: { type: String, required: true },
      rating: { type: Number, default: 0 },
      tags: [String],
      url: { type: String },
    },
    claimedBy: {
      type: String,
      enum: ['red', 'blue', null],
      default: null,
    },
    claimedByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claimTime: { type: Date, default: null },
    submissionId: { type: Number, default: null },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'match_created',
        'team_joined',
        'player_ready',
        'match_start',
        'cell_claimed',
        'match_end',
        'forfeit',
        'overtime_start',
      ],
      required: true,
    },
    data: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['waiting', 'ready', 'in_progress', 'completed', 'abandoned'],
      default: 'waiting',
    },
    gridSize: {
      type: Number,
      default: 3,
      min: 3,
      max: 5,
    },
    teams: [
      {
        teamId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
          required: true,
        },
        teamName: { type: String },
        teamTag: { type: String },
        players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        color: {
          type: String,
          enum: ['red', 'blue'],
          required: true,
        },
        ready: { type: Boolean, default: false },
        cellsClaimed: { type: Number, default: 0 },
      },
    ],
    board: [cellSchema],
    settings: {
      difficultyRange: {
        min: { type: Number, default: 800 },
        max: { type: Number, default: 1800 },
      },
      timeLimitMinutes: { type: Number, default: 60 },
      allowedTags: [String],
    },
    events: [eventSchema],
    winner: {
      type: String,
      enum: ['red', 'blue', 'draw', null],
      default: null,
    },
    winCondition: {
      type: String,
      enum: ['line', 'tiebreak_cells', 'tiebreak_time', 'forfeit', 'overtime', 'timeout', null],
      default: null,
    },
    spectators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Index for finding active matches
matchSchema.index({ status: 1 });
matchSchema.index({ 'teams.teamId': 1 });
matchSchema.index({ 'teams.players': 1 });

// Method: check if board is full
matchSchema.methods.isBoardFull = function () {
  return this.board.every((cell) => cell.claimedBy !== null);
};

// Method: get cell at position
matchSchema.methods.getCell = function (row, col) {
  return this.board.find((c) => c.row === row && c.col === col);
};

// Method: count cells by team color
matchSchema.methods.countCells = function (color) {
  return this.board.filter((c) => c.claimedBy === color).length;
};

module.exports = mongoose.model('Match', matchSchema);
