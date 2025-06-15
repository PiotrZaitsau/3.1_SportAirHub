const mongoose = require('mongoose');

const passPurchaseSchema = new mongoose.Schema({
  // Основная информация
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Номер пасса
  passNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Тип пасса
  type: {
    type: String,
    enum: ['10_hour_pass'],
    default: '10_hour_pass'
  },
  
  // Статус
  status: {
    type: String,
    enum: ['active', 'expired', 'exhausted', 'cancelled', 'suspended'],
    default: 'active'
  },
  
  // Даты
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  activationDate: {
    type: Date,
    default: Date.now
  },
  expirationDate: {
    type: Date,
    required: true
  },
  
  // Платежная информация
  payment: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'EUR'
    },
    stripePaymentIntentId: String,
    transactionId: String,
    paymentMethod: {
      type: String,
      enum: ['stripe', 'apple_pay', 'google_pay', 'bank_transfer', 'cash'],
      default: 'stripe'
    },
    paidAt: Date
  },
  
  // Часы и использование
  hours: {
    total: {
      type: Number,
      default: 10
    },
    used: {
      type: Number,
      default: 0
    },
    remaining: {
      type: Number,
      default: 10
    },
    
    // Бонусные часы (при промо-акциях)
    bonus: {
      type: Number,
      default: 0
    }
  },
  
  // Ограничения использования
  restrictions: {
    // Применимые ценовые уровни
    allowedTiers: [{ 
      type: String,
      enum: ['peak', 'mid', 'off'],
      default: ['mid', 'off']
    }],
    
    // Дополнительные игроки
    additionalPlayerFee: {
      enabled: { type: Boolean, default: true },
      feePerPlayer: { type: Number, default: 1 } // 1 час за каждого дополнительного игрока
    },
    
    // Максимальное использование в день
    dailyUsageLimit: {
      enabled: { type: Boolean, default: false },
      maxHoursPerDay: { type: Number, default: 2 }
    },
    
    // Передача другим пользователям
    transferable: { type: Boolean, default: false },
    
    // Возможность отмены с возвратом часов
    refundableHours: { type: Boolean, default: true },
    
    // Минимальное время до бронирования для использования часов
    minAdvanceBooking: { type: Number, default: 0 } // часов
  },
  
  // Статистика использования
  usage: {
    totalBookings: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    
    // Использование по ценовым уровням
    usageByTier: {
      peak: { type: Number, default: 0 },
      mid: { type: Number, default: 0 },
      off: { type: Number, default: 0 }
    },
    
    // Использование по месяцам
    monthlyUsage: [{
      month: { type: Number, min: 1, max: 12 },
      year: Number,
      hoursUsed: { type: Number, default: 0 },
      bookingsCount: { type: Number, default: 0 }
    }],
    
    // История использования
    usageHistory: [{
      booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
      },
      hoursUsed: Number,
      additionalPlayerHours: Number,
      tier: String,
      date: { type: Date, default: Date.now },
      courtNumber: Number
    }],
    
    // Первое и последнее использование
    firstUsed: Date,
    lastUsed: Date
  },
  
  // Связанные бронирования
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }],
  
  // Автоматические продления и акции
  promotions: {
    // Было ли куплено во время акции
    purchasedDuringPromo: { type: Boolean, default: false },
    promoCode: String,
    bonusHours: { type: Number, default: 0 },
    
    // Программа лояльности
    loyaltyBonus: {
      applied: { type: Boolean, default: false },
      bonusHours: { type: Number, default: 0 },
      reason: String
    }
  },
  
  // Уведомления
  notifications: {
    // Подтверждение покупки
    purchaseConfirmationSent: { type: Boolean, default: false },
    
    // Предупреждения об остатке часов
    lowBalanceWarning: {
      sent: { type: Boolean, default: false },
      threshold: { type: Number, default: 2 }, // предупреждать при 2 часах
      sentAt: Date
    },
    
    // Предупреждение о скором истечении
    expirationWarning: {
      sent: { type: Boolean, default: false },
      daysBefore: { type: Number, default: 30 },
      sentAt: Date
    },
    
    // Уведомление об истечении
    expirationNotification: {
      sent: { type: Boolean, default: false },
      sentAt: Date
    }
  },
  
  // Отмена и возврат
  cancellation: {
    isCancelled: { type: Boolean, default: false },
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    refundAmount: { type: Number, default: 0 },
    refundedHours: { type: Number, default: 0 }
  },
  
  // Метаданные
  source: {
    type: String,
    enum: ['web', 'mobile', 'admin', 'promotion'],
    default: 'web'
  },
  notes: String,
  
  // Подарочная карта
  giftCard: {
    isGift: { type: Boolean, default: false },
    giftedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    giftMessage: String,
    recipientEmail: String,
    deliveryDate: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы для производительности
passPurchaseSchema.index({ user: 1, status: 1 });
passPurchaseSchema.index({ passNumber: 1 });
passPurchaseSchema.index({ status: 1, expirationDate: 1 });
passPurchaseSchema.index({ purchaseDate: 1 });

// Виртуальные поля
passPurchaseSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.expirationDate > now && 
         this.hours.remaining > 0;
});

