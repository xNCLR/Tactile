const express = require('express');
const { getDb, queryOne, runSql } = require('../db/schema');
const logger = require('../lib/logger');
const config = require('../config');
const Stripe = require('stripe');

const router = express.Router();
const stripe = new Stripe(config.STRIPE_SECRET_KEY);

// POST /api/webhooks/stripe
// Note: This route should NOT use express.json() middleware
// Mount this route BEFORE app.use(express.json()) in index.js
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];

    if (!config.STRIPE_WEBHOOK_SECRET) {
      logger.warn('STRIPE_WEBHOOK_SECRET not configured, skipping signature verification');
      // In development without webhook secret, just process the event
      const event = JSON.parse(req.body);
      return handleWebhookEvent(event);
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      logger.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    await handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }

  async function handleWebhookEvent(event) {
    const db = await getDb();

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        logger.info(`Payment succeeded: ${paymentIntent.id}`);

        // Find booking by payment_id
        const booking = queryOne(db, 'SELECT id FROM bookings WHERE payment_id = ?', [paymentIntent.id]);
        if (booking) {
          runSql(db, `UPDATE bookings SET payment_status = 'paid', updated_at = datetime('now') WHERE id = ?`, [booking.id]);
          logger.info(`Booking ${booking.id} payment status updated to 'paid'`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        logger.info(`Payment failed: ${paymentIntent.id}`);

        // Find booking by payment_id
        const booking = queryOne(db, 'SELECT id FROM bookings WHERE payment_id = ?', [paymentIntent.id]);
        if (booking) {
          runSql(db, `UPDATE bookings SET status = 'cancelled', payment_status = 'failed', updated_at = datetime('now') WHERE id = ?`, [booking.id]);
          logger.info(`Booking ${booking.id} cancelled due to payment failure`);
        }
        break;
      }

      default:
        logger.debug(`Unhandled webhook event type: ${event.type}`);
    }
  }
});

module.exports = router;
