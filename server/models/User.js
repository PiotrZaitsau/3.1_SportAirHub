const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Основная информация
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Роли и доступы
  role: {
    type: String,
    enum: ['client', 'admin', 'owner', 'corporate_admin'],
    default: 'client'
  },
  permissions: [{
    type: String,
    enum: [
      'view_bookings',
      'manage_bookings', 
      'view_analytics',
      'manage_users',
      'manage_courts',
      'manage_iot',
      'manage_payments',
      'view_financials',
      'manage_corporate'
    ]
  }],
  
  // Профиль и настройки
  avatar: {
    type: String, // URL к S3
    default: null
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },
  
  // Адрес и локация
  address: {
    street: String,
    city: String,
    zipCode: String,
    country: String
  },
  
  // Система лояльности и бонусы
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  loyaltyLevel: {
    type: String,
    enum: ['bronze', 'silver', 'gold'],
    default: 'bronze'
  },
  totalHoursPlayed: {
    type: Number,
    default: 0
  },
  
  // Подписки и абонементы
  activeSubscriptions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  }],
  passPurchases: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PassPurchase'
  }],
  
  // Статистика
  totalBookings: {
    type: Number,
    default: 0
  },
  cancelledBookings: {
    type: Number,
    default: 0
  },
  noShowCount: {
    type: Number,
    default: 0
  },
  
  // Социальные льготы
  socialBenefits: {
    isEligible: {
      type: Boolean,
      default: false
    },
    category: {
      type: String,
      enum: ['senior', 'disabled', 'student'],
      default: null
    },
    remainingSocialHours: {
      type: Number,
      default: 0
    },
    lastSocialHourReset: {
      type: Date,
      default: Date.now
    }
  },
  
  // Настройки уведомлений
  notificationSettings: {
    email: {
      bookingReminders: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      newsletters: { type: Boolean, default: false }
    },
    sms: {
      bookingReminders: { type: Boolean, default: false },
      promotions: { type: Boolean, default: false }
    },
    push: {
      bookingReminders: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true }
    }
  },
  
  // Платежные данные
  paymentMethods: [{
    stripePaymentMethodId: String,
    type: String, // card, apple_pay, google_pay
    last4: String,
    expiryMonth: Number,
    expiryYear: Number,
    isDefault: Boolean
  }],
  
  // Друзья и партнеры по игре
  friends: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Активность и блокировки
  isActive: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: String,
  blockExpiresAt: Date,
  
  // Проверка и активация аккаунта
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Согласия и GDPR
  gdprConsent: {
    type: Boolean,
    default: false
  },
  marketingConsent: {
    type: Boolean,
    default: false
  },
  
  // Предпочтения
  preferences: {
    language: {
      type: String,
      enum: ['en', 'pl', 'de', 'es', 'sv'],
      default: 'en'
    },
    currency: {
      type: String,
      enum: ['EUR', 'PLN', 'USD', 'SEK'],
      default: 'EUR'
    },
    timezone: {
      type: String,
      default: 'Europe/Warsaw'
    }
  },
  
  // Метаданные
  lastLoginAt: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  registrationSource: {
    type: String,
    enum: ['web', 'mobile', 'admin'],
    default: 'web'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Виртуальные поля
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  return Math.floor((Date.now() - this.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
});

// Индексы для производительности
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ loyaltyLevel: 1 });
userSchema.index({ isActive: 1, isBlocked: 1 });

// Middleware для хеширования пароля
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Метод для проверки пароля
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Метод для обновления уровня лояльности
userSchema.methods.updateLoyaltyLevel = function() {
  if (this.loyaltyPoints >= 100) {
    this.loyaltyLevel = 'gold';
  } else if (this.loyaltyPoints >= 50) {
    this.loyaltyLevel = 'silver';
  } else {
    this.loyaltyLevel = 'bronze';
  }
};

// Метод для проверки возможности бронирования
userSchema.methods.canBook = function() {
  if (!this.isActive || this.isBlocked) {
    return { canBook: false, reason: 'Account is inactive or blocked' };
  }
  
  if (this.cancelledBookings >= 3 && this.blockExpiresAt && this.blockExpiresAt > new Date()) {
    return { canBook: false, reason: 'Temporary booking restriction due to multiple cancellations' };
  }
  
  return { canBook: true };
};

// Метод для получения льготных часов
userSchema.methods.getSocialHoursRemaining = function() {
  const now = new Date();
  const lastReset = this.socialBenefits.lastSocialHourReset;
  const monthsDiff = (now.getFullYear() - lastReset.getFullYear()) * 12 + 
                    (now.getMonth() - lastReset.getMonth());
  
  if (monthsDiff >= 1) {
    // Сброс льготных часов в начале месяца
    this.socialBenefits.remainingSocialHours = this.socialBenefits.isEligible ? 2 : 0;
    this.socialBenefits.lastSocialHourReset = now;
  }
  
  return this.socialBenefits.remainingSocialHours;
};

// Статический метод для поиска пользователей
userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, isBlocked: false });
};

// Удаление пароля при сериализации
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  return userObject;
};

module.exports = mongoose.model('User', userSchema); 