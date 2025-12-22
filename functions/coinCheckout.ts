import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@14.23.0';

function getRegionFromAcceptLanguage(acceptLanguage) {
  try {
    const first = (acceptLanguage || '').split(',')[0] || '';
    const parts = first.split('-');
    if (parts.length > 1) return parts[1].toUpperCase();
  } catch (_) {}
  return null;
}

function currencyForRegion(region) {
  const XOF = ['SN','CI','ML','BF','BJ','TG','NE','GW'];
  const XAF = ['CM','GA','GQ','TD','CG','CF'];
  const EUR = ['FR','BE','DE','IT','ES','NL','PT','IE','LU','AT','FI','GR','SK','SI','LT','LV','EE','CY','MT'];
  if (!region) return 'USD';
  if (XOF.includes(region)) return 'XOF';
  if (XAF.includes(region)) return 'XAF';
  if (EUR.includes(region)) return 'EUR';
  if (region === 'US') return 'USD';
  if (region === 'GB') return 'GBP';
  if (region === 'CA') return 'CAD';
  if (region === 'MA') return 'MAD';
  if (region === 'DZ') return 'DZD';
  if (region === 'TN') return 'TND';
  if (region === 'CH') return 'CHF';
  return 'USD';
}

const ZERO_DECIMAL = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF']);

function toUnitAmount(amountMajor, currency) {
  if (ZERO_DECIMAL.has(currency)) return Math.round(amountMajor);
  return Math.round(amountMajor * 100);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const stripeSecret = Deno.env.get('STRIPE_API_KEY');
    if (!stripeSecret) return Response.json({ error: 'Stripe secret is not configured' }, { status: 500 });

    const stripe = new Stripe(stripeSecret);

    const contentType = req.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await req.json() : {};

    const packageCfa = Number(body?.packageCfa);
    if (!packageCfa || packageCfa <= 0) {
      return Response.json({ error: 'packageCfa must be a positive number' }, { status: 400 });
    }

    const acceptLang = req.headers.get('accept-language') || '';
    const region = getRegionFromAcceptLanguage(acceptLang);
    let targetCurrency = (body?.currency || currencyForRegion(region)).toUpperCase();

    // XOF -> target conversion
    let rate = 1;
    if (targetCurrency === 'XAF') {
      rate = 1; // parity
    } else if (targetCurrency !== 'XOF') {
      const xr = await stripe.exchangeRates.retrieve('usd');
      const r = xr?.rates || {};
      const rXOF = r['xof'];
      const rTarget = r[(targetCurrency || 'usd').toLowerCase()];
      if (rXOF && rTarget) {
        rate = rTarget / rXOF;
      } else {
        rate = 1;
      }
    }

    const amountMajor = packageCfa * rate;
    const unit_amount = toUnitAmount(amountMajor, targetCurrency);

    const baseUrl = Deno.env.get('BASE_URL') || new URL(req.url).origin;
    const successUrl = `${baseUrl}/Home?payment=success&coins=${packageCfa}`;
    const cancelUrl = `${baseUrl}/Home?payment=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: targetCurrency.toLowerCase(),
            unit_amount,
            product_data: {
              name: `DamCash Coins (${packageCfa} D$)`,
              description: `${packageCfa} coins (D$)`
            }
          },
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: {
        user_id: user.id,
        email: user.email || '',
        coins: String(packageCfa),
        cfa: String(packageCfa),
        target_currency: targetCurrency,
        target_amount_major: String(amountMajor)
      },
      allow_promotion_codes: true,
    });

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});