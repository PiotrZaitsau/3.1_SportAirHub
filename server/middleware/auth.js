const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Middleware для проверки JWT токена
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Проверка валидности токена
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Получение пользователя из базы данных
    const user = await User.findById(decoded.userId)
      .populate('activeSubscriptions')
      .populate('passPurchases');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Проверка активности аккаунта
    if (!user.isActive || user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive or blocked',
        details: {
          isActive: user.isActive,
          isBlocked: user.isBlocked,
          blockReason: user.blockReason,
          blockExpiresAt: user.blockExpiresAt
        }
      });
    }

    // Проверка истечения блокировки
    if (user.blockExpiresAt && user.blockExpiresAt < new Date()) {
      user.isBlocked = false;
      user.blockReason = null;
      user.blockExpiresAt = null;
      await user.save();
    }

    // Обновление последнего входа
    user.lastLoginAt = new Date();
    user.loginCount += 1;
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

// Middleware для проверки ролей
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        details: {
          userRole: req.user.role,
          requiredRoles: allowedRoles
        }
      });
    }

    next();
  };
};

// Middleware для проверки конкретных разрешений
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Владельцы имеют все права
    if (req.user.role === 'owner') {
      return next();
    }

    // Проверяем наличие хотя бы одного из требуемых разрешений
    const hasPermission = permissions.some(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        details: {
          userPermissions: req.user.permissions,
          requiredPermissions: permissions
        }
      });
    }

    next();
  };
};

// Middleware для владельца ресурса или администратора
const requireOwnershipOrAdmin = (resourceUserField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Администраторы и владельцы имеют доступ ко всем ресурсам
    if (['admin', 'owner'].includes(req.user.role)) {
      return next();
    }

    // Проверяем владение ресурсом
    const resourceUserId = req.params.userId || req.body[resourceUserField] || req.query.userId;
    
    if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied: You can only access your own resources'
    });
  };
};

// Middleware для проверки уровня лояльности
const requireLoyaltyLevel = (...allowedLevels) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedLevels.includes(req.user.loyaltyLevel)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient loyalty level',
        details: {
          userLevel: req.user.loyaltyLevel,
          requiredLevels: allowedLevels
        }
      });
    }

    next();
  };
};

// Middleware для проверки активной подписки
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Проверяем наличие активной подписки
    const activeSubscription = req.user.activeSubscriptions.find(sub => {
      const now = new Date();
      return sub.status === 'active' && 
             sub.startDate <= now && 
             sub.endDate >= now;
    });

    if (!activeSubscription) {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required',
        details: {
          hasSubscription: false,
          subscriptionCount: req.user.activeSubscriptions.length
        }
      });
    }

    req.activeSubscription = activeSubscription;
    next();
  } catch (error) {
    logger.error('Subscription check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking subscription status'
    });
  }
};

// Middleware для rate limiting на основе пользователя
const userRateLimit = (maxRequests = 100, windowMinutes = 15) => {
  const requests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    if (!requests.has(userId)) {
      requests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userRequests = requests.get(userId);

    if (now > userRequests.resetTime) {
      userRequests.count = 1;
      userRequests.resetTime = now + windowMs;
      return next();
    }

    if (userRequests.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests',
        details: {
          limit: maxRequests,
          windowMinutes: windowMinutes,
          resetTime: new Date(userRequests.resetTime)
        }
      });
    }

    userRequests.count++;
    next();
  };
};

// Middleware для проверки верификации email
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
      details: {
        isEmailVerified: false,
        email: req.user.email
      }
    });
  }

  next();
};

// Middleware для логирования действий пользователей
const logUserAction = (action, resourceType = null) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Логируем только успешные действия
      if (res.statusCode < 400) {
        logger.info('User action', {
          userId: req.user?._id,
          userEmail: req.user?.email,
          action: action,
          resourceType: resourceType,
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date()
        });
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Optional middleware - не блокирует запрос если пользователь не авторизован
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId)
        .populate('activeSubscriptions')
        .populate('passPurchases');

      if (user && user.isActive && !user.isBlocked) {
        req.user = user;
      }
    }
  } catch (error) {
    // Игнорируем ошибки для опционального middleware
    logger.debug('Optional auth failed:', error.message);
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireOwnershipOrAdmin,
  requireLoyaltyLevel,
  requireActiveSubscription,
  requireEmailVerification,
  userRateLimit,
  logUserAction,
  optionalAuth
}; 