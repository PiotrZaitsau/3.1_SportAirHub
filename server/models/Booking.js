const mongoose = require('mongoose');
const QRCode = require('qrcode');

const bookingSchema = new mongoose.Schema({
  // Основная информация
  bookingNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Связанные сущности
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  court: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Court',
    required: true
  },
  
  // Время и продолжительность
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // в минутах
    required: true,
    min: 60,
    max: 180
  },
  
  // Участники
  players: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String, // Для гостей
    email: String,
    phone: String,
    isRegistered: { type: Boolean, default: false },
    isGuest: { type: Boolean, default: false }
  }],
  totalPlayers: {
    type: Number,
    required: true,
    min: 1,
    max: 4
  },
  
  // Статус бронирования
  status: {
    type: String,
    enum: [
      'pending_payment',
      'confirmed', 
      'checked_in',
      'in_progress',
      'completed',
      'cancelled',
      'no_show'
    ],
    default: 'pending_payment'
  },
  
  // Ценообразование и оплата
  pricing: {
    basePrice: { type: Number, required: true },
    tier: { 
      type: String, 
      enum: ['peak', 'mid', 'off', 'social'],
      required: true 
    },
    dynamicPrice: { type: Number },
    additionalPlayerFee: { type: Number, default: 0 },
    appliedRules: [{
      ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PricingRule' },
      name: String,
      description: String,
      adjustment: Number,
      _id: false
    }],
    weatherConditions: {
      temperature: Number,
      humidity: Number,
      condition: String
    },
    occupancyRate: Number,
    discount: {
      amount: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      reason: String
    },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'TRY' }
  },
  
  // Платежная информация
  payment: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['stripe', 'apple_pay', 'google_pay', 'subscription', 'pass', 'social_free']
    },
    stripePaymentIntentId: String,
    transactionId: String,
    paidAt: Date,
    refundAmount: { type: Number, default: 0 },
    refundReason: String
  },
  
  // Использование абонементов и пассов
  subscriptionUsage: {
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription'
    },
    hoursUsed: { type: Number, default: 0 },
    isSocialHour: { type: Boolean, default: false }
  },
  passUsage: {
    pass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PassPurchase'
    },
    hoursUsed: { type: Number, default: 0 }
  },
  
  // Промокоды
  promoCode: {
    code: String,
    discount: {
      type: { type: String, enum: ['percentage', 'fixed'] },
      value: Number
    },
    appliedAt: Date
  },
  
  // Контроль доступа
  accessControl: {
    qrCode: String,
    accessToken: String,
    qrCodeExpiry: Date,
    hasAccessed: { type: Boolean, default: false },
    accessTime: Date,
    checkoutTime: Date
  },
  
  // Отмена и возврат
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    refundEligible: { type: Boolean, default: false },
    refundAmount: { type: Number, default: 0 },
    hoursBeforeCancellation: Number
  },
  
  // Waitlist
  waitlist: {
    isWaitlisted: { type: Boolean, default: false },
    position: Number,
    waitlistedAt: Date,
    notifiedAt: Date,
    responseDeadline: Date
  },
  
  // Оборудование
  equipment: {
    requested: [{
      type: { type: String, enum: ['racket', 'balls', 'towel'] },
      quantity: Number,
      fee: Number
    }],
    provided: [{
      itemId: String,
      type: String,
      serialNumber: String,
      condition: String,
      returnedAt: Date,
      damages: String
    }]
  },
  
  // Интеграция с внешними сервисами
  externalBooking: {
    source: {
      type: String,
      enum: ['web', 'mobile', 'playtomic', 'matchi', 'padelmates', 'admin']
    },
    externalId: String,
    externalData: Object
  },
  
  // Корпоративные бронирования
  corporate: {
    isCorporate: { type: Boolean, default: false },
    company: String,
    costCenter: String,
    employeeId: String,
    corporateRate: Number
  },
  
  // Система оценок и отзывов
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    review: String,
    submittedAt: Date
  },
  
  // Уведомления
  notifications: {
    reminderSent: { type: Boolean, default: false },
    confirmationSent: { type: Boolean, default: false },
    followUpSent: { type: Boolean, default: false }
  },
  
  // Особые условия
  specialRequests: String,
  notes: String,
  
  // Метаданные
  source: {
    ip: String,
    userAgent: String,
    referrer: String
  },
  
  // Автоматические действия
  automation: {
    autoCheckIn: { type: Boolean, default: false },
    autoCheckOut: { type: Boolean, default: false },
    iotTriggered: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы для производительности
bookingSchema.index({ user: 1, startTime: -1 });
bookingSchema.index({ court: 1, startTime: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ startTime: 1, endTime: 1 });
bookingSchema.index({ 'payment.status': 1 });

// Составные индексы для поиска конфликтов
bookingSchema.index({ 
  court: 1, 
  startTime: 1, 
  endTime: 1,
  status: 1 
});

// Виртуальные поля
bookingSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.startTime <= now && this.endTime > now && this.status === 'in_progress';
});

