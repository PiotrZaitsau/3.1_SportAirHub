const mongoose = require('mongoose');

const pricingRuleSchema = new mongoose.Schema({
  // Основная информация
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0 // Чем выше число, тем выше приоритет
  },
  
  // Условия применения
  conditions: {
    // Временные условия
    timeConditions: {
      // Дни недели (0 = воскресенье, 1 = понедельник, ...)
      daysOfWeek: [{ type: Number, min: 0, max: 6 }],
      
      // Время дня
      timeRanges: [{
        start: String, // "HH:MM" формат
        end: String,   // "HH:MM" формат
        _id: false
      }],
      
      // Даты
      dateRanges: [{
        start: Date,
        end: Date,
        _id: false
      }],
      
      // Исключения (праздники, особые дни)
      excludeDates: [Date],
      
      // Сезоны
      seasons: [{
        type: String,
        enum: ['spring', 'summer', 'autumn', 'winter'],
        _id: false
      }]
    },
    
    // Условия загруженности
    occupancyConditions: {
      // Минимальная загруженность для применения правила (%)
      minOccupancy: { type: Number, min: 0, max: 100 },
      maxOccupancy: { type: Number, min: 0, max: 100 },
      
      // Количество свободных кортов
      minAvailableCourts: Number,
      maxAvailableCourts: Number,
      
      // Время до бронирования (в часах)
      advanceBookingHours: {
        min: Number,
        max: Number
      }
    },
    
    // Пользовательские условия
    userConditions: {
      // Типы пользователей
      userTypes: [{
        type: String,
        enum: ['guest', 'member', 'premium'],
        _id: false
      }],
      
      // Уровни лояльности
      loyaltyLevels: [{
        type: String,
        enum: ['bronze', 'silver', 'gold'],
        _id: false
      }],
      
      // Новые пользователи (дней с регистрации)
      newUserDays: Number,
      
      // Частые пользователи (минимум бронирований в месяц)
      frequentUserBookings: Number
    },
    
    // Погодные условия
    weatherConditions: {
      // Температура (°C)
      temperature: {
        min: Number,
        max: Number
      },
      
      // Погодные условия
      conditions: [{
        type: String,
        enum: ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'],
        _id: false
      }],
      
      // Влажность (%)
      humidity: {
        min: Number,
        max: Number
      }
    },
    
    // Условия по кортам
    courtConditions: {
      // Типы кортов
      courtTypes: [String],
      
      // Конкретные корты
      specificCourts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Court'
      }],
      
      // Качество кортов
      courtQuality: [{
        type: String,
        enum: ['standard', 'premium', 'vip'],
        _id: false
      }]
    },
    
    // Событийные условия
    eventConditions: {
      // Особые события
      specialEvents: [String],
      
      // Турниры
      tournaments: [String],
      
      // Праздники
      holidays: [String]
    }
  },
  
  // Действия по ценообразованию
  pricingActions: {
    // Тип действия
    actionType: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'fixed_price', 'formula'],
      required: true
    },
    
    // Значение действия
    value: {
      type: Number,
      required: true
    },
    
    // Формула (для actionType = 'formula')
    formula: String, // например: "basePrice * (1 + occupancy/100 * 0.5)"
    
    // Минимальная цена
    minPrice: {
      type: Number,
      min: 0
    },
    
    // Максимальная цена
    maxPrice: {
      type: Number,
      min: 0
    },
    
    // Округление
    rounding: {
      type: String,
      enum: ['none', 'up', 'down', 'nearest'],
      default: 'nearest'
    },
    
    // Шаг округления
    roundingStep: {
      type: Number,
      default: 1
    }
  },
  
  // Применимость
  applicability: {
    // Типы бронирований
    bookingTypes: [{
      type: String,
      enum: ['single', 'recurring', 'tournament', 'event'],
      _id: false
    }],
    
    // Длительность бронирования (минуты)
    duration: {
      min: Number,
      max: Number
    },
    
    // Количество игроков
    playerCount: {
      min: Number,
      max: Number
    }
  },
  
  // Статистика использования
  usage: {
    timesApplied: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageDiscount: { type: Number, default: 0 },
    lastApplied: Date,
    
    // Статистика по месяцам
    monthlyStats: [{
      month: { type: Number, min: 1, max: 12 },
      year: Number,
      applications: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      averagePrice: { type: Number, default: 0 },
      _id: false
    }]
  },
  
  // Ограничения
  limits: {
    // Максимальное количество применений в день
    maxDailyApplications: Number,
    
    // Максимальное количество применений в месяц
    maxMonthlyApplications: Number,
    
    // Максимальное количество применений на пользователя в день
    maxUserDailyApplications: Number,
    
    // Дата окончания действия правила
    expiryDate: Date,
    
    // Минимальный интервал между применениями (минуты)
    cooldownMinutes: Number
  },
  
  // Комбинирование с другими правилами
  combination: {
    // Можно ли комбинировать с другими правилами
    allowCombination: { type: Boolean, default: false },
    
    // Исключающие правила (нельзя применять вместе)
    excludeRules: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PricingRule'
    }],
    
    // Обязательные правила (должны применяться вместе)
    requireRules: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PricingRule'
    }]
  },
  
  // Метаданные
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String],
  notes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы
