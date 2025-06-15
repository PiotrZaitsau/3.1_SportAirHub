const express = require('express');
const router = express.Router();
const PricingRule = require('../models/PricingRule');
const DynamicPricingService = require('../services/dynamicPricing');
const { auth, adminAuth } = require('../middleware/auth');
const { body, validationResult, param, query } = require('express-validator');

const pricingService = new DynamicPricingService();

// Валидация для правил ценообразования
const pricingRuleValidation = [
  body('name').trim().isLength({ min: 1 }).withMessage('Название правила обязательно'),
  body('pricingActions.actionType').isIn(['percentage', 'fixed_amount', 'fixed_price', 'formula'])
    .withMessage('Недопустимый тип действия'),
  body('pricingActions.value').isNumeric().withMessage('Значение действия должно быть числом'),
  body('priority').optional().isInt({ min: 0 }).withMessage('Приоритет должен быть положительным числом')
];

// GET /api/pricing/calculate - Расчет цены для бронирования
router.get('/calculate', [
  auth,
  query('courtId').isMongoId().withMessage('Недопустимый ID корта'),
  query('dateTime').isISO8601().withMessage('Недопустимая дата и время'),
  query('duration').optional().isInt({ min: 30 }).withMessage('Длительность должна быть не менее 30 минут'),
  query('playerCount').optional().isInt({ min: 1, max: 10 }).withMessage('Количество игроков от 1 до 10')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      courtId,
      dateTime,
      duration = 60,
      playerCount = 2,
      bookingType = 'single'
    } = req.query;

    const pricing = await pricingService.calculatePrice({
      courtId,
      dateTime: new Date(dateTime),
      duration: parseInt(duration),
      userId: req.user.id,
      playerCount: parseInt(playerCount),
      bookingType
    });

    res.json(pricing);
  } catch (error) {
    console.error('Price calculation error:', error);
    res.status(500).json({ message: 'Ошибка расчета цены' });
  }
});

// GET /api/pricing/forecast - Прогноз цен на несколько дней
router.get('/forecast', [
  auth,
  query('courtId').isMongoId().withMessage('Недопустимый ID корта'),
  query('startDate').isISO8601().withMessage('Недопустимая начальная дата'),
  query('days').optional().isInt({ min: 1, max: 30 }).withMessage('Количество дней от 1 до 30')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { courtId, startDate, days = 7 } = req.query;

    const forecast = await pricingService.getPriceForecast(
      courtId,
      new Date(startDate),
      parseInt(days)
    );

    res.json(forecast);
  } catch (error) {
    console.error('Price forecast error:', error);
    res.status(500).json({ message: 'Ошибка получения прогноза цен' });
  }
});

// GET /api/pricing/rules - Получить список правил ценообразования (только для админов)
router.get('/rules', adminAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      isActive,
      search,
      sortBy = 'priority',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const rules = await PricingRule.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email');

    const total = await PricingRule.countDocuments(filter);

    res.json({
      rules,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Pricing rules list error:', error);
    res.status(500).json({ message: 'Ошибка получения правил ценообразования' });
  }
});

// GET /api/pricing/rules/:id - Получить конкретное правило ценообразования
router.get('/rules/:id', [
  adminAuth,
  param('id').isMongoId().withMessage('Недопустимый ID правила')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rule = await PricingRule.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email')
      .populate('combination.excludeRules', 'name description')
      .populate('combination.requireRules', 'name description');

    if (!rule) {
      return res.status(404).json({ message: 'Правило не найдено' });
    }

    res.json(rule);
  } catch (error) {
    console.error('Pricing rule details error:', error);
    res.status(500).json({ message: 'Ошибка получения данных правила' });
  }
});

// POST /api/pricing/rules - Создать новое правило ценообразования (только для админов)
router.post('/rules', [
  adminAuth,
  ...pricingRuleValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ruleData = {
      ...req.body,
      createdBy: req.user.id,
      lastUpdatedBy: req.user.id
    };

    const rule = new PricingRule(ruleData);
    await rule.save();

    res.status(201).json(rule);
  } catch (error) {
    console.error('Pricing rule creation error:', error);
    res.status(500).json({ message: 'Ошибка создания правила ценообразования' });
  }
});

