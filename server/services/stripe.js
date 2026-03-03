const Stripe = require('stripe');
const config = require('../config');

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

async function createPaymentIntent(amount, currency = 'gbp', metadata = {}) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount, // in pence
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  });

  console.log(`[STRIPE] Payment intent created: ${paymentIntent.id} for £${(amount / 100).toFixed(2)}`);

  return {
    id: paymentIntent.id,
    client_secret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
  };
}

async function refundPayment(paymentId, amountInPence = null) {
  const params = { payment_intent: paymentId };
  if (amountInPence) {
    params.amount = amountInPence; // Partial refund — specific amount in pence
  }
  // If no amount specified, Stripe refunds the full remaining amount

  const refund = await stripe.refunds.create(params);

  const label = amountInPence ? `£${(amountInPence / 100).toFixed(2)} partial` : 'full';
  console.log(`[STRIPE] Refund processed: ${refund.id} (${label}) for payment ${paymentId}`);
  return { id: refund.id, status: refund.status, amount: refund.amount };
}

module.exports = { createPaymentIntent, refundPayment };
