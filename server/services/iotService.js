const mqtt = require('mqtt');
const Court = require('../models/Court');
const logger = require('../utils/logger');

class IoTService {
  constructor(io) {
    this.io = io;
    this.mqttClient = null;
    this.isConnected = false;
    this.sensorData = new Map();
    this.deviceStates = new Map();
    
    // Topics for different device types
    this.topics = {
      climate: 'sportairhub/climate/+/data',
      access: 'sportairhub/access/+/status',
      sensors: 'sportairhub/sensors/+/data',
      pneumatic: 'sportairhub/pneumatic/+/pressure',
      commands: 'sportairhub/commands/+'
    };
  }

  async initialize() {
    try {
      logger.logInfo('Initializing IoT Service...', 'IOT');
      
      if (!process.env.MQTT_BROKER_URL) {
        logger.logWarning('MQTT broker URL not configured, IoT service disabled', 'IOT');
        return;
      }

      // Connect to MQTT broker
      await this.connectMQTT();
      
      // Setup message handlers
      this.setupMessageHandlers();
      
      // Initialize device states
      await this.initializeDeviceStates();
      
      // Start sensor data collection
      this.startSensorDataCollection();
      
      logger.logInfo('IoT Service initialized successfully', 'IOT');
    } catch (error) {
      logger.logError(error, 'IOT_INIT');
      throw error;
    }
  }

