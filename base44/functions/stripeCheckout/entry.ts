import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@14.23.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await req.json() : {};
    const { priceId, quantity = 1, mode = 'payment', metadata = {}, successPath = '/Home?payment=success', cancelPath = '/Home?payment=cancel' } = body || {};

    if (!priceId) {
      return Response.json({ error: 'priceId is required' }, { status: 400 });
    }

    const stripeSecret = Deno.env.get('STRIPE_API_KEY');
    if (!stripeSecret) {
      return Response.json({ error: 'Stripe secret is not configured' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecret);

    const baseUrl = Deno.env.get('BASE_URL') || new URL(req.url).origin;

    const successUrl = `${baseUrl}${successPath}${successPath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}${cancelPath}`;

    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: { user_id: user.id, email: user.email || '', ...metadata },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});