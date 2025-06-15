const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Court = require('../models/Court');
const User = require('../models/User');
const Equipment = require('../models/Equipment');
const DynamicPricingService = require('../services/dynamicPricing');
const { body, validationResult, param, query } = require('express-validator');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

const pricingService = new DynamicPricingService();

// Валидация для создания бронирования
const createBookingValidation = [
  body('courtId').isMongoId().withMessage('Недопустимый ID корта'),
  body('startTime').isISO8601().withMessage('Недопустимое время начала'),
  body('duration').isInt({ min: 60, max: 180 }).withMessage('Длительность должна быть от 60 до 180 минут'),
  body('totalPlayers').isInt({ min: 1, max: 4 }).withMessage('Количество игроков от 1 до 4'),
  body('players').optional().isArray().withMessage('Игроки должны быть массивом')
];

// GET /api/bookings - Получить список бронирований пользователя
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      courtId
    } = req.query;

    const filter = { user: req.user.id };
    
    if (status) filter.status = status;
    if (courtId) filter.court = courtId;
    
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(filter)
      .populate('court', 'name type location images')
      .populate('user', 'name email phone')
      .populate('equipment.requested.itemId')
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(filter);

    res.json({
      bookings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Ошибка получения бронирований' });
  }
});

// POST /api/bookings/calculate-price - Расчет цены перед бронированием
router.post('/calculate-price', [
  body('courtId').isMongoId().withMessage('Недопустимый ID корта'),
  body('startTime').isISO8601().withMessage('Недопустимое время начала'),
  body('duration').isInt({ min: 60, max: 180 }).withMessage('Длительность должна быть от 60 до 180 минут'),
  body('totalPlayers').isInt({ min: 1, max: 4 }).withMessage('Количество игроков от 1 до 4')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { courtId, startTime, duration, totalPlayers, equipment = [] } = req.body;

    // Рассчитываем цену с помощью сервиса динамического ценообразования
    const pricing = await pricingService.calculatePrice({
      courtId,
      dateTime: new Date(startTime),
      duration,
      userId: req.user.id,
      playerCount: totalPlayers,
      bookingType: 'single'
    });

    // Добавляем стоимость оборудования
    let equipmentCost = 0;
    if (equipment.length > 0) {
      for (const item of equipment) {
        const equipmentItem = await Equipment.findById(item.itemId);
        if (equipmentItem && equipmentItem.isAvailable) {
          equipmentCost += equipmentItem.pricing.rentalPrice * item.quantity;
        }
      }
    }

    const finalPrice = pricing.totalPrice + equipmentCost;

    res.json({
      ...pricing,
      equipmentCost,
      finalPrice,
      breakdown: {
        ...pricing.breakdown,
        equipmentCost,
        finalTotal: finalPrice
      }
    });
  } catch (error) {
    console.error('Price calculation error:', error);
    res.status(500).json({ message: 'Ошибка расчета цены' });
  }
});

// POST /api/bookings - Создать новое бронирование
router.post('/', createBookingValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      courtId,
      startTime,
      duration,
      totalPlayers,
      players = [],
      equipment = [],
      notes,
      paymentMethod = 'stripe'
    } = req.body;

    // Проверяем существование корта
    const court = await Court.findById(courtId);
    if (!court || !court.isActive) {
      return res.status(404).json({ message: 'Корт не найден или недоступен' });
    }

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    // Проверяем доступность корта
    const conflictingBooking = await Booking.findOne({
      court: courtId,
      status: { $in: ['confirmed', 'checked_in', 'in_progress'] },
      $or: [
        {
          startTime: { $lt: endDateTime },
          endTime: { $gt: startDateTime }
        }
      ]
    });

    if (conflictingBooking) {
      return res.status(409).json({ 
        message: 'Корт недоступен в указанное время',
        conflictingBooking: {
          id: conflictingBooking._id,
          startTime: conflictingBooking.startTime,
          endTime: conflictingBooking.endTime
        }
      });
    }

    // Получаем пользователя
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Рассчитываем цену с помощью динамического ценообразования
    const pricing = await pricingService.calculatePrice({
      courtId,
      dateTime: startDateTime,
      duration,
      userId: req.user.id,
      playerCount: totalPlayers,
      bookingType: 'single'
    });

    // Обрабатываем оборудование
    let equipmentCost = 0;
    const processedEquipment = [];
    
    for (const item of equipment) {
      const equipmentItem = await Equipment.findById(item.itemId);
      if (equipmentItem && equipmentItem.isAvailable) {
        equipmentCost += equipmentItem.pricing.rentalPrice * item.quantity;
        processedEquipment.push({
          itemId: item.itemId,
          type: equipmentItem.category,
          quantity: item.quantity,
          fee: equipmentItem.pricing.rentalPrice * item.quantity
        });
      }
    }

    const totalAmount = pricing.totalPrice + equipmentCost;

    // Генерируем номер бронирования
    const bookingNumber = `SAH${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Создаем QR код
    const qrData = {
      bookingId: bookingNumber,
      courtId,
      startTime: startDateTime,
      duration,
      userId: user._id
    };
    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));

    // Создаем бронирование
    const booking = new Booking({
      bookingNumber,
      user: req.user.id,
      court: courtId,
      startTime: startDateTime,
      endTime: endDateTime,
      duration,
      totalPlayers,
      players: players.map(player => ({
        ...player,
        isRegistered: !!player.user,
        isGuest: !player.user
      })),
      status: 'pending_payment',
      pricing: {
        basePrice: pricing.basePrice,
        tier: pricing.timeSlot,
        dynamicPrice: pricing.hourlyRate,
        additionalPlayerFee: pricing.additionalPlayerFee,
        appliedRules: pricing.appliedRules.map(rule => ({
          ruleId: rule.id,
          name: rule.name,
          description: rule.description,
          adjustment: 0 // Будет рассчитано позже
        })),
        weatherConditions: pricing.context.weather,
        occupancyRate: pricing.context.occupancy.percentage,
        totalAmount
      },
      payment: {
        method: paymentMethod,
        status: 'pending'
      },
      equipment: {
        requested: processedEquipment
      },
      accessControl: {
        qrCode,
        accessToken: Math.random().toString(36).substr(2, 16),
        qrCodeExpiry: new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000) // 24 часа после окончания
      },
      externalBooking: {
        source: 'web'
      },
      notes
    });

    await booking.save();

    // Резервируем оборудование
    for (const item of processedEquipment) {
      await Equipment.findByIdAndUpdate(item.itemId, {
        $set: {
          'availability.reservedFor': req.user.id,
          'availability.reservedUntil': endDateTime
        }
      });
    }

    // Отправляем аналитику
    if (req.app.locals.analyticsService) {
      req.app.locals.analyticsService.trackUserAction(req.user.id, 'booking_created', {
        courtId,
        price: totalAmount,
        duration,
        timeSlot: pricing.timeSlot,
        appliedRules: pricing.appliedRules.length
      });
    }

    logger.info(`Booking created: ${booking._id} for user ${req.user.id}`);

    res.status(201).json({
      message: 'Бронирование создано',
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        court: court.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        duration: booking.duration,
        totalAmount: booking.pricing.totalAmount,
        status: booking.status,
        qrCode: booking.accessControl.qrCode,
        pricing: booking.pricing
      }
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Ошибка создания бронирования' });
  }
});

module.exports = router; 