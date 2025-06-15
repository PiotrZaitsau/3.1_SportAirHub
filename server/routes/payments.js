const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Booking = require("../models/Booking");
const User = require("../models/User");
const PassPurchase = require("../models/PassPurchase");
const logger = require("../utils/logger");

const router = express.Router();

// @desc    Create payment intent for booking
// @route   POST /api/payments/booking/:bookingId/intent
// @access  Private
router.post("/booking/:bookingId/intent", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate("courtId", "name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Бронирование не найдено"
      });
    }

    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Доступ запрещен"
      });
    }

    if (booking.status !== "pending_payment") {
      return res.status(400).json({
        success: false,
        message: "Бронирование не требует оплаты"
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(booking.totalPrice * 100), // Convert to kopecks
      currency: "pln",
      metadata: {
        bookingId: booking._id.toString(),
        userId: req.user.id,
        type: "booking"
      },
      description: `Бронирование корта ${booking.courtId.name} на ${new Date(booking.startTime).toLocaleString("ru-RU")}`
    });

    // Update booking with payment intent ID
    booking.paymentIntentId = paymentIntent.id;
    await booking.save();

    logger.logInfo(`Payment intent created for booking ${booking._id}`, "PAYMENT");

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: booking.totalPrice,
        bookingId: booking._id
      }
    });
  } catch (error) {
    logger.logError(`Create payment intent error: ${error.message}`, "PAYMENT");
    res.status(500).json({
      success: false,
      message: "Ошибка при создании платежа"
    });
  }
});

// @desc    Create payment intent for subscription
// @route   POST /api/payments/subscription/intent
// @access  Private
router.post("/subscription/intent", async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден"
      });
    }

    if (user.subscription.isActive) {
      return res.status(400).json({
        success: false,
        message: "У вас уже есть активный абонемент"
      });
    }

    const subscriptionPrice = 300; // 300 zł annual subscription

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: subscriptionPrice * 100, // Convert to grosz
      currency: "pln",
      metadata: {
        userId: req.user.id,
        type: "subscription"
      },
      description: "Годовой абонемент SportAirHub"
    });

    logger.logInfo(`Subscription payment intent created for user ${req.user.id}`, "PAYMENT");

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: subscriptionPrice
      }
    });
  } catch (error) {
    logger.logError(`Create subscription payment intent error: ${error.message}`, "PAYMENT");
    res.status(500).json({
      success: false,
      message: "Ошибка при создании платежа за абонемент"
    });
  }
});

// @desc    Create payment intent for pass purchase
// @route   POST /api/payments/pass/intent
// @access  Private
router.post("/pass/intent", async (req, res) => {
  try {
    const { quantity = 1 } = req.body;

    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({
        success: false,
        message: "Количество пропусков должно быть от 1 до 10"
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден"
      });
    }

    const passPrice = 500; // 500 zł for 10-pass card
    const totalAmount = passPrice * quantity;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount * 100, // Convert to grosz
      currency: "pln",
      metadata: {
        userId: req.user.id,
        type: "pass",
        quantity: quantity.toString()
      },
      description: `Карта на ${quantity * 10} посещений SportAirHub`
    });

    logger.logInfo(`Pass payment intent created for user ${req.user.id}, quantity: ${quantity}`, "PAYMENT");

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: totalAmount,
        quantity
      }
    });
  } catch (error) {
    logger.logError(`Create pass payment intent error: ${error.message}`, "PAYMENT");
    res.status(500).json({
      success: false,
      message: "Ошибка при создании платежа за пропуск"
    });
  }
});

// @desc    Confirm payment (webhook)
// @route   POST /api/payments/webhook
// @access  Public
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.logError(`Webhook signature verification failed: ${err.message}`, "PAYMENT");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentSuccess(event.data.object);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentFailure(event.data.object);
      break;
    default:
      logger.logInfo(`Unhandled event type: ${event.type}`, "PAYMENT");
  }

  res.json({ received: true });
});

