const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const logger = require('./src/utils/logger');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
}));
app.use(compression());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Auth disabled per request; all /api routes are public

// Health check endpoint (must be first)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// Debug endpoint to check build files
app.get('/debug', (req, res) => {
  const buildPaths = [
    path.join(__dirname, 'client/build'),
    path.join(__dirname, 'react-build'),
    path.join(__dirname, 'build')
  ];
  
  const debugInfo = {
    environment: process.env.NODE_ENV || 'development',
    buildPaths: buildPaths.map(buildPath => ({
      path: buildPath,
      exists: fs.existsSync(buildPath),
      hasIndex: fs.existsSync(path.join(buildPath, 'index.html'))
    })),
    currentDir: __dirname,
    files: fs.readdirSync(__dirname)
  };
  
  res.json(debugInfo);
});

// Simple root endpoint for testing (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Telegram Bot Platform API is running - DOCKER DEPLOYMENT',
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.3',
      build: 'Docker deployment with pre-built React files',
      deployment: 'Docker'
    });
  });
}

// Initialize MongoDB first
const { connectMongo, Schedule } = require('./src/utils/db');

connectMongo().then(() => {
  logger.info('MongoDB connected');
}).catch((e) => {
  logger.error('MongoDB connection failed:', e);
});

// Initialize bot manager with error handling
let botManager;
try {
  const BotManager = require('./src/botManager');
  botManager = BotManager.getInstance(io);
  logger.info('BotManager initialized successfully');
} catch (error) {
  logger.error('Failed to initialize BotManager:', error);
  // Continue without bot manager for now
  botManager = null;
}

// API Routes with error handling
try {
  app.use('/api/bots', require('./src/routes/bots'));
  app.use('/api/files', require('./src/routes/files'));
  app.use('/api/logs', require('./src/routes/logs'));
  // Auth routes removed per request (no authentication)
  app.use('/api/backups', require('./src/routes/backups'));
  app.use('/api/metrics', require('./src/routes/metrics'));
  app.use('/api/github', require('./src/routes/github'));
  app.use('/api/schedule', require('./src/routes/schedule'));
  logger.info('API routes loaded successfully');
} catch (error) {
  logger.error('Failed to load API routes:', error);
  // Add fallback routes
  app.use('/api/bots', (req, res) => res.status(503).json({ error: 'API temporarily unavailable' }));
  app.use('/api/files', (req, res) => res.status(503).json({ error: 'API temporarily unavailable' }));
  app.use('/api/logs', (req, res) => res.status(503).json({ error: 'API temporarily unavailable' }));
  app.use('/api/backups', (req, res) => res.status(503).json({ error: 'API temporarily unavailable' }));
  app.use('/api/metrics', (req, res) => res.status(503).json({ error: 'API temporarily unavailable' }));
  app.use('/api/github', (req, res) => res.status(503).json({ error: 'API temporarily unavailable' }));
  app.use('/api/schedule', (req, res) => res.status(503).json({ error: 'API temporarily unavailable' }));
}

// Static files (only in production)
if (process.env.NODE_ENV === 'production') {
  // Try multiple possible build locations
  const buildPaths = [
    path.join(__dirname, 'client/build'),
    path.join(__dirname, 'react-build'),
    path.join(__dirname, 'build')
  ];
  
  let buildPath = null;
  let indexPath = null;
  
  for (const buildPathOption of buildPaths) {
    const indexFile = path.join(buildPathOption, 'index.html');
    if (fs.existsSync(buildPathOption) && fs.existsSync(indexFile)) {
      buildPath = buildPathOption;
      indexPath = indexFile;
      break;
    }
  }
  
  if (buildPath && indexPath) {
    app.use(express.static(buildPath));
    
    // Serve React app for all other routes
    app.get('*', (req, res) => {
      res.sendFile(indexPath);
    });
    logger.info('Static files configured for production from:', buildPath);
    logger.info('React app will be served for all routes');
  } else {
    logger.error('React build files not found in any location');
    logger.error('Checked paths:', buildPaths);
    
    // Fallback: serve a simple HTML page
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id} from ${socket.handshake.address}`);

  socket.on('join-bot-room', (botId) => {
    socket.join(`bot-${botId}`);
    logger.info(`Client ${socket.id} joined bot room: ${botId}`);
  });

  socket.on('leave-bot-room', (botId) => {
    socket.leave(`bot-${botId}`);
    logger.info(`Client ${socket.id} left bot room: ${botId}`);
  });

  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}:`, error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  try {
    if (botManager) {
      await botManager.stopAllBots();
    }
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  
  try {
    if (botManager) {
      await botManager.stopAllBots();
    }
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
  }
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on ${HOST}:${PORT}`);
  logger.info(`📱 Platform is ready to host Telegram bots!`);
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
  process.exit(1);
});

module.exports = { app, server, botManager };