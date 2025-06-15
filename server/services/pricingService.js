const PricingRule = require('../models/PricingRule');
const Court = require('../models/Court');
const Booking = require('../models/Booking');
const axios = require('axios');

class PricingService {
  constructor() {
    this.weatherCache = new Map();
    this.occupancyCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    
    // Базовые цены по типам кортов
    this.basePrices = {
      indoor: {
        peak: 100,      // Пиковые часы (18:00-22:00 будни, 10:00-22:00 выходные)
        mid: 80,        // Средние часы (16:00-18:00 будни, 08:00-10:00 выходные)
        off: 60         // Непиковые часы (остальное время)
      },
      outdoor: {
        peak: 80,
        mid: 60,
        off: 40
      }
    };
    
    // Определение временных периодов
    this.timeSlots = {
      peak: {
        weekday: [{ start: '18:00', end: '22:00' }],
        weekend: [{ start: '10:00', end: '22:00' }]
      },
      mid: {
        weekday: [{ start: '16:00', end: '18:00' }],
        weekend: [{ start: '08:00', end: '10:00' }]
      }
    };
  }

  // Получение погодных данных
  async getWeatherData(lat = 41.0082, lon = 28.9784) { // Стамбул по умолчанию
    const cacheKey = `weather_${lat}_${lon}`;
    const cached = this.weatherCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Используем OpenWeatherMap API (нужен API ключ в .env)
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) {
        console.warn('OpenWeatherMap API key not found, using default weather data');
        return this.getDefaultWeatherData();
      }

      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );

      const weatherData = {
        temperature: Math.round(response.data.main.temp),
        humidity: response.data.main.humidity,
        condition: this.mapWeatherCondition(response.data.weather[0].main),
        windSpeed: response.data.wind?.speed || 0,
        visibility: response.data.visibility || 10000,
        timestamp: Date.now()
      };

      this.weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
      return weatherData;
    } catch (error) {
      console.error('Weather API error:', error.message);
      return this.getDefaultWeatherData();
    }
  }

  getDefaultWeatherData() {
    return {
      temperature: 20,
      humidity: 60,
      condition: 'sunny',
      windSpeed: 5,
      visibility: 10000,
      timestamp: Date.now()
    };
  }

  mapWeatherCondition(condition) {
    const mapping = {
      'Clear': 'sunny',
      'Clouds': 'cloudy',
      'Rain': 'rainy',
      'Drizzle': 'rainy',
      'Thunderstorm': 'rainy',
      'Snow': 'snowy',
      'Mist': 'cloudy',
      'Fog': 'cloudy'
    };
    return mapping[condition] || 'cloudy';
  }

  // Получение данных о загруженности
  async getOccupancyData(dateTime) {
    const cacheKey = `occupancy_${dateTime.toISOString().split('T')[0]}_${dateTime.getHours()}`;
    const cached = this.occupancyCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const startOfHour = new Date(dateTime);
      startOfHour.setMinutes(0, 0, 0);
      const endOfHour = new Date(startOfHour);
      endOfHour.setHours(endOfHour.getHours() + 1);

      // Получаем общее количество кортов
      const totalCourts = await Court.countDocuments({ isActive: true });

      // Получаем количество забронированных кортов в этот час
      const bookedCourts = await Booking.countDocuments({
        startTime: { $lt: endOfHour },
        endTime: { $gt: startOfHour },
        status: { $in: ['confirmed', 'checked_in'] }
      });

      const availableCourts = totalCourts - bookedCourts;
      const occupancyPercentage = totalCourts > 0 ? (bookedCourts / totalCourts) * 100 : 0;

      const occupancyData = {
        totalCourts,
        bookedCourts,
        availableCourts,
        percentage: Math.round(occupancyPercentage),
        timestamp: Date.now()
      };

      this.occupancyCache.set(cacheKey, { data: occupancyData, timestamp: Date.now() });
      return occupancyData;
    } catch (error) {
      console.error('Occupancy calculation error:', error);
      return {
        totalCourts: 10,
        bookedCourts: 0,
        availableCourts: 10,
        percentage: 0,
        timestamp: Date.now()
      };
    }
  }

  // Определение временного слота
  getTimeSlot(dateTime) {
    const hour = dateTime.getHours();
    const minute = dateTime.getMinutes();
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const isWeekend = dateTime.getDay() === 0 || dateTime.getDay() === 6;

    const slots = isWeekend ? 
      { peak: this.timeSlots.peak.weekend, mid: this.timeSlots.mid.weekend } :
      { peak: this.timeSlots.peak.weekday, mid: this.timeSlots.mid.weekday };

    // Проверяем пиковые часы
    for (const slot of slots.peak) {
      if (timeString >= slot.start && timeString <= slot.end) {
        return 'peak';
      }
    }

    // Проверяем средние часы
    for (const slot of slots.mid) {
      if (timeString >= slot.start && timeString <= slot.end) {
        return 'mid';
      }
    }

    return 'off';
  }

  // Получение базовой цены
  getBasePrice(courtType, timeSlot) {
    const courtPricing = this.basePrices[courtType] || this.basePrices.indoor;
    return courtPricing[timeSlot] || courtPricing.off;
  }

  // Основной метод расчета цены
  async calculatePrice(options) {
    const {
      courtId,
      dateTime,
      duration = 60, // минуты
      userId,
      playerCount = 2,
      bookingType = 'single'
    } = options;

    try {
      // Получаем данные о корте
      const court = await Court.findById(courtId);
      if (!court) {
        throw new Error('Court not found');
      }

      // Получаем пользователя (если указан)
      let user = null;
      if (userId) {
        const User = require('../models/User');
        user = await User.findById(userId);
      }

      // Определяем временной слот и базовую цену
      const timeSlot = this.getTimeSlot(dateTime);
      const basePrice = this.getBasePrice(court.type, timeSlot);

      // Получаем контекстные данные
      const [weatherData, occupancyData] = await Promise.all([
        this.getWeatherData(),
        this.getOccupancyData(dateTime)
      ]);

      // Формируем контекст для правил ценообразования
      const context = {
        time: dateTime,
        occupancy: occupancyData,
        user: user ? {
          type: user.subscription?.type || 'guest',
          loyaltyLevel: user.loyaltyProgram?.level || 'bronze',
          createdAt: user.createdAt
        } : null,
        weather: weatherData,
        court: {
          _id: court._id,
          type: court.type,
          quality: court.quality || 'standard'
        },
        booking: {
          type: bookingType,
          duration,
          playerCount
        }
      };

      // Применяем правила динамического ценообразования
      const pricingResult = await PricingRule.calculateDynamicPrice(basePrice, context);

      // Рассчитываем итоговую стоимость с учетом длительности
      const hourlyRate = pricingResult.finalPrice;
      const totalPrice = (hourlyRate * duration) / 60;

      // Добавляем дополнительные сборы за игроков (если больше 2)
      let additionalPlayerFee = 0;
      if (playerCount > 2) {
        additionalPlayerFee = (playerCount - 2) * 10; // 10zł за каждого дополнительного игрока
      }

      return {
        basePrice,
        hourlyRate,
        totalPrice: Math.round(totalPrice + additionalPlayerFee),
        additionalPlayerFee,
        timeSlot,
        duration,
        playerCount,
        appliedRules: pricingResult.appliedRules,
        context: {
          weather: weatherData,
          occupancy: occupancyData,
          court: {
            name: court.name,
            type: court.type,
            quality: court.quality
          }
        },
        breakdown: {
          baseHourlyRate: basePrice,
          adjustedHourlyRate: hourlyRate,
          durationCost: Math.round((hourlyRate * duration) / 60),
          additionalPlayerFee,
          total: Math.round(totalPrice + additionalPlayerFee)
        }
      };
    } catch (error) {
      console.error('Price calculation error:', error);
      throw error;
    }
  }

  // Получение прогноза цен на несколько дней
  async getPriceForecast(courtId, startDate, days = 7) {
    const forecast = [];
    const court = await Court.findById(courtId);
    
    if (!court) {
      throw new Error('Court not found');
    }

    for (let day = 0; day < days; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      
      const dayForecast = {
        date: date.toISOString().split('T')[0],
        dayOfWeek: date.toLocaleDateString('ru-RU', { weekday: 'long' }),
        slots: []
      };

      // Генерируем прогноз для каждого часа с 6:00 до 23:00
      for (let hour = 6; hour <= 23; hour++) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, 0, 0, 0);

        try {
          const pricing = await this.calculatePrice({
            courtId,
            dateTime: slotTime,
            duration: 60
          });

          dayForecast.slots.push({
            time: `${hour.toString().padStart(2, '0')}:00`,
            timeSlot: pricing.timeSlot,
            price: pricing.hourlyRate,
            totalPrice: pricing.totalPrice,
            occupancyPrediction: pricing.context.occupancy.percentage
          });
        } catch (error) {
          console.error(`Error calculating price for ${slotTime}:`, error);
        }
      }

      forecast.push(dayForecast);
    }

    return forecast;
  }

  // Получение статистики ценообразования
  async getPricingStats(startDate, endDate) {
    try {
      const rules = await PricingRule.find({
        'usage.lastApplied': {
          $gte: startDate,
          $lte: endDate
        }
      });

      const stats = {
        totalRulesApplied: 0,
        totalRevenue: 0,
        averageDiscount: 0,
        mostUsedRules: [],
        revenueByRule: [],
        dailyStats: []
      };

      rules.forEach(rule => {
        stats.totalRulesApplied += rule.usage.timesApplied;
        stats.totalRevenue += rule.usage.totalRevenue;
        
        stats.mostUsedRules.push({
          name: rule.name,
          applications: rule.usage.timesApplied,
          revenue: rule.usage.totalRevenue
        });
      });

      // Сортируем по количеству применений
      stats.mostUsedRules.sort((a, b) => b.applications - a.applications);
      stats.mostUsedRules = stats.mostUsedRules.slice(0, 10);

      // Рассчитываем средний дисконт
      if (rules.length > 0) {
        stats.averageDiscount = rules.reduce((sum, rule) => sum + rule.usage.averageDiscount, 0) / rules.length;
      }

      return stats;
    } catch (error) {
      console.error('Pricing stats error:', error);
      throw error;
    }
  }

  // Создание предустановленных правил ценообразования
  async createDefaultPricingRules(adminUserId) {
    const defaultRules = [
      {
        name: 'Скидка в дождливую погоду',
        description: 'Скидка 20% при дождливой погоде для открытых кортов',
        priority: 10,
        conditions: {
          weatherConditions: {
            conditions: ['rainy']
          },
          courtConditions: {
            courtTypes: ['outdoor']
          }
        },
        pricingActions: {
          actionType: 'percentage',
          value: -20,
          minPrice: 30
        },
        createdBy: adminUserId
      },
      {
        name: 'Надбавка за высокую загруженность',
        description: 'Надбавка 30% при загруженности выше 80%',
        priority: 20,
        conditions: {
          occupancyConditions: {
            minOccupancy: 80
          }
        },
        pricingActions: {
          actionType: 'percentage',
          value: 30,
          maxPrice: 150
        },
        createdBy: adminUserId
      },
      {
        name: 'Скидка для новых пользователей',
        description: 'Скидка 15% для пользователей, зарегистрированных менее 30 дней назад',
        priority: 5,
        conditions: {
          userConditions: {
            newUserDays: 30
          }
        },
        pricingActions: {
          actionType: 'percentage',
          value: -15
        },
        limits: {
          maxUserDailyApplications: 1
        },
        createdBy: adminUserId
      },
      {
        name: 'Скидка раннего бронирования',
        description: 'Скидка 10% при бронировании за 7+ дней',
        priority: 3,
        conditions: {
          occupancyConditions: {
            advanceBookingHours: {
              min: 168 // 7 дней
            }
          }
        },
        pricingActions: {
          actionType: 'percentage',
          value: -10
        },
        createdBy: adminUserId
      },
      {
        name: 'Динамическое ценообразование по загруженности',
        description: 'Формула: базовая цена + (загруженность * 0.5)',
        priority: 1,
        conditions: {
          occupancyConditions: {
            minOccupancy: 0
          }
        },
        pricingActions: {
          actionType: 'formula',
          value: 0,
          formula: 'basePrice * (1 + occupancy/100 * 0.5)',
          minPrice: 40,
          maxPrice: 200
        },
        combination: {
          allowCombination: true
        },
        createdBy: adminUserId
      }
    ];

    const createdRules = [];
    for (const ruleData of defaultRules) {
      try {
        const existingRule = await PricingRule.findOne({ name: ruleData.name });
        if (!existingRule) {
          const rule = new PricingRule(ruleData);
          await rule.save();
          createdRules.push(rule);
        }
      } catch (error) {
        console.error(`Error creating rule ${ruleData.name}:`, error);
      }
    }

    return createdRules;
  }

  // Очистка кэша
  clearCache() {
    this.weatherCache.clear();
    this.occupancyCache.clear();
  }

  // Получение рекомендаций по оптимизации цен
  async getPricingRecommendations(courtId, period = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      // Анализируем бронирования за период
      const bookings = await Booking.find({
        court: courtId,
        startTime: { $gte: startDate, $lte: endDate },
        status: { $in: ['confirmed', 'completed'] }
      });

      const recommendations = [];

      // Анализ по времени суток
      const hourlyStats = {};
      bookings.forEach(booking => {
        const hour = booking.startTime.getHours();
        if (!hourlyStats[hour]) {
          hourlyStats[hour] = { count: 0, revenue: 0 };
        }
        hourlyStats[hour].count++;
        hourlyStats[hour].revenue += booking.totalAmount;
      });

      // Находим часы с низкой загруженностью
      Object.entries(hourlyStats).forEach(([hour, stats]) => {
        if (stats.count < 5) { // Менее 5 бронирований за месяц
          recommendations.push({
            type: 'discount',
            priority: 'medium',
            title: `Низкая загруженность в ${hour}:00`,
            description: `Рассмотрите скидку для привлечения клиентов в ${hour}:00`,
            suggestedDiscount: 15,
            timeRange: `${hour}:00-${parseInt(hour) + 1}:00`
          });
        }
      });

      // Анализ по дням недели
      const weekdayStats = {};
      bookings.forEach(booking => {
        const weekday = booking.startTime.getDay();
        if (!weekdayStats[weekday]) {
          weekdayStats[weekday] = { count: 0, revenue: 0 };
        }
        weekdayStats[weekday].count++;
        weekdayStats[weekday].revenue += booking.totalAmount;
      });

      // Находим дни с высокой загруженностью
      Object.entries(weekdayStats).forEach(([day, stats]) => {
        if (stats.count > 20) { // Более 20 бронирований за месяц
          const dayName = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][day];
          recommendations.push({
            type: 'increase',
            priority: 'high',
            title: `Высокий спрос в ${dayName}`,
            description: `Рассмотрите повышение цены в ${dayName} на 10-20%`,
            suggestedIncrease: 15,
            day: dayName
          });
        }
      });

      return recommendations;
    } catch (error) {
      console.error('Pricing recommendations error:', error);
      return [];
    }
  }
}

module.exports = PricingService; 