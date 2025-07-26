#!/usr/bin/env node

import Stripe from 'stripe';

// CONFIG
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Accept plan/price ID and optional date range as command line arguments
const PRICE_ID = process.argv[2] || process.env.PRICE_ID || 'plan_Ga2bEahznOPwe5';
const DATE_FROM = process.argv[3] ? new Date(process.argv[3]) : new Date('2025-01-01T00:00:00Z');
const DATE_TO   = process.argv[4] ? new Date(process.argv[4]) : new Date('2025-06-30T23:59:59Z');


if (!STRIPE_SECRET_KEY) {
  console.error('Please set STRIPE_SECRET_KEY in your environment.');
  process.exit(1);
}

if (!PRICE_ID) {
  console.error('Please provide a plan/price ID as a command line argument or set PRICE_ID in your environment.');
  console.error('Usage: node revenue_by_price.js <plan_or_price_id> [date_from] [date_to]');
  console.error('Example: node revenue_by_price.js price_123 2025-01-01 2025-06-30');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);
const FROM = Math.floor(DATE_FROM.getTime() / 1000);
const TO   = Math.floor(DATE_TO.getTime() / 1000);

let totalCents = 0;

async function main() {
  let invoiceCount = 0;
  let lineCount = 0;
  let matchedLineCount = 0;
  let apiCallCount = 0;
  let startTime = Date.now();

  for await (const invoice of stripe.invoices.list({
    status: 'paid',
    created: { gte: FROM, lte: TO },
    expand: ['data.lines'],
  })) {
    apiCallCount++;
    invoiceCount++;
    for (const line of invoice.lines.data) {
      lineCount++;
      const linePriceId = line.price?.id || line.pricing?.price_details?.price;
      const linePlanId = line.plan?.id || line.pricing?.price_details?.product;

      if (linePriceId === PRICE_ID || linePlanId === PRICE_ID) {
        matchedLineCount++;
        totalCents += line.amount;
      }
    }
  }

  const totalDollars = (totalCents / 100).toFixed(2);
  let elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
