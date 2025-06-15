const PricingRule = require('../models/PricingRule');
const Court = require('../models/Court');
const Booking = require('../models/Booking');
const axios = require('axios');

class DynamicPricingService {
  constructor() {
    this.weatherCache = new Map();
    this.occupancyCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    
    // Базовые цены по типам кортов (₺/час)
    this.basePrices = {
      indoor: {
        peak: 100,      // Пиковые часы
        mid: 80,        // Средние часы
        off: 60         // Непиковые часы
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
  async getWeatherData(lat = 41.0082, lon = 28.9784) {
    const cacheKey = `weather_${lat}_${lon}`;
    const cached = this.weatherCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) {
        return this.getDefaultWeatherData();
      }

      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );

      const weatherData = {
        temperature: Math.round(response.data.main.temp),
        humidity: response.data.main.humidity,
        condition: this.mapWeatherCondition(response.data.weather[0].main),
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
      timestamp: Date.now()
    };
  }

  mapWeatherCondition(condition) {
    const mapping = {
      'Clear': 'sunny',
      'Clouds': 'cloudy',
      'Rain': 'rainy',
      'Snow': 'snowy'
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

      const totalCourts = await Court.countDocuments({ isActive: true });
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
      duration = 60,
      userId,
      playerCount = 2,
      bookingType = 'single'
    } = options;

    try {
      const court = await Court.findById(courtId);
      if (!court) {
        throw new Error('Court not found');
      }

      let user = null;
      if (userId) {
        const User = require('../models/User');
        user = await User.findById(userId);
      }

      const timeSlot = this.getTimeSlot(dateTime);
      const basePrice = this.getBasePrice(court.type, timeSlot);

      const [weatherData, occupancyData] = await Promise.all([
        this.getWeatherData(),
        this.getOccupancyData(dateTime)
      ]);

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

      const pricingResult = await PricingRule.calculateDynamicPrice(basePrice, context);
      const hourlyRate = pricingResult.finalPrice;
      const totalPrice = (hourlyRate * duration) / 60;

      let additionalPlayerFee = 0;
      if (playerCount > 2) {
        additionalPlayerFee = (playerCount - 2) * 10;
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

  // Создание предустановленных правил
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

  clearCache() {
    this.weatherCache.clear();
    this.occupancyCache.clear();
  }
}

module.exports = DynamicPricingService; 