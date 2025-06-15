const express = require('express');
const router = express.Router();
const Equipment = require('../models/Equipment');
const { auth, adminAuth } = require('../middleware/auth');
const { body, validationResult, param, query } = require('express-validator');

// Валидация для создания/обновления оборудования
const equipmentValidation = [
  body('name').trim().isLength({ min: 1 }).withMessage('Название обязательно'),
  body('category').isIn(['racket', 'balls', 'towel', 'shoes', 'protective_gear', 'maintenance', 'court_equipment'])
    .withMessage('Недопустимая категория'),
  body('pricing.rentalPrice').optional().isFloat({ min: 0 }).withMessage('Цена аренды должна быть положительной'),
  body('pricing.depositAmount').optional().isFloat({ min: 0 }).withMessage('Залог должен быть положительным')
];

// GET /api/equipment - Получить список оборудования
router.get('/', auth, async (req, res) => {
  try {
    const {
      category,
      status,
      available,
      search,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Построение фильтра
    const filter = {};
    
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (available === 'true') {
      filter.status = 'available';
      filter['availability.isRentable'] = true;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Сортировка
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const equipment = await Equipment.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email');

    const total = await Equipment.countDocuments(filter);

    res.json({
      equipment,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Equipment list error:', error);
    res.status(500).json({ message: 'Ошибка получения списка оборудования' });
  }
});

// GET /api/equipment/stats - Статистика инвентаря (только для админов)
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const stats = await Equipment.getInventoryStats();
    
    // Дополнительная статистика
    const totalEquipment = await Equipment.countDocuments();
    const needingMaintenance = await Equipment.countDocuments({
      nextMaintenanceDate: { $lte: new Date() }
    });
    const damaged = await Equipment.countDocuments({ status: 'damaged' });
    const rented = await Equipment.countDocuments({ status: 'rented' });

    res.json({
      categoryStats: stats,
      overview: {
        total: totalEquipment,
        needingMaintenance,
        damaged,
        rented,
        available: totalEquipment - rented - damaged - needingMaintenance
      }
    });
  } catch (error) {
    console.error('Equipment stats error:', error);
    res.status(500).json({ message: 'Ошибка получения статистики' });
  }
});

// GET /api/equipment/available/:category - Доступное оборудование по категории
router.get('/available/:category', auth, async (req, res) => {
  try {
    const { category } = req.params;
    const equipment = await Equipment.findAvailable(category);
    
    res.json(equipment);
  } catch (error) {
    console.error('Available equipment error:', error);
    res.status(500).json({ message: 'Ошибка получения доступного оборудования' });
  }
});

// GET /api/equipment/maintenance - Оборудование, требующее обслуживания (только для админов)
router.get('/maintenance', adminAuth, async (req, res) => {
  try {
    const equipment = await Equipment.findNeedingMaintenance()
      .populate('createdBy', 'name email');
    
    res.json(equipment);
  } catch (error) {
    console.error('Maintenance equipment error:', error);
    res.status(500).json({ message: 'Ошибка получения оборудования для обслуживания' });
  }
});

// GET /api/equipment/:id - Получить конкретное оборудование
router.get('/:id', [
  auth,
  param('id').isMongoId().withMessage('Недопустимый ID оборудования')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const equipment = await Equipment.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email')
      .populate('rentalHistory.user', 'name email')
      .populate('rentalHistory.booking', 'startTime endTime court');

    if (!equipment) {
      return res.status(404).json({ message: 'Оборудование не найдено' });
    }

    res.json(equipment);
  } catch (error) {
    console.error('Equipment details error:', error);
    res.status(500).json({ message: 'Ошибка получения данных оборудования' });
  }
});

// POST /api/equipment - Создать новое оборудование (только для админов)
router.post('/', [
  adminAuth,
  ...equipmentValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const equipmentData = {
      ...req.body,
      createdBy: req.user.id,
      lastUpdatedBy: req.user.id
    };

    const equipment = new Equipment(equipmentData);
    await equipment.save();

    res.status(201).json(equipment);
  } catch (error) {
    console.error('Equipment creation error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Оборудование с таким серийным номером или штрих-кодом уже существует' 
      });
    }
    res.status(500).json({ message: 'Ошибка создания оборудования' });
  }
});

// PUT /api/equipment/:id - Обновить оборудование (только для админов)
router.put('/:id', [
  adminAuth,
  param('id').isMongoId().withMessage('Недопустимый ID оборудования'),
  ...equipmentValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Оборудование не найдено' });
    }

    // Обновляем поля
    Object.assign(equipment, req.body);
    equipment.lastUpdatedBy = req.user.id;

    await equipment.save();
    res.json(equipment);
  } catch (error) {
    console.error('Equipment update error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Оборудование с таким серийным номером или штрих-кодом уже существует' 
      });
    }
    res.status(500).json({ message: 'Ошибка обновления оборудования' });
  }
});

