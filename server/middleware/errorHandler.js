const logger = require('../utils/logger');

// Кастомный класс для API ошибок
class APIError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Обработка ошибок валидации Mongoose
const handleValidationError = (error) => {
  const errors = Object.values(error.errors).map(err => ({
    field: err.path,
    message: err.message,
    value: err.value
  }));
  
  return new APIError('Validation failed', 400, errors);
};

// Обработка ошибок дублирования ключей MongoDB
const handleDuplicateKeyError = (error) => {
  const field = Object.keys(error.keyValue)[0];
  const value = error.keyValue[field];
  
  return new APIError(
    `${field} '${value}' already exists`,
    409,
    [{
      field: field,
      message: `${field} must be unique`,
      value: value
    }]
  );
};

// Обработка ошибок приведения типов Mongoose
const handleCastError = (error) => {
  return new APIError(
    `Invalid ${error.path}: ${error.value}`,
    400,
    [{
      field: error.path,
      message: `Invalid ${error.path}`,
      value: error.value
    }]
  );
};

// Обработка JWT ошибок
const handleJWTError = () => {
  return new APIError('Invalid token. Please login again.', 401);
};

const handleJWTExpiredError = () => {
  return new APIError('Token expired. Please login again.', 401);
};

// Обработка Stripe ошибок
const handleStripeError = (error) => {
  let message = 'Payment processing failed';
  let statusCode = 400;
  
  switch (error.type) {
    case 'StripeCardError':
      message = error.message;
      statusCode = 402;
      break;
    case 'StripeRateLimitError':
      message = 'Too many requests made to Stripe API';
      statusCode = 429;
      break;
    case 'StripeInvalidRequestError':
      message = 'Invalid parameters for payment request';
      statusCode = 400;
      break;
    case 'StripeAPIError':
      message = 'Payment service temporarily unavailable';
      statusCode = 503;
      break;
    case 'StripeConnectionError':
      message = 'Network communication with payment service failed';
      statusCode = 503;
      break;
    case 'StripeAuthenticationError':
      message = 'Payment service authentication failed';
      statusCode = 500;
      break;
    default:
      message = error.message || message;
  }
  
  return new APIError(message, statusCode);
};

// Обработка ошибок Multer (загрузка файлов)
const handleMulterError = (error) => {
  let message = 'File upload failed';
  let statusCode = 400;
  
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      message = 'File too large';
      statusCode = 413;
      break;
    case 'LIMIT_FILE_COUNT':
      message = 'Too many files';
      statusCode = 400;
      break;
    case 'LIMIT_UNEXPECTED_FILE':
      message = 'Unexpected file field';
      statusCode = 400;
      break;
    case 'MISSING_FIELD_NAME':
      message = 'Missing field name';
      statusCode = 400;
      break;
    default:
      message = error.message || message;
  }
  
  return new APIError(message, statusCode);
};

// Основной обработчик ошибок
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Логирование ошибки
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
    params: req.params,
    query: req.query
  });
  
  // Обработка специфических типов ошибок
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  } else if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  } else if (err.name === 'CastError') {
    error = handleCastError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  } else if (err.type && err.type.startsWith('Stripe')) {
    error = handleStripeError(err);
  } else if (err.code && err.code.startsWith('LIMIT_')) {
    error = handleMulterError(err);
  }
  
  // Установка статуса по умолчанию для неопознанных ошибок
  if (!error.statusCode) {
    error.statusCode = 500;
  }
  
  // Формирование ответа
  const response = {
    success: false,
    message: error.message || 'Internal Server Error',
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      originalError: err.name
    })
  };
  
  // Добавление дополнительной информации для разработки
  if (process.env.NODE_ENV === 'development') {
    response.request = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    };
  }
  
  res.status(error.statusCode).json(response);
};

// Обработчик для несуществующих роутов
const notFoundHandler = (req, res, next) => {
  const error = new APIError(
    `Route ${req.originalUrl} not found`,
    404
  );
  next(error);
};

// Обработчик для неперехваченных исключений
const uncaughtExceptionHandler = (err) => {
  logger.error('Uncaught Exception:', err);
  
  // Graceful shutdown
  process.exit(1);
};

// Обработчик для неперехваченных промисов
const unhandledRejectionHandler = (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  
  // Graceful shutdown
  process.exit(1);
};

// Wrapper для async функций
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation middleware для проверки required полей
const validateRequired = (fields) => {
  return (req, res, next) => {
    const errors = [];
    
    fields.forEach(field => {
      if (!req.body[field]) {
        errors.push({
          field: field,
          message: `${field} is required`,
          value: req.body[field]
        });
      }
    });
    
    if (errors.length > 0) {
      return next(new APIError('Validation failed', 400, errors));
    }
    
    next();
  };
};

// Middleware для валидации ObjectId
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const mongoose = require('mongoose');
    const id = req.params[paramName];
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new APIError(`Invalid ${paramName}`, 400));
    }
    
    next();
  };
};

// Middleware для проверки лимитов пагинации
const validatePagination = (req, res, next) => {
  let { page = 1, limit = 10 } = req.query;
  
  page = parseInt(page);
  limit = parseInt(limit);
  
  if (page < 1) {
    return next(new APIError('Page must be greater than 0', 400));
  }
  
  if (limit < 1 || limit > 100) {
    return next(new APIError('Limit must be between 1 and 100', 400));
  }
  
  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit
  };
  
  next();
};

// Middleware для проверки формата email
const validateEmail = (fieldName = 'email') => {
  return (req, res, next) => {
    const email = req.body[fieldName];
    
    if (!email) {
      return next();
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return next(new APIError(`Invalid ${fieldName} format`, 400));
    }
    
    next();
  };
};

// Middleware для проверки формата телефона
const validatePhone = (fieldName = 'phone') => {
  return (req, res, next) => {
    const phone = req.body[fieldName];
    
    if (!phone) {
      return next();
    }
    
    // Простая проверка формата телефона (можно усложнить)
    const phoneRegex = /^[\+]?[1-9][\d]{7,14}$/;
    
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      return next(new APIError(`Invalid ${fieldName} format`, 400));
    }
    
    next();
  };
};

// Middleware для проверки диапазона дат
const validateDateRange = (startField = 'startDate', endField = 'endDate') => {
  return (req, res, next) => {
    const startDate = req.body[startField] || req.query[startField];
    const endDate = req.body[endField] || req.query[endField];
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        return next(new APIError(`${startField} must be before ${endField}`, 400));
      }
    }
    
    next();
  };
};

module.exports = {
  APIError,
  errorHandler,
  notFoundHandler,
  uncaughtExceptionHandler,
  unhandledRejectionHandler,
  asyncHandler,
  validateRequired,
  validateObjectId,
  validatePagination,
  validateEmail,
  validatePhone,
  validateDateRange
}; 