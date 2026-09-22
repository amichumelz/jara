/**
 * Cloudflare Pages Function
 * Endpoint: POST /api/create-checkout
 *
 * Menerima permintaan dari modal tempahan dan mencipta Stripe Checkout Session.
 * Kunci STRIPE_SECRET_KEY diambil secara selamat daripada Cloudflare Pages Environment Variables.
 */

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return new Response(
      JSON.stringify({
        error: 'STRIPE_SECRET_KEY belum ditetapkan dalam Cloudflare Pages Environment Variables. Sila masukkan secret key di Dashboard Cloudflare.',
      }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const { amount, currency = 'myr', description = 'Tempahan Jara Holidays', email, name, phone } = body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Jumlah bayaran tidak sah.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const origin = new URL(request.url).origin;

    // Bina parameter url-encoded untuk Stripe Checkout Session API
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${origin}/?payment=cancel`);

    if (email) {
      params.append('customer_email', email);
    }

    params.append('line_items[0][price_data][currency]', (currency || 'myr').toLowerCase());
    params.append('line_items[0][price_data][product_data][name]', description || 'Tempahan Aktiviti Langkawi');
    params.append('line_items[0][price_data][unit_amount]', Math.round(amount).toString());
    params.append('line_items[0][quantity]', '1');

    if (name) {
      params.append('metadata[customer_name]', name);
    }
    if (phone) {
      params.append('metadata[customer_phone]', phone);
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await stripeResponse.json();

    if (!stripeResponse.ok) {
      const errorMsg = data.error?.message || 'Ralat semasa mencipta sesi Stripe Checkout.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ url: data.url }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Ralat pelayan: ' + err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