passPurchaseSchema.virtual('isExpired').get(function() {
  return new Date() > this.expirationDate;
});

passPurchaseSchema.virtual('isExhausted').get(function() {
  return this.hours.remaining <= 0;
});

passPurchaseSchema.virtual('daysUntilExpiration').get(function() {
  const now = new Date();
  const diffTime = this.expirationDate - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

passPurchaseSchema.virtual('utilizationRate').get(function() {
  if (this.hours.total === 0) return 0;
  return (this.hours.used / this.hours.total) * 100;
});

// Pre-save middleware
passPurchaseSchema.pre('save', function(next) {
  // Генерация номера пасса
  if (!this.passNumber) {
    const date = new Date().getFullYear().toString().slice(-2);
    const random = Math.random().toString(36).substr(2, 8).toUpperCase();
    this.passNumber = `PASS${date}${random}`;
  }
  
  // Обновление remaining hours
  this.hours.remaining = Math.max(0, this.hours.total + this.hours.bonus - this.hours.used);
  
  // Автоматическое обновление статуса
  if (this.isExpired && this.status === 'active') {
    this.status = 'expired';
  } else if (this.isExhausted && this.status === 'active') {
    this.status = 'exhausted';
  }
  
  next();
});

// Метод для проверки возможности использования
passPurchaseSchema.methods.canUse = function(booking, additionalPlayers = 0) {
  if (!this.isActive) {
    return { 
      canUse: false, 
      reason: `Pass is ${this.status}`,
      details: { 
        status: this.status,
        remaining: this.hours.remaining,
        expired: this.isExpired
      }
    };
  }
  
  // Проверяем ценовой уровень
  if (!this.restrictions.allowedTiers.includes(booking.pricing.tier)) {
    return {
      canUse: false,
      reason: `Pass not valid for ${booking.pricing.tier} pricing tier`,
      details: { 
        allowedTiers: this.restrictions.allowedTiers,
        requestedTier: booking.pricing.tier
      }
    };
  }
  
  // Рассчитываем необходимые часы
  const baseHours = booking.duration / 60;
  let totalHoursNeeded = baseHours;
  
  // Добавляем часы за дополнительных игроков
  if (this.restrictions.additionalPlayerFee.enabled && additionalPlayers > 0) {
    totalHoursNeeded += additionalPlayers * this.restrictions.additionalPlayerFee.feePerPlayer;
  }
  
  // Проверяем достаточность часов
  if (this.hours.remaining < totalHoursNeeded) {
    return {
      canUse: false,
      reason: 'Insufficient hours remaining',
      details: {
        required: totalHoursNeeded,
        available: this.hours.remaining,
        baseHours: baseHours,
        additionalPlayerHours: totalHoursNeeded - baseHours
      }
    };
  }
  
  // Проверяем дневной лимит
  if (this.restrictions.dailyUsageLimit.enabled) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayUsage = this.usage.usageHistory
      .filter(usage => usage.date >= today)
      .reduce((total, usage) => total + usage.hoursUsed, 0);
    
    if (todayUsage + totalHoursNeeded > this.restrictions.dailyUsageLimit.maxHoursPerDay) {
      return {
        canUse: false,
        reason: 'Daily usage limit exceeded',
        details: {
          dailyLimit: this.restrictions.dailyUsageLimit.maxHoursPerDay,
          usedToday: todayUsage,
          requested: totalHoursNeeded
        }
      };
    }
  }
  
  // Проверяем минимальное время до бронирования
  if (this.restrictions.minAdvanceBooking > 0) {
    const now = new Date();
    const hoursUntilBooking = (booking.startTime - now) / (1000 * 60 * 60);
    
    if (hoursUntilBooking < this.restrictions.minAdvanceBooking) {
      return {
        canUse: false,
        reason: `Must book at least ${this.restrictions.minAdvanceBooking} hours in advance`,
        details: {
          minAdvanceHours: this.restrictions.minAdvanceBooking,
          actualAdvanceHours: hoursUntilBooking
        }
      };
    }
  }
  
  return { 
    canUse: true,
    hoursNeeded: totalHoursNeeded,
    baseHours: baseHours,
    additionalPlayerHours: totalHoursNeeded - baseHours
  };
};

// Метод для использования часов
passPurchaseSchema.methods.useHours = async function(booking, additionalPlayers = 0) {
  const validation = this.canUse(booking, additionalPlayers);
  if (!validation.canUse) {
    throw new Error(validation.reason);
  }
  
  const hoursUsed = validation.hoursNeeded;
  const baseHours = validation.baseHours;
  const additionalPlayerHours = validation.additionalPlayerHours;
  
  // Обновляем использованные часы
  this.hours.used += hoursUsed;
  
  // Обновляем статистику
  this.usage.totalBookings += 1;
  
  // Обновляем использование по ценовым уровням
  this.usage.usageByTier[booking.pricing.tier] += hoursUsed;
  
  // Добавляем в историю использования
  this.usage.usageHistory.push({
    booking: booking._id,
    hoursUsed: hoursUsed,
    additionalPlayerHours: additionalPlayerHours,
    tier: booking.pricing.tier,
    date: new Date(),
    courtNumber: booking.court.number || booking.court
  });
  
  // Обновляем месячную статистику
  const month = booking.startTime.getMonth() + 1;
  const year = booking.startTime.getFullYear();
  
  let monthlyRecord = this.usage.monthlyUsage.find(m => m.month === month && m.year === year);
  if (!monthlyRecord) {
    monthlyRecord = { month, year, hoursUsed: 0, bookingsCount: 0 };
    this.usage.monthlyUsage.push(monthlyRecord);
  }
  
  monthlyRecord.hoursUsed += hoursUsed;
  monthlyRecord.bookingsCount += 1;
  
  // Обновляем даты использования
  if (!this.usage.firstUsed) {
    this.usage.firstUsed = new Date();
  }
  this.usage.lastUsed = new Date();
  
  // Добавляем бронирование к связанным
  this.bookings.push(booking._id);
  
  await this.save();
  
  return {
    hoursUsed: hoursUsed,
    remainingHours: this.hours.remaining,
    baseHours: baseHours,
    additionalPlayerHours: additionalPlayerHours
  };
};

// Метод для возврата часов (при отмене бронирования)
passPurchaseSchema.methods.refundHours = async function(booking) {
  if (!this.restrictions.refundableHours) {
    throw new Error('This pass does not support hour refunds');
  }
  
  // Находим запись использования
  const usageRecord = this.usage.usageHistory.find(
    usage => usage.booking.toString() === booking._id.toString()
  );
  
  if (!usageRecord) {
    throw new Error('Usage record not found for this booking');
  }
  
  const hoursToRefund = usageRecord.hoursUsed;
  
  // Возвращаем часы
  this.hours.used = Math.max(0, this.hours.used - hoursToRefund);
  
  // Обновляем статистику
  this.usage.totalBookings = Math.max(0, this.usage.totalBookings - 1);
  this.usage.cancelledBookings += 1;
  
  // Обновляем использование по ценовым уровням
  this.usage.usageByTier[usageRecord.tier] = Math.max(0, 
    this.usage.usageByTier[usageRecord.tier] - hoursToRefund);
  
  // Удаляем запись из истории
  this.usage.usageHistory = this.usage.usageHistory.filter(
    usage => usage.booking.toString() !== booking._id.toString()
  );
  
  // Обновляем месячную статистику
  const month = booking.startTime.getMonth() + 1;
  const year = booking.startTime.getFullYear();
  
  const monthlyRecord = this.usage.monthlyUsage.find(m => m.month === month && m.year === year);
  if (monthlyRecord) {
    monthlyRecord.hoursUsed = Math.max(0, monthlyRecord.hoursUsed - hoursToRefund);
    monthlyRecord.bookingsCount = Math.max(0, monthlyRecord.bookingsCount - 1);
  }
  
  // Убираем из связанных бронирований
  this.bookings = this.bookings.filter(id => id.toString() !== booking._id.toString());
  
  await this.save();
  
  return {
    refundedHours: hoursToRefund,
    newRemainingHours: this.hours.remaining
  };
};

// Метод для проверки необходимости уведомлений
passPurchaseSchema.methods.checkNotifications = function() {
  const notifications = [];
  
  // Проверяем уведомление о низком балансе
  if (!this.notifications.lowBalanceWarning.sent && 
      this.hours.remaining <= this.notifications.lowBalanceWarning.threshold) {
    notifications.push({
      type: 'low_balance',
      message: `Only ${this.hours.remaining} hours remaining on your pass`,
      priority: 'medium'
    });
  }
  
  // Проверяем уведомление о скором истечении
  if (!this.notifications.expirationWarning.sent && 
      this.daysUntilExpiration <= this.notifications.expirationWarning.daysBefore) {
    notifications.push({
      type: 'expiration_warning',
      message: `Your pass expires in ${this.daysUntilExpiration} days`,
      priority: 'high'
    });
  }
  
  // Проверяем уведомление об истечении
  if (!this.notifications.expirationNotification.sent && this.isExpired) {
    notifications.push({
      type: 'expired',
      message: 'Your pass has expired',
      priority: 'high'
    });
  }
  
  return notifications;
};

// Статический метод для создания нового пасса
passPurchaseSchema.statics.create10HourPass = async function(userData, paymentData, options = {}) {
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + 12); // Срок действия 12 месяцев
  
  const pass = new this({
    user: userData.userId,
    type: '10_hour_pass',
    status: 'active',
    expirationDate,
    payment: {
      amount: paymentData.amount,
      currency: paymentData.currency || 'EUR',
      stripePaymentIntentId: paymentData.stripePaymentIntentId,
      transactionId: paymentData.transactionId,
      paymentMethod: paymentData.method || 'stripe',
      paidAt: new Date()
    },
    hours: {
      total: 10,
      used: 0,
      remaining: 10,
      bonus: options.bonusHours || 0
    },
    restrictions: {
      allowedTiers: ['mid', 'off'],
      additionalPlayerFee: {
        enabled: true,
        feePerPlayer: 1
      },
      transferable: false,
      refundableHours: true
    },
    source: options.source || 'web'
  });
  
  // Если это подарочная карта
  if (options.isGift) {
    pass.giftCard = {
      isGift: true,
      giftedBy: options.giftedBy,
      giftMessage: options.giftMessage,
      recipientEmail: options.recipientEmail,
      deliveryDate: options.deliveryDate || new Date()
    };
  }
  
  // Если куплено во время промо-акции
  if (options.promotion) {
    pass.promotions = {
      purchasedDuringPromo: true,
      promoCode: options.promotion.code,
      bonusHours: options.promotion.bonusHours || 0
    };
    
    pass.hours.bonus += options.promotion.bonusHours || 0;
  }
  
  return await pass.save();
};

// Статический метод для поиска активных пассов
passPurchaseSchema.statics.findActive = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    expirationDate: { $gt: now },
    'hours.remaining': { $gt: 0 }
  });
};

// Статический метод для поиска истекающих пассов
passPurchaseSchema.statics.findExpiringSoon = function(days = 30) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'active',
    expirationDate: { 
      $gte: now,
      $lte: futureDate 
    },
    'hours.remaining': { $gt: 0 }
  });
};

module.exports = mongoose.model('PassPurchase', passPurchaseSchema); 