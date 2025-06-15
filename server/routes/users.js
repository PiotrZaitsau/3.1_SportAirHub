const express = require('express');
const User = require('../models/User');
const Booking = require('../models/Booking');
const PassPurchase = require('../models/PassPurchase');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -__v')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Calculate active passes
    const activePasses = user.passes.filter(pass => pass.isActive && pass.remainingVisits > 0);
    const totalRemainingVisits = activePasses.reduce((sum, pass) => sum + pass.remainingVisits, 0);

    // Get recent bookings
    const recentBookings = await Booking.find({ userId: req.user.id })
      .populate('courtId', 'name type')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          activePasses: activePasses.length,
          totalRemainingVisits,
          recentBookings
        }
      }
    });

  } catch (error) {
    logger.logError(`Get profile error: ${error.message}`, 'USER');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении профиля'
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      preferences
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    user.updatedAt = new Date();
    await user.save();

    // Remove sensitive data
    const userResponse = user.toObject();
    delete userResponse.password;

    logger.logInfo(`Profile updated for user ${req.user.id}`, 'USER');

    res.json({
      success: true,
      message: 'Профиль обновлен',
      data: { user: userResponse }
    });

  } catch (error) {
    logger.logError(`Update profile error: ${error.message}`, 'USER');
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении профиля'
    });
  }
});

// @desc    Get user subscription info
// @route   GET /api/users/subscription
// @access  Private
router.get('/subscription', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('subscription')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Calculate days remaining
    let daysRemaining = 0;
    if (user.subscription.isActive && user.subscription.endDate) {
      const now = new Date();
      const endDate = new Date(user.subscription.endDate);
      daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
    }

    res.json({
      success: true,
      data: {
        subscription: {
          ...user.subscription,
          daysRemaining
        }
      }
    });

  } catch (error) {
    logger.logError(`Get subscription error: ${error.message}`, 'USER');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении информации об абонементе'
    });
  }
});

// @desc    Get user passes
// @route   GET /api/users/passes
// @access  Private
router.get('/passes', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('passes')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Get pass purchase details
    const passIds = user.passes.map(pass => pass.purchaseId).filter(Boolean);
    const purchases = await PassPurchase.find({ _id: { $in: passIds } })
      .select('createdAt totalPrice quantity')
      .lean();

    const purchaseMap = purchases.reduce((map, purchase) => {
      map[purchase._id] = purchase;
      return map;
    }, {});

    // Enrich passes with purchase info
    const enrichedPasses = user.passes.map(pass => ({
      ...pass,
      purchaseInfo: purchaseMap[pass.purchaseId] || null
    }));

    // Separate active and expired passes
    const activePasses = enrichedPasses.filter(pass => pass.isActive && pass.remainingVisits > 0);
    const expiredPasses = enrichedPasses.filter(pass => !pass.isActive || pass.remainingVisits === 0);

    res.json({
      success: true,
      data: {
        activePasses,
        expiredPasses,
        totalActive: activePasses.length,
        totalRemainingVisits: activePasses.reduce((sum, pass) => sum + pass.remainingVisits, 0)
      }
    });

  } catch (error) {
    logger.logError(`Get passes error: ${error.message}`, 'USER');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении пропусков'
    });
  }
});

// @desc    Get user bookings history
// @route   GET /api/users/bookings
// @access  Private
router.get('/bookings', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, from, to } = req.query;

    // Build query
    const query = { userId: req.user.id };
    
    if (status) {
      query.status = status;
    }

    if (from || to) {
      query.startTime = {};
      if (from) query.startTime.$gte = new Date(from);
      if (to) query.startTime.$lte = new Date(to);
    }

    const bookings = await Booking.find(query)
      .populate('courtId', 'name type location images')
      .sort({ startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Booking.countDocuments(query);

    // Calculate statistics
    const stats = await Booking.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalSpent: { $sum: '$totalPrice' },
          averageSpent: { $avg: '$totalPrice' },
          totalHours: { $sum: { $divide: ['$duration', 60] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        stats: stats[0] || {
          totalBookings: 0,
          totalSpent: 0,
          averageSpent: 0,
          totalHours: 0
        }
      }
    });

  } catch (error) {
    logger.logError(`Get user bookings error: ${error.message}`, 'USER');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении истории бронирований'
    });
  }
});

// @desc    Get loyalty program info
// @route   GET /api/users/loyalty
// @access  Private
router.get('/loyalty', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('loyaltyProgram')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Calculate points needed for next level
    let pointsToNextLevel = 0;
    let nextLevel = null;

    switch (user.loyaltyProgram.level) {
      case 'bronze':
        pointsToNextLevel = 1000 - user.loyaltyProgram.thisYearPoints;
        nextLevel = 'silver';
        break;
      case 'silver':
        pointsToNextLevel = 2500 - user.loyaltyProgram.thisYearPoints;
        nextLevel = 'gold';
        break;
      case 'gold':
        pointsToNextLevel = 0;
        nextLevel = null;
        break;
    }

    // Calculate discount percentage
    let discountPercentage = 0;
    switch (user.loyaltyProgram.level) {
      case 'silver':
        discountPercentage = 5;
        break;
      case 'gold':
        discountPercentage = 10;
        break;
    }

    res.json({
      success: true,
      data: {
        loyaltyProgram: {
          ...user.loyaltyProgram,
          pointsToNextLevel: Math.max(0, pointsToNextLevel),
          nextLevel,
          discountPercentage
        }
      }
    });

  } catch (error) {
    logger.logError(`Get loyalty info error: ${error.message}`, 'USER');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении информации о программе лояльности'
    });
  }
});

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
router.delete('/account', async (req, res) => {
  try {
    const { password, reason } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо подтвердить пароль'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Неверный пароль'
      });
    }

    // Check for active bookings
    const activeBookings = await Booking.countDocuments({
      userId: req.user.id,
      status: { $in: ['confirmed', 'in_progress'] },
      startTime: { $gte: new Date() }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        success: false,
        message: 'Невозможно удалить аккаунт с активными бронированиями'
      });
    }

    // Mark user as deleted (soft delete)
    user.isActive = false;
    user.deletedAt = new Date();
    user.deletionReason = reason || 'User request';
    user.email = `deleted_${Date.now()}@sportairhub.deleted`;
    
    await user.save();

    logger.logInfo(`User account deleted: ${req.user.id}, reason: ${reason}`, 'USER');

    res.json({
      success: true,
      message: 'Аккаунт удален'
    });

  } catch (error) {
    logger.logError(`Delete account error: ${error.message}`, 'USER');
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении аккаунта'
    });
  }
});

module.exports = router;
