import { app, BrowserWindow, ipcMain } from 'electron';

import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import Store from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();

function createWindow() {
  const win = new BrowserWindow({
    width: 700,
    height: 600,
    icon: path.join(__dirname, 'assets/logo.icns'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile('renderer.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});


/**
 * Calculate net revenue for a given price/plan ID and date range.
 *
 * For each  invoice in the date range:
 *   - Sum the amounts of all invoice lines that match the given price/plan ID.
 *   - Subtract any refunds and credit notes issued for the invoice.
 *
 *
 * @param {string} secretKey - Stripe secret key
 * @param {string} priceOrPlanId - The price or plan ID to match
 * @param {string} dateFrom - Start date (inclusive)
 * @param {string} dateTo - End date (inclusive)
 * @returns {Promise<string>} - Net revenue as a string (dollars, 2 decimals)
 */
async function calculateRevenue(secretKey, priceOrPlanId, dateFrom, dateTo) {
  if (!secretKey || !priceOrPlanId || !dateFrom || !dateTo) return 0;
  const stripe = new Stripe(secretKey);
  const FROM = Math.floor(new Date(dateFrom).getTime() / 1000);
  const TO = Math.floor(new Date(dateTo).getTime() / 1000);
  let totalCents = 0;
  try {
    // Iterate through all paid invoices in date range
    for await (const invoice of stripe.invoices.list({
      status: 'paid',
      created: { gte: FROM, lte: TO },
      expand: ['data.lines'],
    })) {
      let invoiceHasMatch = false;
      let invoiceLineCents = 0;
      //Ensure each invoice line matches the price/plan ID
      for (const line of invoice.lines.data) {
        const linePriceId = line.price?.id || line.pricing?.price_details?.price;
        const linePlanId = line.plan?.id || line.pricing?.price_details?.product;
        if (linePriceId === priceOrPlanId || linePlanId === priceOrPlanId) {
          invoiceHasMatch = true;
          invoiceLineCents += line.amount;
        }
      }
      if (invoiceHasMatch) {
        // Subtract refunds and  credit notes 
        let refundCents = invoice.amount_refunded || 0;
        
        let creditNoteCents = 0;

        const creditNotes = await stripe.creditNotes.list({ invoice: invoice.id });
        if (creditNotes && creditNotes.data && creditNotes.data.length > 0) {
          for (const note of creditNotes.data) {
            creditNoteCents += note.amount || 0;
          }
        }
        // Add the net amount to the total
        totalCents += invoiceLineCents - refundCents - creditNoteCents;
      }
    }

    // Convert cents to dollars
    return (totalCents / 100).toFixed(2);
  } catch (err) {
    return 'ERROR';
  }
}

ipcMain.handle('calculate-revenue', async (event, { secretKey, stripeId, dateFrom, dateTo }) => {
  return await calculateRevenue(secretKey, stripeId, dateFrom, dateTo);
});


ipcMain.handle('get-stripe-key', () => {
  return store.get('stripeSecretKey', '');
});

ipcMain.handle('set-stripe-key', (event, key) => {
  store.set('stripeSecretKey', key);
  return true;
}); 