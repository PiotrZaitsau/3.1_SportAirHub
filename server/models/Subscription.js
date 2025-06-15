const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // Основная информация
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Тип подписки
  type: {
    type: String,
    enum: ['annual_membership'],
    default: 'annual_membership'
  },
  subscriptionNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Статус
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'cancelled', 'suspended'],
    default: 'active'
  },
  
  // Даты
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
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
      default: 'PLN'
    },
    stripeSubscriptionId: String,
    stripeCustomerId: String,
    paymentMethod: {
      type: String,
      enum: ['stripe', 'bank_transfer', 'cash'],
      default: 'stripe'
    },
    paidAt: Date,
    nextBillingDate: Date
  },
  
  // Лимиты и использование
  limits: {
    // Off-peak доступ (неограниченный)
    offPeakAccess: {
      isUnlimited: { type: Boolean, default: true },
      maxHoursPerDay: { type: Number, default: 1.5 },
      maxConsecutiveHours: { type: Number, default: 1.5 }
    },
    
    // Peak доступ (ограниченный)
    peakAccess: {
      totalHours: { type: Number, default: 20 }, // 20 часов в год
      usedHours: { type: Number, default: 0 },
      remainingHours: { type: Number, default: 20 },
      discountAfterLimit: { type: Number, default: 10 } // 10% скидка
    },
    
    // Социальные часы
    socialHours: {
      included: { type: Boolean, default: true },
      unlimited: { type: Boolean, default: true }
    },
    
    // Ограничения на гостей
    guestPolicy: {
      canInviteGuests: { type: Boolean, default: false },
      maxGuestsOffPeak: { type: Number, default: 0 },
      maxGuestsPeak: { type: Number, default: 0 },
      guestFee: { type: Number, default: 0 }
    }
  },
  
  // Статистика использования
  usage: {
    totalHours: { type: Number, default: 0 },
    offPeakHours: { type: Number, default: 0 },
    peakHours: { type: Number, default: 0 },
    socialHours: { type: Number, default: 0 },
    
    // Использование по месяцам
    monthlyUsage: [{
      month: { type: Number, min: 1, max: 12 },
      year: Number,
      hours: { type: Number, default: 0 },
      bookings: { type: Number, default: 0 }
    }],
    
    // Последняя активность
    lastUsed: Date,
    
    // Статистика бронирований
    totalBookings: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    noShowBookings: { type: Number, default: 0 }
  },
  
  // Преимущества и льготы
  benefits: {
    // Раннее бронирование
    earlyBooking: {
      enabled: { type: Boolean, default: true },
      daysAhead: { type: Number, default: 14 } // На 14 дней вперед
    },
    
    // Приоритет в очереди ожидания
    waitlistPriority: {
      enabled: { type: Boolean, default: true },
      priorityLevel: { type: Number, default: 1 }
    },
    
    // Скидки на дополнительные услуги
    additionalDiscounts: {
      equipment: { type: Number, default: 0 }, // %
      food: { type: Number, default: 0 }, // %
      merchandise: { type: Number, default: 0 } // %
    },
    
    // Бесплатные отмены
    freeCancellations: {
      enabled: { type: Boolean, default: true },
      hoursBeforeStart: { type: Number, default: 2 }
    }
  },
  
  // Ограничения и условия
  restrictions: {
    // Запрет на передачу
    transferable: { type: Boolean, default: false },
    
    // Приостановка
    pauseable: {
      enabled: { type: Boolean, default: false },
      maxPauseDays: { type: Number, default: 0 }
    },
    
    // Возврат средств
    refundable: {
      enabled: { type: Boolean, default: false },
      refundPercentage: { type: Number, default: 0 },
      refundDeadlineDays: { type: Number, default: 0 }
    }
  },
  
  // Автоматическое продление
  autoRenewal: {
    enabled: { type: Boolean, default: false },
    renewalPrice: Number,
    renewalNoticeDays: { type: Number, default: 30 },
    notificationSent: { type: Boolean, default: false }
  },
  
  // Отмена и приостановка
  cancellation: {
    isCancelled: { type: Boolean, default: false },
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    refundAmount: { type: Number, default: 0 }
  },
  
  suspension: {
    isSuspended: { type: Boolean, default: false },
    suspendedAt: Date,
    suspendedUntil: Date,
    reason: String,
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Связанные бронирования
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }],
  
  // Уведомления
  notifications: {
    welcomeSent: { type: Boolean, default: false },
    renewalReminderSent: { type: Boolean, default: false },
    expirationWarningSent: { type: Boolean, default: false },
    usageLimitWarningSent: { type: Boolean, default: false }
  },
  
  // Метаданные
  source: {
    type: String,
    enum: ['web', 'mobile', 'admin', 'sales'],
    default: 'web'
  },
  notes: String,
  
  // Система лояльности
  loyaltyPoints: {
    earned: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
    balance: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы для производительности
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ subscriptionNumber: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });
subscriptionSchema.index({ startDate: 1, endDate: 1 });