  async connectMQTT() {
    return new Promise((resolve, reject) => {
      const options = {
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      };

      this.mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL, options);

      this.mqttClient.on('connect', () => {
        logger.logInfo('Connected to MQTT broker', 'IOT');
        this.isConnected = true;
        
        // Subscribe to all topics
        Object.values(this.topics).forEach(topic => {
          this.mqttClient.subscribe(topic, (err) => {
            if (err) {
              logger.logError(`Failed to subscribe to ${topic}: ${err.message}`, 'IOT');
            } else {
              logger.logDebug(`Subscribed to ${topic}`, 'IOT');
            }
          });
        });
        
        resolve();
      });

      this.mqttClient.on('error', (error) => {
        logger.logError(`MQTT connection error: ${error.message}`, 'IOT');
        this.isConnected = false;
        reject(error);
      });

      this.mqttClient.on('disconnect', () => {
        logger.logWarning('Disconnected from MQTT broker', 'IOT');
        this.isConnected = false;
      });

      this.mqttClient.on('reconnect', () => {
        logger.logInfo('Reconnecting to MQTT broker...', 'IOT');
      });
    });
  }

  setupMessageHandlers() {
    this.mqttClient.on('message', async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleMessage(topic, data);
      } catch (error) {
        logger.logError(`Error processing MQTT message: ${error.message}`, 'IOT');
      }
    });
  }

  async handleMessage(topic, data) {
    const topicParts = topic.split('/');
    const deviceType = topicParts[1];
    const deviceId = topicParts[2];
    const messageType = topicParts[3];

    switch (deviceType) {
      case 'climate':
        await this.handleClimateData(deviceId, data);
        break;
      case 'access':
        await this.handleAccessStatus(deviceId, data);
        break;
      case 'sensors':
        await this.handleSensorData(deviceId, data);
        break;
      case 'pneumatic':
        await this.handlePneumaticData(deviceId, data);
        break;
      default:
        logger.logDebug(`Unknown device type: ${deviceType}`, 'IOT');
    }
  }

  async handleClimateData(deviceId, data) {
    const { temperature, humidity, airQuality, timestamp } = data;
    
    // Store sensor data
    this.sensorData.set(`climate_${deviceId}`, {
      temperature,
      humidity,
      airQuality,
      timestamp: new Date(timestamp),
      lastUpdated: new Date()
    });

    // Find associated court
    const court = await Court.findOne({ 'iotSensors.deviceId': deviceId });
    if (court) {
      // Update court sensor data
      const sensorIndex = court.iotSensors.findIndex(sensor => sensor.deviceId === deviceId);
      if (sensorIndex !== -1) {
        court.iotSensors[sensorIndex].lastReading = {
          temperature,
          humidity,
          airQuality,
          timestamp: new Date(timestamp)
        };
        await court.save();
      }

      // Check if climate control is needed
      await this.checkClimateControl(court, { temperature, humidity, airQuality });
      
      // Emit real-time data to clients
      this.io.to('admin-room').emit('climate-data', {
        courtId: court._id,
        deviceId,
        data: { temperature, humidity, airQuality, timestamp }
      });
    }

    logger.logDebug(`Climate data received from ${deviceId}: T=${temperature}°C, H=${humidity}%, AQ=${airQuality}`, 'IOT');
  }

  async handleAccessStatus(deviceId, data) {
    const { status, userId, timestamp } = data;
    
    // Store access event
    this.deviceStates.set(`access_${deviceId}`, {
      status,
      userId,
      timestamp: new Date(timestamp),
      lastUpdated: new Date()
    });

    // Find associated court
    const court = await Court.findOne({ 'accessControl.deviceId': deviceId });
    if (court) {
      // Log access event
      court.accessControl.accessLog.push({
        userId,
        action: status === 'granted' ? 'entry' : 'denied',
        timestamp: new Date(timestamp),
        method: 'iot_device'
      });
      
      // Update last access
      if (status === 'granted') {
        court.accessControl.lastAccess = new Date(timestamp);
      }
      
      await court.save();

      // Emit real-time access event
      this.io.to('admin-room').emit('access-event', {
        courtId: court._id,
        deviceId,
        userId,
        status,
        timestamp
      });
    }

    logger.logInfo(`Access ${status} for user ${userId} at device ${deviceId}`, 'IOT');
  }

  async handleSensorData(deviceId, data) {
    const { sensorType, value, unit, timestamp } = data;
    
    // Store generic sensor data
    this.sensorData.set(`sensor_${deviceId}_${sensorType}`, {
      value,
      unit,
      timestamp: new Date(timestamp),
      lastUpdated: new Date()
    });

    // Emit to real-time dashboard
    this.io.to('admin-room').emit('sensor-data', {
      deviceId,
      sensorType,
      value,
      unit,
      timestamp
    });

    logger.logDebug(`Sensor data from ${deviceId} (${sensorType}): ${value} ${unit}`, 'IOT');
  }

  async handlePneumaticData(deviceId, data) {
    const { pressure, status, timestamp } = data;
    
    // Store pneumatic data
    this.sensorData.set(`pneumatic_${deviceId}`, {
      pressure,
      status,
      timestamp: new Date(timestamp),
      lastUpdated: new Date()
    });

    // Find associated court
    const court = await Court.findOne({ 'pneumaticBallons.deviceId': deviceId });
    if (court) {
      // Update pneumatic balloon data
      const ballonIndex = court.pneumaticBallons.findIndex(ballon => ballon.deviceId === deviceId);
      if (ballonIndex !== -1) {
        court.pneumaticBallons[ballonIndex].currentPressure = pressure;
        court.pneumaticBallons[ballonIndex].status = status;
        court.pneumaticBallons[ballonIndex].lastCheck = new Date(timestamp);
        await court.save();
      }

      // Check if pressure is within acceptable range
      await this.checkPneumaticPressure(court, deviceId, pressure);

      // Emit real-time pneumatic data
      this.io.to('admin-room').emit('pneumatic-data', {
        courtId: court._id,
        deviceId,
        pressure,
        status,
        timestamp
      });
    }

    logger.logDebug(`Pneumatic data from ${deviceId}: ${pressure} bar, status: ${status}`, 'IOT');
  }

  async checkClimateControl(court, climateData) {
    const { temperature, humidity, airQuality } = climateData;
    const settings = court.climateControl.settings;

    let commandsToSend = [];

    // Check temperature control
    if (temperature > settings.targetTemperature + settings.temperatureTolerance) {
      commandsToSend.push({
        action: 'cool',
        intensity: Math.min(10, Math.ceil((temperature - settings.targetTemperature) / 2))
      });
    } else if (temperature < settings.targetTemperature - settings.temperatureTolerance) {
      commandsToSend.push({
        action: 'heat',
        intensity: Math.min(10, Math.ceil((settings.targetTemperature - temperature) / 2))
      });
    }

    // Check humidity control
    if (humidity > settings.targetHumidity + settings.humidityTolerance) {
      commandsToSend.push({
        action: 'dehumidify',
        intensity: Math.min(10, Math.ceil((humidity - settings.targetHumidity) / 5))
      });
    } else if (humidity < settings.targetHumidity - settings.humidityTolerance) {
      commandsToSend.push({
        action: 'humidify',
        intensity: Math.min(10, Math.ceil((settings.targetHumidity - humidity) / 5))
      });
    }

    // Check air quality
    if (airQuality < settings.minAirQuality) {
      commandsToSend.push({
        action: 'ventilate',
        intensity: Math.min(10, Math.ceil((settings.minAirQuality - airQuality) / 10))
      });
    }

    // Send commands to devices
    for (const command of commandsToSend) {
      await this.sendClimateCommand(court._id, command);
    }
  }

  async checkPneumaticPressure(court, deviceId, pressure) {
    const ballon = court.pneumaticBallons.find(b => b.deviceId === deviceId);
    if (!ballon) return;

    const { minPressure, maxPressure } = ballon;

    if (pressure < minPressure) {
      await this.sendPneumaticCommand(deviceId, {
        action: 'inflate',
        targetPressure: (minPressure + maxPressure) / 2
      });
      
      logger.logWarning(`Low pressure detected in ${deviceId}: ${pressure} bar`, 'IOT');
    } else if (pressure > maxPressure) {
      await this.sendPneumaticCommand(deviceId, {
        action: 'deflate',
        targetPressure: (minPressure + maxPressure) / 2
      });
      
      logger.logWarning(`High pressure detected in ${deviceId}: ${pressure} bar`, 'IOT');
    }
  }

  async sendClimateCommand(courtId, command) {
    if (!this.isConnected) {
      logger.logWarning('MQTT not connected, cannot send climate command', 'IOT');
      return false;
    }

    const topic = `sportairhub/commands/climate/${courtId}`;
    const payload = JSON.stringify({
      ...command,
      timestamp: new Date().toISOString(),
      commandId: this.generateCommandId()
    });

    return new Promise((resolve) => {
      this.mqttClient.publish(topic, payload, (err) => {
        if (err) {
          logger.logError(`Failed to send climate command: ${err.message}`, 'IOT');
          resolve(false);
        } else {
          logger.logDebug(`Climate command sent to ${courtId}: ${command.action}`, 'IOT');
          resolve(true);
        }
      });
    });
  }

  async sendPneumaticCommand(deviceId, command) {
    if (!this.isConnected) {
      logger.logWarning('MQTT not connected, cannot send pneumatic command', 'IOT');
      return false;
    }

    const topic = `sportairhub/commands/pneumatic/${deviceId}`;
    const payload = JSON.stringify({
      ...command,
      timestamp: new Date().toISOString(),
      commandId: this.generateCommandId()
    });

    return new Promise((resolve) => {
      this.mqttClient.publish(topic, payload, (err) => {
        if (err) {
          logger.logError(`Failed to send pneumatic command: ${err.message}`, 'IOT');
          resolve(false);
        } else {
          logger.logDebug(`Pneumatic command sent to ${deviceId}: ${command.action}`, 'IOT');
          resolve(true);
        }
      });
    });
  }

  async sendAccessCommand(deviceId, command) {
    if (!this.isConnected) {
      logger.logWarning('MQTT not connected, cannot send access command', 'IOT');
      return false;
    }

    const topic = `sportairhub/commands/access/${deviceId}`;
    const payload = JSON.stringify({
      ...command,
      timestamp: new Date().toISOString(),
      commandId: this.generateCommandId()
    });

    return new Promise((resolve) => {
      this.mqttClient.publish(topic, payload, (err) => {
        if (err) {
          logger.logError(`Failed to send access command: ${err.message}`, 'IOT');
          resolve(false);
        } else {
          logger.logDebug(`Access command sent to ${deviceId}: ${command.action}`, 'IOT');
          resolve(true);
        }
      });
    });
  }

  async initializeDeviceStates() {
    try {
      const courts = await Court.find({});
      
      for (const court of courts) {
        // Initialize climate control states
        for (const sensor of court.iotSensors) {
          this.deviceStates.set(`climate_${sensor.deviceId}`, {
            courtId: court._id,
            status: 'initialized',
            lastUpdated: new Date()
          });
        }

        // Initialize access control states
        if (court.accessControl.deviceId) {
          this.deviceStates.set(`access_${court.accessControl.deviceId}`, {
            courtId: court._id,
            status: 'initialized',
            lastUpdated: new Date()
          });
        }

        // Initialize pneumatic balloon states
        for (const ballon of court.pneumaticBallons) {
          this.deviceStates.set(`pneumatic_${ballon.deviceId}`, {
            courtId: court._id,
            status: 'initialized',
            lastUpdated: new Date()
          });
        }
      }

      logger.logInfo(`Initialized ${this.deviceStates.size} device states`, 'IOT');
    } catch (error) {
      logger.logError(`Failed to initialize device states: ${error.message}`, 'IOT');
    }
  }

  startSensorDataCollection() {
    // Clean up old sensor data every 5 minutes
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      
      for (const [key, data] of this.sensorData.entries()) {
        if (data.lastUpdated < cutoffTime) {
          this.sensorData.delete(key);
        }
      }
    }, 5 * 60 * 1000);

    logger.logInfo('Sensor data collection started', 'IOT');
  }

  generateCommandId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external use
  getSensorData(deviceId, sensorType = null) {
    if (sensorType) {
      return this.sensorData.get(`sensor_${deviceId}_${sensorType}`);
    }
    
    const data = {};
    for (const [key, value] of this.sensorData.entries()) {
      if (key.includes(deviceId)) {
        data[key] = value;
      }
    }
    return data;
  }

  getDeviceStatus(deviceId) {
    return this.deviceStates.get(deviceId);
  }

  isServiceConnected() {
    return this.isConnected;
  }

  async disconnect() {
    if (this.mqttClient) {
      this.mqttClient.end();
      logger.logInfo('IoT Service disconnected', 'IOT');
    }
  }
}

module.exports = IoTService; 