bookingSchema.virtual('canCancel').get(function() {
  const now = new Date();
  const hoursUntilStart = (this.startTime - now) / (1000 * 60 * 60);
  
  return hoursUntilStart >= 48 && 
         ['pending_payment', 'confirmed'].includes(this.status);
});

bookingSchema.virtual('refundAmount').get(function() {
  if (!this.canCancel) return 0;
  
  const now = new Date();
  const hoursUntilStart = (this.startTime - now) / (1000 * 60 * 60);
  
  if (hoursUntilStart >= 48) {
    return this.pricing.totalAmount; // Полный возврат
  } else if (hoursUntilStart >= 24) {
    return this.pricing.totalAmount * 0.5; // 50% возврат
  }
  
  return 0;
});

// Pre-save middleware для генерации номера бронирования
bookingSchema.pre('save', function(next) {
  if (!this.bookingNumber) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    this.bookingNumber = `SAH${date}${random}`;
  }
  next();
});

// Pre-save middleware для расчета общей стоимости
bookingSchema.pre('save', function(next) {
  let total = this.pricing.basePrice || 0;
  
  // Добавляем плату за дополнительных игроков
  if (this.totalPlayers > 2) {
    this.pricing.additionalPlayerFee = (this.totalPlayers - 2) * (total * 0.25);
    total += this.pricing.additionalPlayerFee;
  }
  
  // Применяем скидку
  if (this.pricing.discount.percentage) {
    total *= (1 - this.pricing.discount.percentage / 100);
  } else if (this.pricing.discount.amount) {
    total -= this.pricing.discount.amount;
  }
  
  this.pricing.totalAmount = Math.max(0, Math.round(total * 100) / 100);
  next();
});

// Метод для генерации QR-кода
bookingSchema.methods.generateQRCode = async function() {
  const accessData = {
    bookingId: this._id,
    courtId: this.court,
    userId: this.user,
    startTime: this.startTime,
    endTime: this.endTime,
    accessToken: this.accessControl.accessToken || this.generateAccessToken()
  };
  
  try {
    const qrCodeString = await QRCode.toDataURL(JSON.stringify(accessData));
    this.accessControl.qrCode = qrCodeString;
    this.accessControl.qrCodeExpiry = new Date(this.endTime.getTime() + 60 * 60 * 1000); // +1 час
    return qrCodeString;
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
};

// Метод для генерации токена доступа
bookingSchema.methods.generateAccessToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.accessControl.accessToken = token;
  return token;
};

// Метод для проверки конфликтов
bookingSchema.methods.hasConflict = async function() {
  const conflictingBookings = await this.constructor.find({
    court: this.court,
    _id: { $ne: this._id },
    status: { $in: ['confirmed', 'checked_in', 'in_progress'] },
    $or: [
      {
        startTime: { $lt: this.endTime },
        endTime: { $gt: this.startTime }
      }
    ]
  });
  
  return conflictingBookings.length > 0;
};

// Метод для автоматической отмены при неоплате
bookingSchema.methods.autoCancel = async function() {
  if (this.status === 'pending_payment') {
    const now = new Date();
    const timeSinceCreation = now - this.createdAt;
    
    if (timeSinceCreation > 10 * 60 * 1000) { // 10 минут
      this.status = 'cancelled';
      this.cancellation = {
        cancelledAt: now,
        reason: 'Payment timeout',
        refundEligible: false
      };
      await this.save();
      return true;
    }
  }
  return false;
};

// Метод для проверки возможности check-in
bookingSchema.methods.canCheckIn = function() {
  const now = new Date();
  const thirtyMinsBefore = new Date(this.startTime.getTime() - 30 * 60 * 1000);
  const thirtyMinsAfter = new Date(this.startTime.getTime() + 30 * 60 * 1000);
  
  return this.status === 'confirmed' && 
         now >= thirtyMinsBefore && 
         now <= thirtyMinsAfter;
};

// Метод для автоматического no-show
bookingSchema.methods.checkForNoShow = async function() {
  const now = new Date();
  const thirtyMinsAfterStart = new Date(this.startTime.getTime() + 30 * 60 * 1000);
  
  if (now > thirtyMinsAfterStart && 
      this.status === 'confirmed' && 
      !this.accessControl.hasAccessed) {
    
    this.status = 'no_show';
    this.user.noShowCount += 1;
    await this.user.save();
    await this.save();
    return true;
  }
  return false;
};

// Статический метод для поиска конфликтующих бронирований
bookingSchema.statics.findConflicts = function(courtId, startTime, endTime, excludeId = null) {
  const query = {
    court: courtId,
    status: { $in: ['confirmed', 'checked_in', 'in_progress'] },
    $or: [
      {
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return this.find(query);
};

// Статический метод для получения статистики
bookingSchema.statics.getStatistics = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        startTime: { 
          $gte: startDate, 
          $lte: endDate 
        }
      }
    },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        avgBookingValue: { $avg: '$pricing.totalAmount' },
        confirmedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
        },
        cancelledBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        noShowBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Booking', bookingSchema); 