// Виртуальные поля
subscriptionSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.startDate <= now && 
         this.endDate >= now;
});

subscriptionSchema.virtual('isExpired').get(function() {
  return new Date() > this.endDate;
});

subscriptionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diffTime = this.endDate - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

subscriptionSchema.virtual('peakHoursRemaining').get(function() {
  return Math.max(0, this.limits.peakAccess.totalHours - this.limits.peakAccess.usedHours);
});

subscriptionSchema.virtual('utilizationRate').get(function() {
  if (this.limits.peakAccess.totalHours === 0) return 0;
  return (this.limits.peakAccess.usedHours / this.limits.peakAccess.totalHours) * 100;
});

// Pre-save middleware
subscriptionSchema.pre('save', function(next) {
  // Генерация номера подписки
  if (!this.subscriptionNumber) {
    const date = new Date().getFullYear().toString().slice(-2);
    const random = Math.random().toString(36).substr(2, 8).toUpperCase();
    this.subscriptionNumber = `SUB${date}${random}`;
  }
  
  // Обновление remaining hours
  this.limits.peakAccess.remainingHours = Math.max(0, 
    this.limits.peakAccess.totalHours - this.limits.peakAccess.usedHours
  );
  
  // Автоматическая смена статуса
  if (this.isExpired && this.status === 'active') {
    this.status = 'expired';
  }
  
  next();
});

// Метод для проверки возможности бронирования
subscriptionSchema.methods.canBook = function(dateTime, duration, pricingTier) {
  if (!this.isActive) {
    return { 
      canBook: false, 
      reason: 'Subscription is not active',
      details: { status: this.status }
    };
  }
  
  const durationHours = duration / 60;
  
  // Проверяем off-peak бронирования
  if (pricingTier === 'off') {
    // Проверяем лимит часов в день
    if (durationHours > this.limits.offPeakAccess.maxHoursPerDay) {
      return {
        canBook: false,
        reason: `Off-peak limit exceeded. Max ${this.limits.offPeakAccess.maxHoursPerDay} hours per day`,
        details: { maxHours: this.limits.offPeakAccess.maxHoursPerDay }
      };
    }
    
    return { canBook: true, type: 'off_peak' };
  }
  
  // Проверяем peak бронирования
  if (pricingTier === 'peak') {
    if (this.peakHoursRemaining < durationHours) {
      // Предлагаем доплату со скидкой
      const additionalHours = durationHours - this.peakHoursRemaining;
      return {
        canBook: true,
        type: 'peak_with_payment',
        requiresPayment: true,
        freeHours: this.peakHoursRemaining,
        additionalHours: additionalHours,
        discount: this.limits.peakAccess.discountAfterLimit
      };
    }
    
    return { 
      canBook: true, 
      type: 'peak_included',
      hoursToDeduct: durationHours
    };
  }
  
  // Социальные часы всегда доступны
  if (pricingTier === 'social') {
    return { canBook: true, type: 'social' };
  }
  
  // Mid-tier как off-peak
  return { canBook: true, type: 'mid' };
};

// Метод для использования подписки при бронировании
subscriptionSchema.methods.useForBooking = async function(booking, options = {}) {
  const durationHours = booking.duration / 60;
  const pricingTier = booking.pricing.tier;
  
  // Проверяем возможность использования
  const canBookResult = this.canBook(booking.startTime, booking.duration, pricingTier);
  if (!canBookResult.canBook) {
    throw new Error(canBookResult.reason);
  }
  
  // Обновляем статистику
  this.usage.totalHours += durationHours;
  this.usage.totalBookings += 1;
  this.usage.lastUsed = new Date();
  
  // Добавляем бронирование к связанным
  this.bookings.push(booking._id);
  
  // Обновляем использование по типам
  switch (pricingTier) {
    case 'peak':
      const hoursToDeduct = Math.min(durationHours, this.peakHoursRemaining);
      this.limits.peakAccess.usedHours += hoursToDeduct;
      this.usage.peakHours += durationHours;
      break;
      
    case 'off':
      this.usage.offPeakHours += durationHours;
      break;
      
    case 'social':
      this.usage.socialHours += durationHours;
      break;
      
    default:
      this.usage.offPeakHours += durationHours;
  }
  
  // Обновляем месячную статистику
  const month = booking.startTime.getMonth() + 1;
  const year = booking.startTime.getFullYear();
  
  let monthlyRecord = this.usage.monthlyUsage.find(m => m.month === month && m.year === year);
  if (!monthlyRecord) {
    monthlyRecord = { month, year, hours: 0, bookings: 0 };
    this.usage.monthlyUsage.push(monthlyRecord);
  }
  
  monthlyRecord.hours += durationHours;
  monthlyRecord.bookings += 1;
  
  await this.save();
  
  return {
    hoursUsed: durationHours,
    type: canBookResult.type,
    remainingPeakHours: this.peakHoursRemaining
  };
};

