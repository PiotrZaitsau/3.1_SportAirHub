const express = require('express');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Court = require('../models/Court');
const logger = require('../utils/logger');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);
router.use(authorize('admin', 'manager'));

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
// @access  Admin/Manager
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalUsers,
      activeSubscriptions,
      todayBookings,
      todayRevenue,
      totalCourts,
      activeCourts
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ 'subscription.isActive': true }),
      Booking.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
        status: { $in: ['confirmed', 'completed'] }
      }),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: today, $lt: tomorrow },
            status: { $in: ['confirmed', 'completed'] }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Court.countDocuments({}),
      Court.countDocuments({ isActive: true })
    ]);

    const stats = {
      users: {
        total: totalUsers,
        activeSubscriptions
      },
      bookings: {
        today: todayBookings,
        revenue: todayRevenue[0]?.total || 0
      },
      courts: {
        total: totalCourts,
        active: activeCourts
      }
    };

    // Get real-time stats if analytics service is available
    if (req.app.locals.analyticsService) {
      const realtimeStats = req.app.locals.analyticsService.getRealtimeStats();
      stats.realtime = realtimeStats;
    }

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.logError(`Admin dashboard error: ${error.message}`, 'ADMIN');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики'
    });
  }
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin/Manager
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, subscription } = req.query;

    // Build query
    const query = { isActive: true };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      query.role = role;
    }

    if (subscription === 'active') {
      query['subscription.isActive'] = true;
    } else if (subscription === 'inactive') {
      query['subscription.isActive'] = false;
    }

    const users = await User.find(query)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.logError(`Get admin users error: ${error.message}`, 'ADMIN');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении пользователей'
    });
  }
});

// @desc    Get single user details
// @route   GET /api/admin/users/:id
// @access  Admin/Manager
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Get user's bookings
    const bookings = await Booking.find({ userId: req.params.id })
      .populate('courtId', 'name type')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Calculate user statistics
    const stats = await Booking.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalSpent: { $sum: '$totalPrice' },
          averageSpent: { $avg: '$totalPrice' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        user,
        recentBookings: bookings,
        stats: stats[0] || { totalBookings: 0, totalSpent: 0, averageSpent: 0 }
      }
    });

  } catch (error) {
    logger.logError(`Get admin user details error: ${error.message}`, 'ADMIN');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении данных пользователя'
    });
  }
});

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Admin
router.put('/users/:id', authorize('admin'), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      role,
      isActive,
      subscription
    } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    
    if (subscription) {
      user.subscription = { ...user.subscription, ...subscription };
    }

    user.updatedAt = new Date();
    await user.save();

    logger.logInfo(`User ${req.params.id} updated by admin ${req.user.id}`, 'ADMIN');

    res.json({
      success: true,
      message: 'Пользователь обновлен',
      data: { user: user.toObject({ transform: (doc, ret) => { delete ret.password; return ret; } }) }
    });

  } catch (error) {
    logger.logError(`Update user error: ${error.message}`, 'ADMIN');
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении пользователя'
    });
  }
});

// @desc    Get all bookings
// @route   GET /api/admin/bookings
// @access  Admin/Manager
router.get('/bookings', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      courtId, 
      from, 
      to,
      search 
    } = req.query;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }

    if (courtId) {
      query.courtId = courtId;
    }

    if (from || to) {
      query.startTime = {};
      if (from) query.startTime.$gte = new Date(from);
      if (to) query.startTime.$lte = new Date(to);
    }

    if (search) {
      // Search by user name or email
      const users = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      if (users.length > 0) {
        query.userId = { $in: users.map(u => u._id) };
      }
    }

    const bookings = await Booking.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('courtId', 'name type location')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.logError(`Get admin bookings error: ${error.message}`, 'ADMIN');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении бронирований'
    });
  }
});

// @desc    Update booking status
// @route   PUT /api/admin/bookings/:id/status
// @access  Admin/Manager
router.put('/bookings/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать статус'
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Бронирование не найдено'
      });
    }

    const oldStatus = booking.status;
    booking.status = status;

    // Add admin note if provided
    if (reason) {
      if (!booking.adminNotes) booking.adminNotes = [];
      booking.adminNotes.push({
        note: reason,
        adminId: req.user.id,
        timestamp: new Date()
      });
    }

    await booking.save();

    // Send notification if status changed significantly
    if (req.app.locals.notificationService && oldStatus !== status) {
      if (status === 'cancelled') {
        req.app.locals.notificationService.sendBookingCancellation(booking._id, reason);
      } else if (status === 'confirmed') {
        req.app.locals.notificationService.sendBookingConfirmation(booking._id);
      }
    }

    logger.logInfo(`Booking ${req.params.id} status changed from ${oldStatus} to ${status} by admin ${req.user.id}`, 'ADMIN');

    res.json({
      success: true,
      message: 'Статус бронирования обновлен',
      data: { booking }
    });

  } catch (error) {
    logger.logError(`Update booking status error: ${error.message}`, 'ADMIN');
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении статуса'
    });
  }
});

// @desc    Get analytics
// @route   GET /api/admin/analytics
// @access  Admin/Manager
router.get('/analytics', async (req, res) => {
  try {
    const { period = '7d', metrics = 'bookings,revenue,users' } = req.query;

    let data = {};

    if (req.app.locals.analyticsService) {
      const metricsArray = metrics.split(',');
      
      if (period === '7d') {
        data = req.app.locals.analyticsService.getDailyMetrics(7);
      } else if (period === '24h') {
        data = req.app.locals.analyticsService.getHourlyMetrics(24);
      } else if (period === '30d') {
        data = req.app.locals.analyticsService.getDailyMetrics(30);
      }
    } else {
      // Fallback basic analytics
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const bookingStats = await Booking.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$totalPrice' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      data = bookingStats;
    }

    res.json({
      success: true,
      data: {
        period,
        metrics: metrics.split(','),
        analytics: data
      }
    });

  } catch (error) {
    logger.logError(`Get analytics error: ${error.message}`, 'ADMIN');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении аналитики'
    });
  }
});

// @desc    Get system logs
// @route   GET /api/admin/logs
// @access  Admin
router.get('/logs', authorize('admin'), async (req, res) => {
  try {
    const { level = 'info', limit = 100, from, to } = req.query;

    // This would typically read from log files or a logging service
    // For now, return a placeholder response
    const logs = [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'System operational',
        module: 'SYSTEM'
      }
    ];

    res.json({
      success: true,
      data: {
        logs,
        filters: { level, limit, from, to }
      }
    });

  } catch (error) {
    logger.logError(`Get logs error: ${error.message}`, 'ADMIN');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении логов'
    });
  }
});

module.exports = router; 