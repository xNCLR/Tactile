const express = require('express');
const { getDb, queryOne, queryAll, runSql } = require('../db/schema');
const { createNotification } = require('../lib/notifications');
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
      logger.error('STRIPE_WEBHOOK_SECRET not configured — rejecting webhook. Use `stripe listen --forward-to` in development.');
      return res.status(500).json({ error: 'Webhook secret not configured' });
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

        const booking = queryOne(db, 'SELECT id FROM bookings WHERE payment_id = ?', [paymentIntent.id]);
        if (booking) {
          runSql(db, `UPDATE bookings SET status = 'cancelled', payment_status = 'failed', updated_at = datetime('now') WHERE id = ?`, [booking.id]);
          logger.info(`Booking ${booking.id} cancelled due to payment failure`);
        }
        break;
      }

      // ── Chargeback / Dispute events ──

      case 'charge.dispute.created': {
        const dispute = event.data.object;
        const paymentIntentId = dispute.payment_intent;
        logger.warn(`Chargeback opened: ${dispute.id} for payment ${paymentIntentId}, amount: ${dispute.amount}, reason: ${dispute.reason}`);

        // Find all bookings tied to this payment (could be recurring group)
        const bookings = queryAll(db, 'SELECT id, student_id, teacher_id FROM bookings WHERE payment_id = ?', [paymentIntentId]);

        for (const booking of bookings) {
          runSql(db, `UPDATE bookings SET payment_status = 'disputed', updated_at = datetime('now') WHERE id = ?`, [booking.id]);

          // Notify the teacher
          const teacher = queryOne(db, 'SELECT user_id FROM teacher_profiles WHERE id = ?', [booking.teacher_id]);
          if (teacher) {
            await createNotification({
              userId: teacher.user_id,
              type: 'payment_disputed',
              title: 'Payment Disputed',
              message: `A student has disputed a payment with their bank (reason: ${dispute.reason}). The funds are on hold pending resolution.`,
              link: '/dashboard',
            });
          }
        }

        if (bookings.length === 0) {
          logger.warn(`No bookings found for disputed payment ${paymentIntentId}`);
        }
        break;
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object;
        const paymentIntentId = dispute.payment_intent;
        const won = dispute.status === 'won'; // merchant won = charge stands
        logger.info(`Chargeback closed: ${dispute.id}, status: ${dispute.status}, won: ${won}`);

        const bookings = queryAll(db, 'SELECT id, student_id, teacher_id, status FROM bookings WHERE payment_id = ?', [paymentIntentId]);

        for (const booking of bookings) {
          if (won) {
            // Merchant won — payment stands, restore previous payment status
            runSql(db, `UPDATE bookings SET payment_status = 'paid', updated_at = datetime('now') WHERE id = ?`, [booking.id]);
          } else {
            // Student's bank sided with them — money clawed back
            runSql(db, `UPDATE bookings SET status = 'cancelled', payment_status = 'chargedback', updated_at = datetime('now') WHERE id = ?`, [booking.id]);
          }

          // Notify the teacher of the outcome
          const teacher = queryOne(db, 'SELECT user_id FROM teacher_profiles WHERE id = ?', [booking.teacher_id]);
          if (teacher) {
            await createNotification({
              userId: teacher.user_id,
              type: 'dispute_resolved',
              title: won ? 'Dispute Resolved — Payment Kept' : 'Dispute Lost — Payment Reversed',
              message: won
                ? 'The bank sided with you. The original payment has been restored.'
                : 'The bank sided with the student. The payment has been reversed and the booking cancelled.',
              link: '/dashboard',
            });
          }
        }
        break;
      }

      case 'charge.dispute.updated': {
        const dispute = event.data.object;
        logger.info(`Chargeback updated: ${dispute.id}, status: ${dispute.status}, reason: ${dispute.reason}`);
        // No action needed — just log. The created/closed events handle state changes.
        break;
      }

      default:
        logger.debug(`Unhandled webhook event type: ${event.type}`);
    }
  }
});

module.exports = router;