pricingRuleSchema.index({ isActive: 1, priority: -1 });
pricingRuleSchema.index({ 'conditions.timeConditions.daysOfWeek': 1 });
pricingRuleSchema.index({ 'limits.expiryDate': 1 });

// Виртуальные поля
pricingRuleSchema.virtual('isExpired').get(function() {
  return this.limits.expiryDate && this.limits.expiryDate < new Date();
});

pricingRuleSchema.virtual('effectivenessScore').get(function() {
  if (this.usage.timesApplied === 0) return 0;
  return this.usage.totalRevenue / this.usage.timesApplied;
});

// Методы экземпляра
pricingRuleSchema.methods.checkConditions = function(context) {
  const { time, occupancy, user, weather, court, booking } = context;
  
  // Проверка временных условий
  if (this.conditions.timeConditions) {
    const tc = this.conditions.timeConditions;
    
    // День недели
    if (tc.daysOfWeek && tc.daysOfWeek.length > 0) {
      const dayOfWeek = time.getDay();
      if (!tc.daysOfWeek.includes(dayOfWeek)) return false;
    }
    
    // Время дня
    if (tc.timeRanges && tc.timeRanges.length > 0) {
      const currentTime = time.toTimeString().slice(0, 5); // "HH:MM"
      const inTimeRange = tc.timeRanges.some(range => 
        currentTime >= range.start && currentTime <= range.end
      );
      if (!inTimeRange) return false;
    }
    
    // Исключенные даты
    if (tc.excludeDates && tc.excludeDates.length > 0) {
      const dateStr = time.toDateString();
      const isExcluded = tc.excludeDates.some(date => 
        date.toDateString() === dateStr
      );
      if (isExcluded) return false;
    }
  }
  
  // Проверка условий загруженности
  if (this.conditions.occupancyConditions && occupancy !== undefined) {
    const oc = this.conditions.occupancyConditions;
    
    if (oc.minOccupancy !== undefined && occupancy.percentage < oc.minOccupancy) return false;
    if (oc.maxOccupancy !== undefined && occupancy.percentage > oc.maxOccupancy) return false;
    if (oc.minAvailableCourts !== undefined && occupancy.availableCourts < oc.minAvailableCourts) return false;
    if (oc.maxAvailableCourts !== undefined && occupancy.availableCourts > oc.maxAvailableCourts) return false;
  }
  
  // Проверка пользовательских условий
  if (this.conditions.userConditions && user) {
    const uc = this.conditions.userConditions;
    
    if (uc.userTypes && uc.userTypes.length > 0 && !uc.userTypes.includes(user.type)) return false;
    if (uc.loyaltyLevels && uc.loyaltyLevels.length > 0 && !uc.loyaltyLevels.includes(user.loyaltyLevel)) return false;
    
    if (uc.newUserDays !== undefined) {
      const daysSinceRegistration = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));
      if (daysSinceRegistration > uc.newUserDays) return false;
    }
  }
  
  // Проверка условий по кортам
  if (this.conditions.courtConditions && court) {
    const cc = this.conditions.courtConditions;
    
    if (cc.courtTypes && cc.courtTypes.length > 0 && !cc.courtTypes.includes(court.type)) return false;
    if (cc.specificCourts && cc.specificCourts.length > 0 && !cc.specificCourts.includes(court._id)) return false;
    if (cc.courtQuality && cc.courtQuality.length > 0 && !cc.courtQuality.includes(court.quality)) return false;
  }
  
  return true;
};

