const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  // Основная информация
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['racket', 'balls', 'towel', 'shoes', 'protective_gear', 'maintenance', 'court_equipment'],
    required: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  
  // Идентификация
  serialNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  },
  qrCode: String,
  
  // Характеристики
  brand: String,
  model: String,
  size: String,
  weight: Number,
  color: String,
  material: String,
  
  // Состояние и статус
  status: {
    type: String,
    enum: ['available', 'rented', 'maintenance', 'damaged', 'retired'],
    default: 'available'
  },
  condition: {
    type: String,
    enum: ['new', 'excellent', 'good', 'fair', 'poor', 'damaged'],
    default: 'new'
  },
  
  // Финансовая информация
  pricing: {
    purchasePrice: { type: Number, min: 0 },
    rentalPrice: { type: Number, min: 0 },
    depositAmount: { type: Number, min: 0 },
    replacementCost: { type: Number, min: 0 }
  },
  
  // Даты
  purchaseDate: Date,
  warrantyExpiry: Date,
  lastMaintenanceDate: Date,
  nextMaintenanceDate: Date,
  retirementDate: Date,
  
  // Использование и статистика
  usage: {
    totalRentals: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    averageRentalDuration: { type: Number, default: 0 },
    lastRentedAt: Date,
    
    // Статистика по месяцам
    monthlyUsage: [{
      month: { type: Number, min: 1, max: 12 },
      year: Number,
      rentals: { type: Number, default: 0 },
      hours: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 }
    }]
  },
  
  // История аренды
  rentalHistory: [{
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rentedAt: { type: Date, default: Date.now },
    returnedAt: Date,
    duration: Number, // в минутах
    condition: {
      before: String,
      after: String
    },
    damages: String,
    fee: Number,
    deposit: Number,
    refundedDeposit: Number
  }],
  
  // Техническое обслуживание
  maintenance: {
    schedule: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'as_needed'],
      default: 'as_needed'
    },
    lastService: {
      date: Date,
      type: String,
      performedBy: String,
      notes: String,
      cost: Number
    },
    nextService: {
      date: Date,
      type: String,
      estimatedCost: Number
    },
    
    // История обслуживания
    history: [{
      date: { type: Date, default: Date.now },
      type: String,
      description: String,
      performedBy: String,
      cost: Number,
      partsReplaced: [String],
      notes: String
    }]
  },
  
  // Повреждения и ремонт
  damages: [{
    reportedAt: { type: Date, default: Date.now },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    description: String,
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'major', 'critical'],
      default: 'minor'
    },
    repairCost: Number,
    repairedAt: Date,
    repairedBy: String,
    repairNotes: String
  }],
  
  // Местоположение и хранение
  location: {
    area: String, // 'storage', 'court_1', 'reception', etc.
    shelf: String,
    position: String,
    lastMovedAt: Date,
    movedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Изображения и документы
  images: [String], // URLs to S3
  documents: [{
    type: String, // 'manual', 'warranty', 'receipt'
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Поставщик и закупка
  supplier: {
    name: String,
    contact: String,
    email: String,
    phone: String
  },
  
  // Правила использования
  rules: {
    maxRentalDuration: { type: Number, default: 180 }, // минут
    requiresDeposit: { type: Boolean, default: true },
    ageRestriction: Number,
    skillLevelRequired: String,
    specialInstructions: String
  },
  
  // Доступность
  availability: {
    isRentable: { type: Boolean, default: true },
    reservedFor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reservedUntil: Date,
    unavailableReason: String
  },
  
  // Метаданные
  notes: String,
  tags: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы для производительности
equipmentSchema.index({ category: 1, status: 1 });
equipmentSchema.index({ serialNumber: 1 });
equipmentSchema.index({ barcode: 1 });
equipmentSchema.index({ 'availability.isRentable': 1, status: 1 });
equipmentSchema.index({ 'nextMaintenanceDate': 1 });

// Виртуальные поля
equipmentSchema.virtual('isAvailable').get(function() {
  return this.status === 'available' && 
         this.availability.isRentable && 
         (!this.availability.reservedUntil || this.availability.reservedUntil < new Date());
});

equipmentSchema.virtual('needsMaintenance').get(function() {
  return this.nextMaintenanceDate && this.nextMaintenanceDate <= new Date();
});

equipmentSchema.virtual('utilizationRate').get(function() {
  const totalDaysOwned = this.purchaseDate ? 
    Math.ceil((new Date() - this.purchaseDate) / (1000 * 60 * 60 * 24)) : 1;
  return this.usage.totalRentals / totalDaysOwned;
});

equipmentSchema.virtual('revenueGenerated').get(function() {
  return this.usage.monthlyUsage.reduce((total, month) => total + month.revenue, 0);
});

// Методы экземпляра
equipmentSchema.methods.rent = async function(bookingId, userId, duration) {
  if (!this.isAvailable) {
    throw new Error('Equipment is not available for rental');
  }
  
  this.status = 'rented';
  this.usage.totalRentals += 1;
  this.usage.totalHours += duration / 60;
  this.usage.lastRentedAt = new Date();
  
  // Добавляем в историю аренды
  this.rentalHistory.push({
    booking: bookingId,
    user: userId,
    duration,
    condition: { before: this.condition },
    fee: this.pricing.rentalPrice,
    deposit: this.pricing.depositAmount
  });
  
  // Обновляем месячную статистику
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  let monthlyRecord = this.usage.monthlyUsage.find(m => m.month === month && m.year === year);
  if (!monthlyRecord) {
    monthlyRecord = { month, year, rentals: 0, hours: 0, revenue: 0 };
    this.usage.monthlyUsage.push(monthlyRecord);
  }
  
  monthlyRecord.rentals += 1;
  monthlyRecord.hours += duration / 60;
  monthlyRecord.revenue += this.pricing.rentalPrice;
  
  await this.save();
  return this;
};

equipmentSchema.methods.return = async function(condition, damages = null) {
  const currentRental = this.rentalHistory[this.rentalHistory.length - 1];
  if (!currentRental || currentRental.returnedAt) {
    throw new Error('No active rental found');
  }
  
  currentRental.returnedAt = new Date();
  currentRental.condition.after = condition;
  
  if (damages) {
    currentRental.damages = damages;
    this.damages.push({
      description: damages,
      severity: 'minor' // можно определить автоматически
    });
  }
  
  this.condition = condition;
  this.status = condition === 'damaged' ? 'damaged' : 'available';
  
  await this.save();
  return this;
};

equipmentSchema.methods.scheduleMaintenance = async function(type, date, estimatedCost) {
  this.maintenance.nextService = {
    date,
    type,
    estimatedCost
  };
  
  await this.save();
  return this;
};

equipmentSchema.methods.performMaintenance = async function(type, performedBy, cost, notes) {
  this.maintenance.lastService = {
    date: new Date(),
    type,
    performedBy,
    notes,
    cost
  };
  
  this.maintenance.history.push({
    type,
    description: notes,
    performedBy,
    cost,
    notes
  });
  
  this.lastMaintenanceDate = new Date();
  this.status = 'available';
  this.condition = 'good'; // После обслуживания состояние улучшается
  
  await this.save();
  return this;
};

// Статические методы
equipmentSchema.statics.findAvailable = function(category = null) {
  const query = { 
    status: 'available',
    'availability.isRentable': true
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query);
};

equipmentSchema.statics.findNeedingMaintenance = function() {
  const now = new Date();
  return this.find({
    nextMaintenanceDate: { $lte: now }
  });
};

equipmentSchema.statics.getInventoryStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
        rented: { $sum: { $cond: [{ $eq: ['$status', 'rented'] }, 1, 0] } },
        maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
        damaged: { $sum: { $cond: [{ $eq: ['$status', 'damaged'] }, 1, 0] } },
        totalValue: { $sum: '$pricing.purchasePrice' },
        totalRevenue: { $sum: { $sum: '$usage.monthlyUsage.revenue' } }
      }
    }
  ]);
};

module.exports = mongoose.model('Equipment', equipmentSchema); 