// Метод для отмены использования (при отмене бронирования)
subscriptionSchema.methods.refundBookingUsage = async function(booking) {
  const durationHours = booking.duration / 60;
  const pricingTier = booking.pricing.tier;
  
  // Возвращаем статистику
  this.usage.totalHours = Math.max(0, this.usage.totalHours - durationHours);
  this.usage.totalBookings = Math.max(0, this.usage.totalBookings - 1);
  
  // Убираем из связанных бронирований
  this.bookings = this.bookings.filter(id => id.toString() !== booking._id.toString());
  
  // Возвращаем часы по типам
  switch (pricingTier) {
    case 'peak':
      this.limits.peakAccess.usedHours = Math.max(0, 
        this.limits.peakAccess.usedHours - durationHours);
      this.usage.peakHours = Math.max(0, this.usage.peakHours - durationHours);
      break;
      
    case 'off':
      this.usage.offPeakHours = Math.max(0, this.usage.offPeakHours - durationHours);
      break;
      
    case 'social':
      this.usage.socialHours = Math.max(0, this.usage.socialHours - durationHours);
      break;
      
    default:
      this.usage.offPeakHours = Math.max(0, this.usage.offPeakHours - durationHours);
  }
  
  // Обновляем месячную статистику
  const month = booking.startTime.getMonth() + 1;
  const year = booking.startTime.getFullYear();
  
  const monthlyRecord = this.usage.monthlyUsage.find(m => m.month === month && m.year === year);
  if (monthlyRecord) {
    monthlyRecord.hours = Math.max(0, monthlyRecord.hours - durationHours);
    monthlyRecord.bookings = Math.max(0, monthlyRecord.bookings - 1);
  }
  
  await this.save();
};

// Метод для продления подписки
subscriptionSchema.methods.renew = async function(renewalData) {
  if (this.status !== 'active' && this.status !== 'expired') {
    throw new Error('Can only renew active or expired subscriptions');
  }
  
  const newStartDate = this.endDate < new Date() ? new Date() : this.endDate;
  const newEndDate = new Date(newStartDate);
  newEndDate.setFullYear(newEndDate.getFullYear() + 1);
  
  // Обновляем даты
  this.startDate = newStartDate;
  this.endDate = newEndDate;
  this.status = 'active';
  
  // Сбрасываем лимиты
  this.limits.peakAccess.usedHours = 0;
  this.limits.peakAccess.remainingHours = this.limits.peakAccess.totalHours;
  
  // Обновляем платежную информацию
  if (renewalData.payment) {
    Object.assign(this.payment, renewalData.payment);
  }
  
  // Сбрасываем уведомления
  this.notifications = {
    welcomeSent: false,
    renewalReminderSent: false,
    expirationWarningSent: false,
    usageLimitWarningSent: false
  };
  
  await this.save();
  
  return this;
};

// Статический метод для создания новой подписки
subscriptionSchema.statics.createAnnualMembership = async function(userData, paymentData) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);
  
  const subscription = new this({
    user: userData.userId,
    type: 'annual_membership',
    status: 'active',
    startDate,
    endDate,
    payment: {
      amount: paymentData.amount,
      currency: paymentData.currency || 'PLN',
      stripeSubscriptionId: paymentData.stripeSubscriptionId,
      stripeCustomerId: paymentData.stripeCustomerId,
      paymentMethod: paymentData.method || 'stripe',
      paidAt: new Date()
    },
    limits: {
      offPeakAccess: {
        isUnlimited: true,
        maxHoursPerDay: 1.5,
        maxConsecutiveHours: 1.5
      },
      peakAccess: {
        totalHours: 20,
        usedHours: 0,
        remainingHours: 20,
        discountAfterLimit: 10
      },
      socialHours: {
        included: true,
        unlimited: true
      },
      guestPolicy: {
        canInviteGuests: false,
        maxGuestsOffPeak: 0,
        maxGuestsPeak: 0,
        guestFee: 0
      }
    }
  });
  
  return await subscription.save();
};

// Статический метод для поиска активных подписок
subscriptionSchema.statics.findActive = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now }
  });
};

// Статический метод для поиска истекающих подписок
subscriptionSchema.statics.findExpiringSoon = function(days = 30) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'active',
    endDate: { 
      $gte: now,
      $lte: futureDate 
    }
  });
};

module.exports = mongoose.model('Subscription', subscriptionSchema); 