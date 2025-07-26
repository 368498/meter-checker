# stripe-revenue-checker

A small program to calculate Stripe revenues for a specific plan or price over a given date range.

## Prerequisites

- Node.js v14 or higher
- Stripe account and secret key

## Installation

```sh
npm install
chmod +x revenue_by_price.js
```

## Usage

You can run the script with command-line arguments or environment variables.

### 1. Using Command-Line Arguments

```sh
STRIPE_SECRET_KEY=sk_your_stripe_key node revenue_by_price.js <plan_or_price_id> [date_from] [date_to]
```

- `<plan_or_price_id>`: The Stripe Plan or Price ID to check revenue for (required)
- `[date_from]`: (Optional) Start date in `YYYY-MM-DD` or ISO format (default: 2025-01-01)
- `[date_to]`: (Optional) End date in `YYYY-MM-DD` or ISO format (default: 2025-06-30)

**Example:**
```sh
STRIPE_SECRET_KEY=sk_test_123 node revenue_by_price.js price_test_321 2025-01-01 2025-06-30
```

### 2. Using Environment Variables

You can also set the plan/price ID and date range as environment variables:

```sh
export STRIPE_SECRET_KEY={{YOURE_KEY}}
export PRICE_ID={{YOUR_PRICE}}
node revenue_by_price.js
```

## Notes

- The script requires your Stripe secret key to be set as an environment variable (`STRIPE_SECRET_KEY`).
- The script supports both Stripe Price IDs and legacy Plan IDs.
- For best results, use Node.js v16 or later.
