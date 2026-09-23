import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@14.23.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripeSecret = Deno.env.get('STRIPE_API_KEY');
    if (!stripeSecret) {
      return Response.json({ error: 'Stripe secret is not configured' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecret);

    const products = await stripe.products.list({ active: true, limit: 100, expand: ['data.default_price'] });
    const prices = await stripe.prices.list({ active: true, limit: 100 });

    const productsWithPrices = products.data.map((product) => {
      const productPrices = prices.data.filter((p) => p.product === product.id);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        prices: productPrices.map((price) => ({
          id: price.id,
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval || null,
          intervalCount: price.recurring?.interval_count || null,
          type: price.type,
        })),
      };
    });

    return Response.json({ products: productsWithPrices });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});