const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

async function refundPayment(paymentId) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentId,
  });

  console.log(`[STRIPE] Refund processed: ${refund.id} for payment ${paymentId}`);
  return { id: refund.id, status: refund.status };
}

module.exports = { createPaymentIntent, refundPayment };