// Handle successful payment
async function handlePaymentSuccess(paymentIntent) {
  try {
    const { metadata } = paymentIntent;
    
    if (metadata.type === "booking") {
      await handleBookingPaymentSuccess(metadata.bookingId, paymentIntent);
    } else if (metadata.type === "subscription") {
      await handleSubscriptionPaymentSuccess(metadata.userId, paymentIntent);
    } else if (metadata.type === "pass") {
      await handlePassPaymentSuccess(metadata.userId, metadata.quantity, paymentIntent);
    }

    logger.logInfo(`Payment processed successfully: ${paymentIntent.id}`, "PAYMENT");
  } catch (error) {
    logger.logError(`Error handling payment success: ${error.message}`, "PAYMENT");
  }
}

// Handle booking payment success
async function handleBookingPaymentSuccess(bookingId, paymentIntent) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return;

  booking.status = "confirmed";
  booking.paymentStatus = "completed";
  booking.paymentDate = new Date();
  booking.stripePaymentIntentId = paymentIntent.id;
  
  await booking.save();

  // Send confirmation notification
  if (global.notificationService) {
    await global.notificationService.sendBookingConfirmation(bookingId);
  }

  // Track the confirmed booking
  if (global.analyticsService) {
    global.analyticsService.trackUserAction(booking.userId, "booking_confirmed", {
      bookingId,
      amount: paymentIntent.amount / 100
    });
  }
}

// Handle subscription payment success
async function handleSubscriptionPaymentSuccess(userId, paymentIntent) {
  const user = await User.findById(userId);
  if (!user) return;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(startDate.getFullYear() + 1);

  user.subscription = {
    isActive: true,
    startDate,
    endDate,
    type: "annual",
    paymentIntentId: paymentIntent.id
  };

  await user.save();

  // Track subscription purchase
  if (global.analyticsService) {
    global.analyticsService.trackUserAction(userId, "subscription_purchased", {
      amount: paymentIntent.amount / 100,
      duration: "annual"
    });
  }
}

// Handle pass payment success
async function handlePassPaymentSuccess(userId, quantity, paymentIntent) {
  const user = await User.findById(userId);
  if (!user) return;

  // Create pass purchase record
  const passPurchase = new PassPurchase({
    userId,
    quantity: parseInt(quantity),
    totalPrice: paymentIntent.amount / 100,
    paymentIntentId: paymentIntent.id,
    status: "completed"
  });

  await passPurchase.save();

  // Add passes to user
  for (let i = 0; i < parseInt(quantity); i++) {
    const passExpiry = new Date();
    passExpiry.setFullYear(passExpiry.getFullYear() + 1);

    user.passes.push({
      totalVisits: 10,
      remainingVisits: 10,
      isActive: true,
      purchaseDate: new Date(),
      expiryDate: passExpiry,
      purchaseId: passPurchase._id
    });
  }

  await user.save();

  // Track pass purchase
  if (global.analyticsService) {
    global.analyticsService.trackUserAction(userId, "pass_purchased", {
      quantity: parseInt(quantity),
      amount: paymentIntent.amount / 100
    });
  }
}

// Handle payment failure
async function handlePaymentFailure(paymentIntent) {
  try {
    const { metadata } = paymentIntent;
    
    if (metadata.type === "booking") {
      const booking = await Booking.findById(metadata.bookingId);
      if (booking) {
        booking.paymentStatus = "failed";
        booking.status = "cancelled";
        await booking.save();
      }
    }

    logger.logInfo(`Payment failed: ${paymentIntent.id}`, "PAYMENT");
  } catch (error) {
    logger.logError(`Error handling payment failure: ${error.message}`, "PAYMENT");
  }
}

// @desc    Get payment status
// @route   GET /api/payments/status/:paymentIntentId
// @access  Private
router.get("/status/:paymentIntentId", async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.paymentIntentId);

    if (paymentIntent.metadata.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Доступ запрещен"
      });
    }

    res.json({
      success: true,
      data: {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency
      }
    });
  } catch (error) {
    logger.logError(`Get payment status error: ${error.message}`, "PAYMENT");
    res.status(500).json({
      success: false,
      message: "Ошибка при получении статуса платежа"
    });
  }
});

module.exports = router;