// POST /api/equipment/:id/rent - Арендовать оборудование
router.post('/:id/rent', [
  auth,
  param('id').isMongoId().withMessage('Недопустимый ID оборудования'),
  body('bookingId').isMongoId().withMessage('Недопустимый ID бронирования'),
  body('duration').isInt({ min: 1 }).withMessage('Длительность должна быть положительной')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Оборудование не найдено' });
    }

    const { bookingId, duration } = req.body;
    await equipment.rent(bookingId, req.user.id, duration);

    res.json({ 
      message: 'Оборудование успешно арендовано',
      equipment 
    });
  } catch (error) {
    console.error('Equipment rental error:', error);
    if (error.message === 'Equipment is not available for rental') {
      return res.status(400).json({ message: 'Оборудование недоступно для аренды' });
    }
    res.status(500).json({ message: 'Ошибка аренды оборудования' });
  }
});

// POST /api/equipment/:id/return - Вернуть оборудование
router.post('/:id/return', [
  auth,
  param('id').isMongoId().withMessage('Недопустимый ID оборудования'),
  body('condition').isIn(['new', 'excellent', 'good', 'fair', 'poor', 'damaged'])
    .withMessage('Недопустимое состояние'),
  body('damages').optional().isString().withMessage('Описание повреждений должно быть строкой')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Оборудование не найдено' });
    }

    const { condition, damages } = req.body;
    await equipment.return(condition, damages);

    res.json({ 
      message: 'Оборудование успешно возвращено',
      equipment 
    });
  } catch (error) {
    console.error('Equipment return error:', error);
    if (error.message === 'No active rental found') {
      return res.status(400).json({ message: 'Активная аренда не найдена' });
    }
    res.status(500).json({ message: 'Ошибка возврата оборудования' });
  }
});

// POST /api/equipment/:id/maintenance - Запланировать обслуживание (только для админов)
router.post('/:id/maintenance', [
  adminAuth,
  param('id').isMongoId().withMessage('Недопустимый ID оборудования'),
  body('type').notEmpty().withMessage('Тип обслуживания обязателен'),
  body('date').isISO8601().withMessage('Недопустимая дата'),
  body('estimatedCost').optional().isFloat({ min: 0 }).withMessage('Стоимость должна быть положительной')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Оборудование не найдено' });
    }

    const { type, date, estimatedCost } = req.body;
    await equipment.scheduleMaintenance(type, new Date(date), estimatedCost);

    res.json({ 
      message: 'Обслуживание запланировано',
      equipment 
    });
  } catch (error) {
    console.error('Equipment maintenance scheduling error:', error);
    res.status(500).json({ message: 'Ошибка планирования обслуживания' });
  }
});

// POST /api/equipment/:id/maintenance/complete - Завершить обслуживание (только для админов)
router.post('/:id/maintenance/complete', [
  adminAuth,
  param('id').isMongoId().withMessage('Недопустимый ID оборудования'),
  body('type').notEmpty().withMessage('Тип обслуживания обязателен'),
  body('performedBy').notEmpty().withMessage('Исполнитель обязателен'),
  body('cost').isFloat({ min: 0 }).withMessage('Стоимость должна быть положительной'),
  body('notes').optional().isString().withMessage('Заметки должны быть строкой')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Оборудование не найдено' });
    }

    const { type, performedBy, cost, notes } = req.body;
    await equipment.performMaintenance(type, performedBy, cost, notes);

    res.json({ 
      message: 'Обслуживание завершено',
      equipment 
    });
  } catch (error) {
    console.error('Equipment maintenance completion error:', error);
    res.status(500).json({ message: 'Ошибка завершения обслуживания' });
  }
});

// DELETE /api/equipment/:id - Удалить оборудование (только для админов)
router.delete('/:id', [
  adminAuth,
  param('id').isMongoId().withMessage('Недопустимый ID оборудования')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Оборудование не найдено' });
    }

    // Проверяем, что оборудование не арендовано
    if (equipment.status === 'rented') {
      return res.status(400).json({ 
        message: 'Нельзя удалить арендованное оборудование' 
      });
    }

    await Equipment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Оборудование удалено' });
  } catch (error) {
    console.error('Equipment deletion error:', error);
    res.status(500).json({ message: 'Ошибка удаления оборудования' });
  }
});

// POST /api/equipment/bulk-import - Массовый импорт оборудования (только для админов)
router.post('/bulk-import', adminAuth, async (req, res) => {
  try {
    const { equipment } = req.body;
    
    if (!Array.isArray(equipment) || equipment.length === 0) {
      return res.status(400).json({ message: 'Необходим массив оборудования' });
    }

    const results = {
      success: 0,
      errors: []
    };

    for (let i = 0; i < equipment.length; i++) {
      try {
        const equipmentData = {
          ...equipment[i],
          createdBy: req.user.id,
          lastUpdatedBy: req.user.id
        };

        const newEquipment = new Equipment(equipmentData);
        await newEquipment.save();
        results.success++;
      } catch (error) {
        results.errors.push({
          index: i,
          data: equipment[i],
          error: error.message
        });
      }
    }

    res.json({
      message: `Импорт завершен: ${results.success} успешно, ${results.errors.length} ошибок`,
      results
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ message: 'Ошибка массового импорта' });
  }
});

module.exports = router; 