// PUT /api/pricing/rules/:id - Обновить правило ценообразования (только для админов)
router.put('/rules/:id', [
  adminAuth,
  param('id').isMongoId().withMessage('Недопустимый ID правила'),
  ...pricingRuleValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rule = await PricingRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ message: 'Правило не найдено' });
    }

    Object.assign(rule, req.body);
    rule.lastUpdatedBy = req.user.id;

    await rule.save();
    res.json(rule);
  } catch (error) {
    console.error('Pricing rule update error:', error);
    res.status(500).json({ message: 'Ошибка обновления правила ценообразования' });
  }
});

// DELETE /api/pricing/rules/:id - Удалить правило ценообразования (только для админов)
router.delete('/rules/:id', [
  adminAuth,
  param('id').isMongoId().withMessage('Недопустимый ID правила')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rule = await PricingRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ message: 'Правило не найдено' });
    }

    res.json({ message: 'Правило ценообразования удалено' });
  } catch (error) {
    console.error('Pricing rule deletion error:', error);
    res.status(500).json({ message: 'Ошибка удаления правила ценообразования' });
  }
});

// POST /api/pricing/rules/:id/toggle - Включить/выключить правило (только для админов)
router.post('/rules/:id/toggle', [
  adminAuth,
  param('id').isMongoId().withMessage('Недопустимый ID правила')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rule = await PricingRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ message: 'Правило не найдено' });
    }

    rule.isActive = !rule.isActive;
    rule.lastUpdatedBy = req.user.id;
    await rule.save();

    res.json({
      message: `Правило ${rule.isActive ? 'активировано' : 'деактивировано'}`,
      rule
    });
  } catch (error) {
    console.error('Pricing rule toggle error:', error);
    res.status(500).json({ message: 'Ошибка изменения статуса правила' });
  }
});

// GET /api/pricing/stats - Статистика ценообразования (только для админов)
router.get('/stats', [
  adminAuth,
  query('startDate').optional().isISO8601().withMessage('Недопустимая начальная дата'),
  query('endDate').optional().isISO8601().withMessage('Недопустимая конечная дата')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate ? new Date(req.query.startDate) : 
      new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 дней назад

    const stats = await pricingService.getPricingStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Pricing stats error:', error);
    res.status(500).json({ message: 'Ошибка получения статистики ценообразования' });
  }
});

// POST /api/pricing/rules/default - Создать предустановленные правила (только для админов)
router.post('/rules/default', adminAuth, async (req, res) => {
  try {
    const createdRules = await pricingService.createDefaultPricingRules(req.user.id);
    
    res.json({
      message: `Создано ${createdRules.length} предустановленных правил`,
      rules: createdRules
    });
  } catch (error) {
    console.error('Default rules creation error:', error);
    res.status(500).json({ message: 'Ошибка создания предустановленных правил' });
  }
});

// GET /api/pricing/recommendations - Рекомендации по оптимизации цен (только для админов)
router.get('/recommendations', [
  adminAuth,
  query('courtId').optional().isMongoId().withMessage('Недопустимый ID корта'),
  query('period').optional().isInt({ min: 7, max: 365 }).withMessage('Период от 7 до 365 дней')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { courtId, period = 30 } = req.query;

    if (courtId) {
      const recommendations = await pricingService.getPricingRecommendations(
        courtId,
        parseInt(period)
      );
      res.json(recommendations);
    } else {
      // Получаем рекомендации для всех кортов
      const Court = require('../models/Court');
      const courts = await Court.find({ isActive: true });
      
      const allRecommendations = [];
      for (const court of courts) {
        const courtRecommendations = await pricingService.getPricingRecommendations(
          court._id,
          parseInt(period)
        );
        
        allRecommendations.push({
          court: {
            id: court._id,
            name: court.name,
            type: court.type
          },
          recommendations: courtRecommendations
        });
      }
      
      res.json(allRecommendations);
    }
  } catch (error) {
    console.error('Pricing recommendations error:', error);
    res.status(500).json({ message: 'Ошибка получения рекомендаций по ценообразованию' });
  }
});

// POST /api/pricing/cache/clear - Очистить кэш ценообразования (только для админов)
router.post('/cache/clear', adminAuth, async (req, res) => {
  try {
    pricingService.clearCache();
    res.json({ message: 'Кэш ценообразования очищен' });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ message: 'Ошибка очистки кэша' });
  }
});

module.exports = router; 