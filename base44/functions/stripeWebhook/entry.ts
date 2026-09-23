import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@14.23.0';

Deno.serve(async (req) => {
  try {
    // Initialize Base44 client (no user auth required for webhooks)
    const base44 = createClientFromRequest(req);

    const stripeSecret = Deno.env.get('STRIPE_API_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeSecret || !webhookSecret) {
      return Response.json({ error: 'Stripe secrets are not configured' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecret);

    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      return Response.json({ error: 'Missing Stripe-Signature header' }, { status: 400 });
    }

    const body = await req.text();

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      return Response.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
    }

    // Handle events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('Checkout complete:', session.id, session.client_reference_id);
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        console.log('PaymentIntent succeeded:', pi.id);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.log('PaymentIntent failed:', pi.id);
        break;
      }
      default:
        console.log('Unhandled event type:', event.type);
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});