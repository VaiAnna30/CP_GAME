const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const connectDB = require('./config/db');
const setupSocket = require('./socket/index');
const CFPoller = require('./services/cfPoller');

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Create HTTP server
  const server = http.createServer(app);

  // Setup Socket.io
  const io = new Server(server, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  setupSocket(io);

  // Make io accessible to routes
  app.set('io', io);

  // Initialize CF Poller
  const cfPoller = new CFPoller(io);
  app.set('cfPoller', cfPoller);

  // Start server
  server.listen(env.PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║          CF Battle Royale Server             ║
║──────────────────────────────────────────────║
║  Port:        ${String(env.PORT).padEnd(30)}║
║  Environment: ${String(env.NODE_ENV).padEnd(30)}║
║  MongoDB:     Connected                      ║
║  Socket.io:   Ready                          ║
║  CF Poller:   Initialized                    ║
╚══════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down gracefully...');
    cfPoller.stopAll();
    io.close();
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
