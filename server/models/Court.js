const mongoose = require('mongoose');

const courtSchema = new mongoose.Schema({
  // Основная информация
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  number: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 20
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Тип и характеристики корта
  type: {
    type: String,
    enum: ['padel', 'tennis', 'squash', 'badminton'],
    required: true
  },
  surface: {
    type: String,
    enum: ['artificial_grass', 'clay', 'hard_court', 'carpet'],
    default: 'artificial_grass'
  },
  
  // Статус и доступность
  status: {
    type: String,
    enum: ['active', 'maintenance', 'inactive', 'disabled'],
    default: 'active'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  // Расписание работы
  operatingHours: {
    monday: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '23:00' },
      isOpen: { type: Boolean, default: true }
    },
    tuesday: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '23:00' },
      isOpen: { type: Boolean, default: true }
    },
    wednesday: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '23:00' },
      isOpen: { type: Boolean, default: true }
    },
    thursday: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '23:00' },
      isOpen: { type: Boolean, default: true }
    },
    friday: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '23:00' },
      isOpen: { type: Boolean, default: true }
    },
    saturday: {
      open: { type: String, default: '08:00' },
      close: { type: String, default: '22:00' },
      isOpen: { type: Boolean, default: true }
    },
    sunday: {
      open: { type: String, default: '08:00' },
      close: { type: String, default: '22:00' },
      isOpen: { type: Boolean, default: true }
    }
  },
  
  // Ценообразование
  pricing: {
    peak: {
      price: { type: Number, required: true, min: 0 },
      hours: [{ type: String }], // ['18:00-22:00']
      percentage: { type: Number, default: 50 } // 50% от общего времени
    },
    mid: {
      price: { type: Number, required: true, min: 0 },
      hours: [{ type: String }], // ['14:00-18:00', '22:00-23:00']
      percentage: { type: Number, default: 30 } // 30% от общего времени
    },
    off: {
      price: { type: Number, required: true, min: 0 },
      hours: [{ type: String }], // ['06:00-14:00']
      percentage: { type: Number, default: 20 } // 20% от общего времени
    },
    social: {
      price: { type: Number, default: 0 },
      hours: [{ type: String }], // ['13:00-14:00'] только будни
      isActive: { type: Boolean, default: true }
    }
  },
  
  // Динамическое ценообразование
  dynamicPricing: {
    isEnabled: { type: Boolean, default: true },
    loadThreshold: { type: Number, default: 80 }, // Порог загрузки в %
    priceMultiplier: { type: Number, default: 1.05 }, // Увеличение на 5%
    discountThreshold: { type: Number, default: 24 }, // Часов до начала слота
    discountPercent: { type: Number, default: 10 }
  },
  
  // Техническая информация
  specifications: {
    length: { type: Number }, // в метрах
    width: { type: Number }, // в метрах
    height: { type: Number }, // в метрах
    lighting: {
      type: String,
      enum: ['led', 'halogen', 'natural'],
      default: 'led'
    },
    hasRoof: { type: Boolean, default: true },
    hasHeating: { type: Boolean, default: true },
    maxPlayers: { type: Number, default: 4 }
  },
  
  // Оборудование корта
  equipment: {
    nets: {
      count: { type: Number, default: 1 },
      condition: { type: String, enum: ['new', 'good', 'fair', 'poor'], default: 'good' },
      lastReplaced: Date
    },
    lighting: {
      bulbCount: { type: Number },
      lastMaintenance: Date,
      condition: { type: String, enum: ['excellent', 'good', 'fair', 'poor'], default: 'good' }
    },
    flooring: {
      condition: { type: String, enum: ['excellent', 'good', 'fair', 'poor'], default: 'good' },
      lastMaintenance: Date,
      nextMaintenanceDate: Date
    }
  },
  
  // IoT интеграция
  iot: {
    deviceId: { type: String, unique: true, sparse: true },
    sensors: {
      temperature: {
        deviceId: String,
        isActive: { type: Boolean, default: true },
        lastReading: {
          value: Number,
          timestamp: Date
        }
      },
      humidity: {
        deviceId: String,
        isActive: { type: Boolean, default: true },
        lastReading: {
          value: Number,
          timestamp: Date
        }
      },
      co2: {
        deviceId: String,
        isActive: { type: Boolean, default: true },
        lastReading: {
          value: Number,
          timestamp: Date
        }
      },
      occupancy: {
        deviceId: String,
        isActive: { type: Boolean, default: true },
        currentCount: { type: Number, default: 0 }
      }
    },
    controls: {
      lighting: {
        deviceId: String,
        isActive: { type: Boolean, default: true },
        currentStatus: { type: Boolean, default: false }
      },
      ventilation: {
        deviceId: String,
        isActive: { type: Boolean, default: true },
        currentSpeed: { type: Number, default: 0, min: 0, max: 100 }
      },
      access: {
        deviceId: String,
        isActive: { type: Boolean, default: true },
        currentStatus: { type: String, enum: ['locked', 'unlocked'], default: 'locked' }
      }
    }
  },
  
  // Блокировки и обслуживание
  maintenanceSchedule: [{
    type: {
      type: String,
      enum: ['routine', 'repair', 'upgrade', 'cleaning'],
      required: true
    },
    description: String,
    scheduledDate: { type: Date, required: true },
    duration: { type: Number, required: true }, // в минутах
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled'
    },
    assignedTo: String,
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Статистика использования
  statistics: {
    totalBookings: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    averageUtilization: { type: Number, default: 0 }, // в процентах
    peakHourUtilization: { type: Number, default: 0 },
    revenue: {
      thisMonth: { type: Number, default: 0 },
      lastMonth: { type: Number, default: 0 },
      thisYear: { type: Number, default: 0 }
    },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Медиа
  images: [{
    url: String,
    alt: String,
    isPrimary: Boolean,
    uploadDate: { type: Date, default: Date.now }
  }],
  
  // Метаданные
  location: {
    building: String,
    floor: String,
    zone: String
  },
  
  // Интеграция с внешними системами
  externalIntegrations: {
    playtomic: {
      isEnabled: { type: Boolean, default: false },
      courtId: String,
      lastSync: Date
    },
    matchi: {
      isEnabled: { type: Boolean, default: false },
      courtId: String,
      lastSync: Date
    },
    padelmates: {
      isEnabled: { type: Boolean, default: false },
      courtId: String,
      lastSync: Date
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы для производительности
courtSchema.index({ number: 1 });
courtSchema.index({ status: 1, isAvailable: 1 });
courtSchema.index({ type: 1 });
courtSchema.index({ 'iot.deviceId': 1 });

// Виртуальные поля
courtSchema.virtual('currentOccupancy').get(function() {
  return this.iot.sensors.occupancy.currentCount || 0;
});

courtSchema.virtual('isOperational').get(function() {
  return this.status === 'active' && this.isAvailable;
});

// Метод для получения цены в зависимости от времени
courtSchema.methods.getPriceForTime = function(dateTime) {
  const hour = dateTime.getHours();
  const timeString = `${hour.toString().padStart(2, '0')}:00`;
  
  // Проверяем социальные часы (бесплатные)
  if (this.pricing.social.isActive && this.isSocialHour(dateTime)) {
    return {
      price: this.pricing.social.price,
      tier: 'social'
    };
  }
  
  // Проверяем peak время
  if (this.isTimeInRange(timeString, this.pricing.peak.hours)) {
    return {
      price: this.pricing.peak.price,
      tier: 'peak'
    };
  }
  
  // Проверяем mid время
  if (this.isTimeInRange(timeString, this.pricing.mid.hours)) {
    return {
      price: this.pricing.mid.price,
      tier: 'mid'
    };
  }
  
  // По умолчанию off-peak
  return {
    price: this.pricing.off.price,
    tier: 'off'
  };
};

// Метод для проверки социальных часов
courtSchema.methods.isSocialHour = function(dateTime) {
  const day = dateTime.getDay();
  const hour = dateTime.getHours();
  
  // Социальные часы только в будни с 13:00 до 14:00
  return day >= 1 && day <= 5 && hour === 13;
};

// Утилита для проверки времени в диапазоне
courtSchema.methods.isTimeInRange = function(time, ranges) {
  return ranges.some(range => {
    const [start, end] = range.split('-');
    return time >= start && time < end;
  });
};

// Метод для проверки доступности в определенное время
courtSchema.methods.isAvailableAt = function(dateTime) {
  // Проверяем общую доступность
  if (!this.isOperational) {
    return { available: false, reason: 'Court is not operational' };
  }
  
  // Проверяем время работы
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dateTime.getDay()];
  const daySchedule = this.operatingHours[dayName];
  
  if (!daySchedule.isOpen) {
    return { available: false, reason: 'Court is closed on this day' };
  }
  
  const hour = dateTime.getHours();
  const minute = dateTime.getMinutes();
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  if (timeString < daySchedule.open || timeString >= daySchedule.close) {
    return { available: false, reason: 'Court is closed at this time' };
  }
  
  // Проверяем на обслуживание
  const maintenanceConflict = this.maintenanceSchedule.find(maintenance => {
    if (maintenance.status !== 'scheduled' && maintenance.status !== 'in_progress') {
      return false;
    }
    
    const maintenanceStart = new Date(maintenance.scheduledDate);
    const maintenanceEnd = new Date(maintenanceStart.getTime() + maintenance.duration * 60000);
    
    return dateTime >= maintenanceStart && dateTime < maintenanceEnd;
  });
  
  if (maintenanceConflict) {
    return { available: false, reason: 'Court is under maintenance' };
  }
  
  return { available: true };
};

// Метод для расчета динамической цены
courtSchema.methods.calculateDynamicPrice = function(basePrice, currentLoad, hoursUntilSlot) {
  if (!this.dynamicPricing.isEnabled) {
    return basePrice;
  }
  
  let finalPrice = basePrice;
  
  // Увеличение цены при высокой загрузке
  if (currentLoad >= this.dynamicPricing.loadThreshold) {
    finalPrice *= this.dynamicPricing.priceMultiplier;
  }
  
  // Скидка на непопулярные слоты
  if (hoursUntilSlot <= this.dynamicPricing.discountThreshold && currentLoad < 50) {
    finalPrice *= (1 - this.dynamicPricing.discountPercent / 100);
  }
  
  return Math.round(finalPrice * 100) / 100; // Округляем до центов
};

// Статический метод для получения доступных кортов
courtSchema.statics.findAvailableCourts = function(dateTime) {
  return this.find({ 
    status: 'active', 
    isAvailable: true 
  }).then(courts => {
    return courts.filter(court => court.isAvailableAt(dateTime).available);
  });
};

module.exports = mongoose.model('Court', courtSchema); 