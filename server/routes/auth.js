const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Слишком много попыток входа. Попробуйте через 15 минут.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: {
    error: 'Слишком много попыток регистрации. Попробуйте через час.'
  }
});

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', registrationLimiter, async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      dateOfBirth,
      acceptedTerms,
      marketingConsent
    } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Пожалуйста, заполните все обязательные поля'
      });
    }

    if (!acceptedTerms) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо принять условия использования'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'phone';
      return res.status(400).json({
        success: false,
        message: `Пользователь с таким ${field === 'email' ? 'email' : 'телефоном'} уже существует`
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      profile: {
        marketingConsent: marketingConsent || false
      },
      termsAccepted: {
        accepted: true,
        acceptedAt: new Date(),
        version: '1.0'
      },
      isVerified: false,
      lastActive: new Date()
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Send welcome notification
    if (req.app.locals.notificationService) {
      req.app.locals.notificationService.sendWelcomeNotification(user._id);
    }

    // Track user registration
    if (req.app.locals.analyticsService) {
      req.app.locals.analyticsService.trackUserAction(user._id, 'user_registered', {
        source: 'web',
        marketingConsent
      });
    }

    logger.logInfo(`New user registered: ${email}`, 'AUTH');

    res.status(201).json({
      success: true,
      message: 'Регистрация успешна',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified
        }
      }
    });

  } catch (error) {
    logger.logError(`Registration error: ${error.message}`, 'AUTH');
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при регистрации'
    });
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Пожалуйста, введите email и пароль'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Аккаунт заблокирован. Обратитесь к администратору.'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }

    // Update last active time
    user.lastActive = new Date();
    await user.save();

    // Generate JWT with appropriate expiration
    const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRE || '7d');
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    // Track user login
    if (req.app.locals.analyticsService) {
      req.app.locals.analyticsService.trackUserAction(user._id, 'user_login', {
        source: 'web',
        rememberMe,
        ip: req.ip
      });
      req.app.locals.analyticsService.updateUserActivity(user._id);
    }

    logger.logInfo(`User logged in: ${email}`, 'AUTH');

    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified,
          profile: {
            avatar: user.profile.avatar,
            phone: user.phone
          },
          subscription: user.subscription,
          loyaltyProgram: user.loyaltyProgram
        }
      }
    });

  } catch (error) {
    logger.logError(`Login error: ${error.message}`, 'AUTH');
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при входе'
    });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // In a more sophisticated system, you'd invalidate the token
    // For now, we'll just track the logout event
    
    if (req.app.locals.analyticsService) {
      req.app.locals.analyticsService.trackUserAction(req.user.id, 'user_logout', {
        source: 'web'
      });
    }

    logger.logInfo(`User logged out: ${req.user.email}`, 'AUTH');

    res.json({
      success: true,
      message: 'Выход выполнен успешно'
    });

  } catch (error) {
    logger.logError(`Logout error: ${error.message}`, 'AUTH');
    res.status(500).json({
      success: false,
      message: 'Ошибка при выходе'
    });
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('passes.passType')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
          isVerified: user.isVerified,
          profile: user.profile,
          subscription: user.subscription,
          passes: user.passes,
          loyaltyProgram: user.loyaltyProgram,
          notificationPreferences: user.notificationPreferences,
          lastActive: user.lastActive
        }
      }
    });

  } catch (error) {
    logger.logError(`Get user profile error: ${error.message}`, 'AUTH');
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении профиля'
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      profile,
      notificationPreferences
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }
    if (notificationPreferences) {
      user.notificationPreferences = { ...user.notificationPreferences, ...notificationPreferences };
    }

    await user.save();

    logger.logInfo(`User profile updated: ${user.email}`, 'AUTH');

    res.json({
      success: true,
      message: 'Профиль обновлен',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profile: user.profile,
          notificationPreferences: user.notificationPreferences
        }
      }
    });

  } catch (error) {
    logger.logError(`Update profile error: ${error.message}`, 'AUTH');
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении профиля'
    });
  }
});

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать текущий и новый пароль'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Неверный текущий пароль'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    logger.logInfo(`Password changed for user: ${user.email}`, 'AUTH');

    res.json({
      success: true,
      message: 'Пароль успешно изменен'
    });

  } catch (error) {
    logger.logError(`Change password error: ${error.message}`, 'AUTH');
    res.status(500).json({
      success: false,
      message: 'Ошибка при смене пароля'
    });
  }
});

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать email'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal whether user exists for security
      return res.json({
        success: true,
        message: 'Если аккаунт с таким email существует, инструкции отправлены на почту'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { id: user._id, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // In a real app, you'd send an email with the reset link
    // For now, we'll just log it (in production, you'd use a proper email service)
    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    logger.logInfo(`Password reset requested for: ${email}. Reset link: ${resetLink}`, 'AUTH');

    // Here you would send the email with the reset link
    // await emailService.sendPasswordResetEmail(user.email, resetLink);

    res.json({
      success: true,
      message: 'Инструкции по сбросу пароля отправлены на почту'
    });

  } catch (error) {
    logger.logError(`Forgot password error: ${error.message}`, 'AUTH');
    res.status(500).json({
      success: false,
      message: 'Ошибка при запросе сброса пароля'
    });
  }
});

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать токен и новый пароль'
      });
    }

    // Verify reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Неверный токен'
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    logger.logInfo(`Password reset completed for user: ${user.email}`, 'AUTH');

    res.json({
      success: true,
      message: 'Пароль успешно сброшен'
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Неверный или истекший токен'
      });
    }

    logger.logError(`Reset password error: ${error.message}`, 'AUTH');
    res.status(500).json({
      success: false,
      message: 'Ошибка при сбросе пароля'
    });
  }
});

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Private
router.post('/verify-email', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email уже подтвержден'
      });
    }

    // In a real app, you'd send a verification email
    // For now, we'll just mark as verified
    user.isVerified = true;
    await user.save();

    logger.logInfo(`Email verified for user: ${user.email}`, 'AUTH');

    res.json({
      success: true,
      message: 'Email успешно подтвержден'
    });

  } catch (error) {
    logger.logError(`Email verification error: ${error.message}`, 'AUTH');
    res.status(500).json({
      success: false,
      message: 'Ошибка при подтверждении email'
    });
  }
});

module.exports = router; 