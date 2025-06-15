const nodemailer = require('nodemailer');
const User = require('../models/User');
const Booking = require('../models/Booking');
const logger = require('../utils/logger');

class NotificationService {
  constructor(io) {
    this.io = io;
    this.emailTransporter = null;
    this.isEmailConfigured = false;
    
    // Notification templates
    this.templates = {
      bookingConfirmation: {
        subject: 'Бронирование подтверждено - SportAirHub',
        html: this.getBookingConfirmationTemplate()
      },
      bookingReminder: {
        subject: 'Напоминание о бронировании - SportAirHub',
        html: this.getBookingReminderTemplate()
      },
      bookingCancellation: {
        subject: 'Бронирование отменено - SportAirHub',
        html: this.getBookingCancellationTemplate()
      },
      subscriptionExpiring: {
        subject: 'Ваш абонемент истекает - SportAirHub',
        html: this.getSubscriptionExpiringTemplate()
      },
      passExpiring: {
        subject: 'Ваши визиты истекают - SportAirHub',
        html: this.getPassExpiringTemplate()
      },
      promotion: {
        subject: 'Специальное предложение - SportAirHub',
        html: this.getPromotionTemplate()
      },
      welcomeMessage: {
        subject: 'Добро пожаловать в SportAirHub!',
        html: this.getWelcomeTemplate()
      },
      passwordReset: {
        subject: 'Сброс пароля - SportAirHub',
        html: this.getPasswordResetTemplate()
      }
    };

    this.initialize();
  }

  async initialize() {
    try {
      logger.logInfo('Initializing Notification Service...', 'NOTIFICATION');
      
      // Setup email transporter
      await this.setupEmailTransporter();
      
      // Start scheduled notification checking
      this.startScheduledChecks();
      
      logger.logInfo('Notification Service initialized successfully', 'NOTIFICATION');
    } catch (error) {
      logger.logError(error, 'NOTIFICATION_INIT');
    }
  }

  async setupEmailTransporter() {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      logger.logWarning('Email configuration incomplete, email notifications disabled', 'NOTIFICATION');
      return;
    }

