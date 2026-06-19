const Match = require('../models/Match');

const matchHandlers = (io, socket) => {
  // Join a match room
  socket.on('join_match', async (matchId) => {
    try {
      const match = await Match.findById(matchId);
      if (!match) {
        socket.emit('error_message', { message: 'Match not found' });
        return;
      }

      socket.join(`match_${matchId}`);
      console.log(`User ${socket.userId} joined match room: ${matchId}`);

      // Notify others in the room
      socket.to(`match_${matchId}`).emit('player_joined_room', {
        userId: socket.userId,
        matchId,
      });

      // Send current match state to the joining user
      const populated = await Match.findById(matchId)
        .populate('teams.teamId', 'name tag')
        .populate('teams.players', 'username cfHandle cfProfile');

      socket.emit('match_state', populated);
    } catch (error) {
      socket.emit('error_message', { message: 'Failed to join match room' });
    }
  });

  // Leave a match room
  socket.on('leave_match', (matchId) => {
    socket.leave(`match_${matchId}`);
    console.log(`User ${socket.userId} left match room: ${matchId}`);

    socket.to(`match_${matchId}`).emit('player_left_room', {
      userId: socket.userId,
      matchId,
    });
  });

  // Spectate a match
  socket.on('spectate_match', async (matchId) => {
    try {
      socket.join(`match_${matchId}`);
      console.log(`Spectator ${socket.userId} watching match: ${matchId}`);

      const populated = await Match.findById(matchId)
        .populate('teams.teamId', 'name tag')
        .populate('teams.players', 'username cfHandle cfProfile');

      socket.emit('match_state', populated);
    } catch (error) {
      socket.emit('error_message', { message: 'Failed to spectate match' });
    }
  });

  // Chat message in match room
  socket.on('match_chat', (data) => {
    const { matchId, message } = data;
    io.to(`match_${matchId}`).emit('match_chat', {
      userId: socket.userId,
      message,
      timestamp: new Date(),
    });
  });
};

module.exports = matchHandlers;
