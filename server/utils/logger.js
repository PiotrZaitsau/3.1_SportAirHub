const winston = require('winston');
const path = require('path');

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for log levels
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define log format for files (without colors)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: logFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: fileLogFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: fileLogFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels: logLevels,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Stream object for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helper methods for different log types
logger.logError = (error, context = '') => {
  const errorMessage = error.stack || error.message || error;
  logger.error(`${context ? `[${context}] ` : ''}${errorMessage}`);
};

logger.logInfo = (message, context = '') => {
  logger.info(`${context ? `[${context}] ` : ''}${message}`);
};

logger.logWarning = (message, context = '') => {
  logger.warn(`${context ? `[${context}] ` : ''}${message}`);
};

logger.logDebug = (message, context = '') => {
  logger.debug(`${context ? `[${context}] ` : ''}${message}`);
};

// Log system information on startup
logger.logInfo('Logger service initialized', 'SYSTEM');
logger.logInfo(`Environment: ${process.env.NODE_ENV}`, 'SYSTEM');
logger.logInfo(`Log level: ${logger.level}`, 'SYSTEM');

module.exports = logger; 