    try {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // Verify email configuration
      await this.emailTransporter.verify();
      this.isEmailConfigured = true;
      logger.logInfo('Email transporter configured successfully', 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Email transporter setup failed: ${error.message}`, 'NOTIFICATION');
      this.isEmailConfigured = false;
    }
  }

  // Real-time WebSocket notifications
  async sendRealtimeNotification(userId, notification) {
    try {
      // Send to specific user room
      this.io.to(`user-${userId}`).emit('notification', {
        ...notification,
        timestamp: new Date(),
        id: this.generateNotificationId()
      });

      // Store notification in user's record
      await this.storeNotificationInUser(userId, notification);

      logger.logDebug(`Real-time notification sent to user ${userId}: ${notification.type}`, 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Failed to send real-time notification: ${error.message}`, 'NOTIFICATION');
    }
  }

  // Email notifications
  async sendEmailNotification(userEmail, subject, htmlContent) {
    if (!this.isEmailConfigured) {
      logger.logWarning('Email not configured, skipping email notification', 'NOTIFICATION');
      return false;
    }

    try {
      const emailOptions = {
        from: `SportAirHub <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: subject,
        html: htmlContent
      };

      await this.emailTransporter.sendMail(emailOptions);
      
      logger.logInfo(`Email sent to ${userEmail}`, 'NOTIFICATION');
      return true;
    } catch (error) {
      logger.logError(`Failed to send email notification: ${error.message}`, 'NOTIFICATION');
      return false;
    }
  }

  // Push notifications (placeholder for future implementation)
  async sendPushNotification(userId, notification) {
    try {
      // This would integrate with a push notification service like FCM
      // For now, we'll simulate it and store for future implementation
      
      await this.logNotification(userId, 'push', notification.type, notification);
      
      logger.logDebug(`Push notification queued for user ${userId}: ${notification.type}`, 'NOTIFICATION');
      return true;
    } catch (error) {
      logger.logError(`Failed to send push notification: ${error.message}`, 'NOTIFICATION');
      return false;
    }
  }

  // Booking-related notifications
  async sendBookingConfirmation(bookingId) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('userId', 'firstName lastName email notificationPreferences')
        .populate('courtId', 'name');

      if (!booking) {
        logger.logError(`Booking ${bookingId} not found for confirmation`, 'NOTIFICATION');
        return;
      }

      const user = booking.userId;

      // Send real-time notification
      await this.sendRealtimeNotification(user._id, {
        type: 'booking_confirmed',
        title: 'Бронирование подтверждено',
        message: `Ваше бронирование корта ${booking.courtId.name} подтверждено`,
        data: { booking, court: booking.courtId }
      });

      // Send email if user preferences allow
      if (user.notificationPreferences?.email?.bookingConfirmation) {
        const emailContent = this.getBookingConfirmationEmail(user, booking, booking.courtId);
        await this.sendEmailNotification(user.email, 'Бронирование подтверждено - SportAirHub', emailContent);
      }

      logger.logInfo(`Booking confirmation sent for booking ${bookingId}`, 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Failed to send booking confirmation: ${error.message}`, 'NOTIFICATION');
    }
  }

  async sendBookingReminder(bookingId, reminderType = '1hour') {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('userId', 'firstName lastName email notificationPreferences')
        .populate('courtId', 'name');

      if (!booking) return;

      const user = booking.userId;
      const timeUntil = reminderType === '1hour' ? '1 час' : '24 часа';

      // Send real-time notification
      await this.sendRealtimeNotification(user._id, {
        type: 'booking_reminder',
        title: 'Напоминание о бронировании',
        message: `Ваше бронирование начнется через ${timeUntil}`,
        data: { booking, court: booking.courtId, timeUntil }
      });

      // Send email if user preferences allow
      if (user.notificationPreferences?.email?.bookingReminder) {
        const emailContent = this.getBookingReminderEmail(user, booking, booking.courtId, timeUntil);
        await this.sendEmailNotification(user.email, 'Напоминание о бронировании - SportAirHub', emailContent);
      }

      logger.logInfo(`Booking reminder sent for booking ${bookingId} (${reminderType})`, 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Failed to send booking reminder: ${error.message}`, 'NOTIFICATION');
    }
  }

  async sendBookingCancellation(bookingId, reason = '') {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('userId', 'firstName lastName email notificationPreferences')
        .populate('courtId', 'name');

      if (!booking) return;

      const user = booking.userId;

      // Send real-time notification
      await this.sendRealtimeNotification(user._id, {
        type: 'booking_cancelled',
        title: 'Бронирование отменено',
        message: `Ваше бронирование корта ${booking.courtId.name} отменено`,
        data: { booking, court: booking.courtId, reason }
      });

      // Send email notification
      if (user.notificationPreferences?.email?.bookingCancellation) {
        const emailContent = this.getBookingCancellationEmail(user, booking, booking.courtId, reason);
        await this.sendEmailNotification(user.email, 'Бронирование отменено - SportAirHub', emailContent);
      }

      logger.logInfo(`Booking cancellation sent for booking ${bookingId}`, 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Failed to send booking cancellation: ${error.message}`, 'NOTIFICATION');
    }
  }

  // Subscription and pass notifications
  async sendSubscriptionExpiringNotification(userId, subscription, daysLeft) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const notificationData = {
        subscription,
        daysLeft
      };

      // Send real-time notification
      await this.sendRealtimeNotification(userId, {
        type: 'subscription_expiring',
        title: 'Абонемент истекает',
        message: `Ваш абонемент истекает через ${daysLeft} дней`,
        data: notificationData
      });

      // Send email notification
      if (user.notificationPreferences.email.subscriptionExpiring) {
        await this.sendEmailNotification(user.email, 'Абонемент истекает - SportAirHub', this.processTemplate(this.templates.subscriptionExpiring.html, notificationData));
      }

      logger.logInfo(`Subscription expiring notification sent to user ${userId}`, 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Failed to send subscription expiring notification: ${error.message}`, 'NOTIFICATION');
    }
  }

  async sendPassExpiringNotification(userId, pass, visitsLeft) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const notificationData = {
        pass,
        visitsLeft
      };

      // Send real-time notification
      await this.sendRealtimeNotification(userId, {
        type: 'pass_expiring',
        title: 'Визиты заканчиваются',
        message: `У вас осталось ${visitsLeft} визитов`,
        data: notificationData
      });

      // Send email notification
      if (user.notificationPreferences.email.passExpiring) {
        await this.sendEmailNotification(user.email, 'Визиты заканчиваются - SportAirHub', this.processTemplate(this.templates.passExpiring.html, notificationData));
      }

      logger.logInfo(`Pass expiring notification sent to user ${userId}`, 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Failed to send pass expiring notification: ${error.message}`, 'NOTIFICATION');
    }
  }

  // Promotional notifications
  async sendPromotionalNotification(userId, promotion) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.notificationPreferences.promotional) return;

      const notificationData = { promotion };

      // Send real-time notification
      await this.sendRealtimeNotification(userId, {
        type: 'promotion',
        title: 'Специальное предложение',
        message: promotion.title,
        data: notificationData
      });

      // Send email notification
      if (user.notificationPreferences.email.promotional) {
        await this.sendEmailNotification(user.email, 'Специальное предложение - SportAirHub', this.processTemplate(this.templates.promotion.html, notificationData));
      }

      logger.logInfo(`Promotional notification sent to user ${userId}`, 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Failed to send promotional notification: ${error.message}`, 'NOTIFICATION');
    }
  }

  // System notifications
  async sendSystemNotification(message, level = 'info', targetUsers = 'all') {
    try {
      const notification = {
        type: 'system',
        level,
        title: 'Системное уведомление',
        message,
        timestamp: new Date()
      };

      if (targetUsers === 'all') {
        // Broadcast to all connected clients
        this.io.emit('system-notification', notification);
      } else if (targetUsers === 'admins') {
        // Send only to admin room
        this.io.to('admin-room').emit('system-notification', notification);
      } else if (Array.isArray(targetUsers)) {
        // Send to specific users
        targetUsers.forEach(userId => {
          this.io.to(`user-${userId}`).emit('system-notification', notification);
        });
      }

      logger.logInfo(`System notification sent: ${message}`, 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Failed to send system notification: ${error.message}`, 'NOTIFICATION');
    }
  }

  // Welcome notification
  async sendWelcomeNotification(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Send welcome email
      const emailContent = this.getWelcomeEmail(user);
      await this.sendEmailNotification(user.email, 'Добро пожаловать в SportAirHub!', emailContent);

      // Send real-time welcome
      await this.sendRealtimeNotification(userId, {
        type: 'welcome',
        title: 'Добро пожаловать!',
        message: 'Спасибо за регистрацию в SportAirHub',
        data: {}
      });

      logger.logInfo(`Welcome notification sent to user ${userId}`, 'NOTIFICATION');
    } catch (error) {
      logger.logError(`Failed to send welcome notification: ${error.message}`, 'NOTIFICATION');
    }
  }

  // Scheduled checks for reminders
  startScheduledChecks() {
    // Check every 10 minutes for upcoming bookings
    setInterval(async () => {
      try {
        await this.checkUpcomingBookings();
      } catch (error) {
        logger.logError(`Scheduled check failed: ${error.message}`, 'NOTIFICATION');
      }
    }, 10 * 60 * 1000); // 10 minutes

    logger.logInfo('Scheduled notification checks started', 'NOTIFICATION');
  }

  async checkUpcomingBookings() {
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Find bookings starting in 1 hour
      const upcomingBookings = await Booking.find({
        startTime: {
          $gte: oneHourFromNow,
          $lt: new Date(oneHourFromNow.getTime() + 10 * 60 * 1000) // 10-minute window
        },
        status: 'confirmed',
        'reminders.oneHour': false
      });

      // Send 1-hour reminders
      for (const booking of upcomingBookings) {
        await this.sendBookingReminder(booking._id, '1hour');
        booking.reminders.oneHour = true;
        await booking.save();
      }

      if (upcomingBookings.length > 0) {
        logger.logInfo(`Sent ${upcomingBookings.length} booking reminders`, 'NOTIFICATION');
      }
    } catch (error) {
      logger.logError(`Failed to check upcoming bookings: ${error.message}`, 'NOTIFICATION');
    }
  }

  // Utility methods
  async storeNotificationInUser(userId, notification) {
    try {
      await User.findByIdAndUpdate(userId, {
        $push: {
          'notifications': {
            ...notification,
            timestamp: new Date(),
            read: false
          }
        }
      });
    } catch (error) {
      logger.logError(`Failed to store notification in user record: ${error.message}`, 'NOTIFICATION');
    }
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Email templates
  getBookingConfirmationEmail(user, booking, court) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fffdf6; padding: 20px;">
        <h2 style="color: #e6a881; text-align: center;">Бронирование подтверждено</h2>
        <p>Здравствуйте, ${user.firstName}!</p>
        <p>Ваше бронирование корта <strong>${court.name}</strong> подтверждено.</p>
        <div style="background: #faf3df; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e6a881;">
          <p><strong>Дата и время:</strong> ${new Date(booking.startTime).toLocaleString('ru-RU')}</p>
          <p><strong>Длительность:</strong> ${booking.duration} минут</p>
          <p><strong>Стоимость:</strong> ${booking.totalPrice} zł</p>
        </div>
        <p>Покажите QR-код при входе в спортивный центр.</p>
        <p style="margin-top: 30px;">С уважением,<br><strong>Команда SportAirHub</strong></p>
      </div>
    `;
  }

  getBookingReminderEmail(user, booking, court, timeUntil) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fffdf6; padding: 20px;">
        <h2 style="color: #e6a881; text-align: center;">Напоминание о бронировании</h2>
        <p>Здравствуйте, ${user.firstName}!</p>
        <p>Напоминаем, что через <strong>${timeUntil}</strong> у вас забронирован корт <strong>${court.name}</strong>.</p>
        <div style="background: #faf3df; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e6a881;">
          <p><strong>Время начала:</strong> ${new Date(booking.startTime).toLocaleString('ru-RU')}</p>
          <p><strong>Длительность:</strong> ${booking.duration} минут</p>
        </div>
        <p>Не забудьте прийти вовремя!</p>
        <p style="margin-top: 30px;">С уважением,<br><strong>Команда SportAirHub</strong></p>
      </div>
    `;
  }

  getBookingCancellationEmail(user, booking, court, reason) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fffdf6; padding: 20px;">
        <h2 style="color: #e6a881; text-align: center;">Бронирование отменено</h2>
        <p>Здравствуйте, ${user.firstName}!</p>
        <p>К сожалению, ваше бронирование корта <strong>${court.name}</strong> отменено.</p>
        <div style="background: #faf3df; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e6a881;">
          <p><strong>Дата и время:</strong> ${new Date(booking.startTime).toLocaleString('ru-RU')}</p>
          ${reason ? `<p><strong>Причина:</strong> ${reason}</p>` : ''}
        </div>
        <p>Средства будут возвращены в течение 3-5 рабочих дней.</p>
        <p style="margin-top: 30px;">С уважением,<br><strong>Команда SportAirHub</strong></p>
      </div>
    `;
  }

  getWelcomeEmail(user) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fffdf6; padding: 20px;">
        <h2 style="color: #e6a881; text-align: center;">Добро пожаловать в SportAirHub!</h2>
        <p>Здравствуйте, ${user.firstName}!</p>
        <p>Спасибо за регистрацию в нашей платформе для бронирования кортов.</p>
        <div style="background: #faf3df; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e6a881;">
          <p>Теперь вы можете:</p>
          <ul>
            <li>Легко бронировать корты онлайн</li>
            <li>Управлять своими тренировками</li>
            <li>Получать уведомления о бронированиях</li>
            <li>Пользоваться специальными предложениями</li>
          </ul>
        </div>
        <p style="margin-top: 30px;">С уважением,<br><strong>Команда SportAirHub</strong></p>
      </div>
    `;
  }
}

module.exports = NotificationService;