pricingRuleSchema.methods.calculatePrice = function(basePrice, context = {}) {
  const { actionType, value, formula, minPrice, maxPrice, rounding, roundingStep } = this.pricingActions;
  
  let newPrice = basePrice;
  
  switch (actionType) {
    case 'percentage':
      newPrice = basePrice * (1 + value / 100);
      break;
    case 'fixed_amount':
      newPrice = basePrice + value;
      break;
    case 'fixed_price':
      newPrice = value;
      break;
    case 'formula':
      if (formula) {
        try {
          // Простая оценка формулы (в продакшене использовать безопасный парсер)
          const evaluatedFormula = formula
            .replace(/basePrice/g, basePrice)
            .replace(/occupancy/g, context.occupancy?.percentage || 0);
          newPrice = eval(evaluatedFormula);
        } catch (error) {
          console.error('Formula evaluation error:', error);
          newPrice = basePrice;
        }
      }
      break;
  }
  
  // Применяем ограничения по цене
  if (minPrice !== undefined) newPrice = Math.max(newPrice, minPrice);
  if (maxPrice !== undefined) newPrice = Math.min(newPrice, maxPrice);
  
  // Округление
  if (rounding && rounding !== 'none') {
    const step = roundingStep || 1;
    switch (rounding) {
      case 'up':
        newPrice = Math.ceil(newPrice / step) * step;
        break;
      case 'down':
        newPrice = Math.floor(newPrice / step) * step;
        break;
      case 'nearest':
        newPrice = Math.round(newPrice / step) * step;
        break;
    }
  }
  
  return Math.max(0, newPrice); // Цена не может быть отрицательной
};

pricingRuleSchema.methods.recordUsage = async function(appliedPrice, originalPrice) {
  this.usage.timesApplied += 1;
  this.usage.totalRevenue += appliedPrice;
  this.usage.lastApplied = new Date();
  
  // Обновляем средний дисконт
  const discount = ((originalPrice - appliedPrice) / originalPrice) * 100;
  this.usage.averageDiscount = (
    (this.usage.averageDiscount * (this.usage.timesApplied - 1) + discount) / 
    this.usage.timesApplied
  );
  
  // Обновляем месячную статистику
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  let monthlyRecord = this.usage.monthlyStats.find(m => m.month === month && m.year === year);
  if (!monthlyRecord) {
    monthlyRecord = { month, year, applications: 0, revenue: 0, averagePrice: 0 };
    this.usage.monthlyStats.push(monthlyRecord);
  }
  
  monthlyRecord.applications += 1;
  monthlyRecord.revenue += appliedPrice;
  monthlyRecord.averagePrice = monthlyRecord.revenue / monthlyRecord.applications;
  
  await this.save();
};

// Статические методы
pricingRuleSchema.statics.findApplicableRules = function(context) {
  return this.find({ 
    isActive: true,
    $or: [
      { 'limits.expiryDate': { $exists: false } },
      { 'limits.expiryDate': { $gte: new Date() } }
    ]
  }).sort({ priority: -1 });
};

pricingRuleSchema.statics.calculateDynamicPrice = async function(basePrice, context) {
  const applicableRules = await this.findApplicableRules(context);
  let finalPrice = basePrice;
  const appliedRules = [];
  
  for (const rule of applicableRules) {
    if (rule.checkConditions(context)) {
      // Проверяем лимиты
      if (await rule.checkLimits(context)) {
        if (rule.combination.allowCombination || appliedRules.length === 0) {
          finalPrice = rule.calculatePrice(finalPrice, context);
          appliedRules.push(rule);
          
          // Записываем использование
          await rule.recordUsage(finalPrice, basePrice);
          
          // Если правило не позволяет комбинирование, прекращаем
          if (!rule.combination.allowCombination) break;
        }
      }
    }
  }
  
  return {
    originalPrice: basePrice,
    finalPrice,
    appliedRules: appliedRules.map(r => ({
      id: r._id,
      name: r.name,
      description: r.description
    }))
  };
};

pricingRuleSchema.methods.checkLimits = async function(context) {
  const now = new Date();
  
  // Проверка дневных лимитов
  if (this.limits.maxDailyApplications) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayApplications = this.usage.monthlyStats
      .filter(stat => {
        const statDate = new Date(stat.year, stat.month - 1, 1);
        return statDate >= todayStart;
      })
      .reduce((sum, stat) => sum + stat.applications, 0);
    
    if (todayApplications >= this.limits.maxDailyApplications) return false;
  }
  
  // Проверка cooldown
  if (this.limits.cooldownMinutes && this.usage.lastApplied) {
    const timeSinceLastApplication = (now - this.usage.lastApplied) / (1000 * 60);
    if (timeSinceLastApplication < this.limits.cooldownMinutes) return false;
  }
  
  return true;
};

module.exports = mongoose.model('PricingRule', pricingRuleSchema); 