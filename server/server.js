const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const courtRoutes = require('./routes/courts');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');
const subscriptionRoutes = require('./routes/subscriptions');
const iotRoutes = require('./routes/iot');
const analyticsRoutes = require('./routes/analytics');
const mediaRoutes = require('./routes/media');
const promoRoutes = require('./routes/promocodes');
const adminRoutes = require('./routes/admin');

// Import middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Import services
const IoTService = require('./services/iotService');
const NotificationService = require('./services/notificationService');
const AnalyticsService = require('./services/analyticsService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Настроим позже для production
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 минут
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100 // лимит запросов
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Initialize services after database connection
let analyticsService, iotService, notificationService;

connectDB().then(() => {
  // Initialize services
  analyticsService = new AnalyticsService(io);
  iotService = new IoTService(io);
  notificationService = new NotificationService(io);

  // Make services available globally
  app.locals.analyticsService = analyticsService;
  app.locals.iotService = iotService;
  app.locals.notificationService = notificationService;

  logger.logInfo('All services initialized successfully', 'SERVER');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', authMiddleware, bookingRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/payments', authMiddleware, paymentRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/subscriptions', authMiddleware, subscriptionRoutes);
app.use('/api/iot', authMiddleware, iotRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/media', authMiddleware, mediaRoutes);
app.use('/api/promocodes', authMiddleware, promoRoutes);
app.use('/api/admin', adminRoutes);

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Join user to their personal room
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
  });
  
  // Admin room for real-time analytics
  socket.on('join-admin-room', (adminId) => {
    socket.join('admin-room');
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('Connected to MongoDB Atlas');
  
  // Initialize IoT service after DB connection
  if (process.env.ENABLE_IOT === 'true') {
    iotService.initialize();
  }
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  server.close(() => {
    logger.info('HTTP server closed.');
    
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed.');
      process.exit(0);
    });
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`🚀 SportAirHub server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🌐 Client URL: ${process.env.CLIENT_URL}`);
});

module.exports = { app, server, io }; 