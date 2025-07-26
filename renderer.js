const tabSingle = document.getElementById('tab-single');
const tabBatch = document.getElementById('tab-batch');
const contentSingle = document.getElementById('content-single');
const contentBatch = document.getElementById('content-batch');
const tabInstructions = document.getElementById('tab-instructions');

const allTabs = [tabInstructions, tabBatch, tabSingle];
const allContents = [
  document.getElementById('content-instructions'),
  contentBatch,
  contentSingle
];

// Tab switching logic
tabInstructions.addEventListener('click', () => {
  allTabs.forEach((tab, i) => {
    tab.classList.toggle('active', tab === tabInstructions);
    allContents[i].classList.toggle('active', tab === tabInstructions);
  });
});

tabBatch.addEventListener('click', () => {
  allTabs.forEach((tab, i) => {
    tab.classList.toggle('active', tab === tabBatch);
    allContents[i].classList.toggle('active', tab === tabBatch);
  });
});

tabSingle.addEventListener('click', () => {
  allTabs.forEach((tab, i) => {
    tab.classList.toggle('active', tab === tabSingle);
    allContents[i].classList.toggle('active', tab === tabSingle);
  });
});


// Single calculation form
const revenueForm = document.getElementById('revenue-form');
revenueForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  const secretKey = document.getElementById('secretKey').value;
  await saveStripeKey(secretKey);
  const planId = document.getElementById('planId').value;
  const dateFrom = document.getElementById('dateFrom').value;
  const dateTo = document.getElementById('dateTo').value;

  const output = document.getElementById('output');
  output.textContent = `Submitted:\nSecret Key: ${secretKey ? '***' : ''}\nPlan/Price ID: ${planId}\nDate From: ${dateFrom}\nDate To: ${dateTo}`;

  // TODO: Send data to main process and display real results
});

// Batch CSV logic
// Load PapaParse f not present
if (typeof Papa === 'undefined') {
  const papaScript = document.createElement('script');
  papaScript.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
  document.head.appendChild(papaScript);
}

const csvForm = document.getElementById('csv-form');
const csvFileInput = document.getElementById('csvFile');
const csvPreview = document.getElementById('csv-preview');
const downloadBtn = document.getElementById('download-csv');
const csvSpinner = document.getElementById('csv-spinner');

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

async function saveStripeKey(key) {
  if (ipcRenderer && key) {
    await ipcRenderer.invoke('set-stripe-key', key);
  }
}

// Autofill logic
window.addEventListener('DOMContentLoaded', async () => {
  if (ipcRenderer) {
    const savedKey = await ipcRenderer.invoke('get-stripe-key');
    if (savedKey) {
      const keyInput = document.getElementById('secretKey');
      if (keyInput) keyInput.value = savedKey;
      const csvKeyInput = document.getElementById('csvSecretKey');
      if (csvKeyInput) csvKeyInput.value = savedKey;
    }
  }
});

//Allow for 'fuzzy' matching of column names
function fuzzyFindColumn(columns, patterns) {
  for (const pat of patterns) {
    const exact = columns.find(col => col.toLowerCase() === pat);
    if (exact) return exact;
  }
  for (const pat of patterns) {
    const inc = columns.find(col => col.toLowerCase().includes(pat));
    if (inc) return inc;
  }

  for (const pat of patterns) {
    const regex = new RegExp(pat, 'i');
    const reg = columns.find(col => regex.test(col));
    if (reg) return reg;
  }
  return null;
}


let parsedCSV = null;
let updatedCSV = null;

csvForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  const secretKey = document.getElementById('csvSecretKey').value;
  await saveStripeKey(secretKey);
  const file = csvFileInput.files[0];
  if (!file) {
    csvPreview.textContent = 'Please select a CSV file.';
    return;
  }

  csvSpinner.classList.add('active');
  csvPreview.textContent = 'Parsing CSV...';

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async function(results) {
      parsedCSV = results.data;
      const columns = results.meta.fields;
      const stripeIdCol = fuzzyFindColumn(columns, [
        'stripe_id', 'stripeid', 'stripe id', 'plan_id', 'planid', 'plan id', 'product_id', 'productid', 'product id', 'price_id', 'priceid', 'price id', 'id'
      ]);
      const dateFromCol = fuzzyFindColumn(columns, [
        'date_from', 'datefrom', 'date from', 'from_date', 'fromdate', 'from date', 'period_start', 'periodstart', 'period start', 'start'
      ]);
      const dateToCol = fuzzyFindColumn(columns, [
        'date_to', 'dateto', 'date to', 'to_date', 'todate', 'to date', 'period_end', 'periodend', 'period end', 'end'
      ]);
      if (!stripeIdCol || !dateFromCol || !dateToCol) {
        csvPreview.textContent = 'CSV must have columns for Stripe ID, Date From, and Date To (fuzzy matching failed).';
        // downloadBtn.style.display = 'none';
        csvSpinner.classList.remove('active');
        return;
      }

      //logging for each row
      let progressText = `Processing ${parsedCSV.length} rows...\n`;
      for (let i = 0; i < parsedCSV.length; i++) {
        const row = parsedCSV[i];
        let stripeIdDisplay = row[stripeIdCol] ? row[stripeIdCol] : '(missing Stripe ID)';
        csvPreview.textContent = `${progressText}Row ${i + 1} of ${parsedCSV.length}\nProcessing Stripe ID: ${stripeIdDisplay}`;
        if (!row[stripeIdCol] || !row[dateFromCol] || !row[dateToCol]) {
          row.revenue = 'MISSING_DATA';
        } else if (ipcRenderer) {
          row.revenue = await ipcRenderer.invoke('calculate-revenue', {
            secretKey,
            stripeId: row[stripeIdCol],
            dateFrom: row[dateFromCol],
            dateTo: row[dateToCol]
          });
        } else {
          row.revenue = 'IPC_UNAVAILABLE';
        }
      }

      // Add 'revenue' to columns if not present
      if (!columns.includes('revenue')) columns.push('revenue');


      // Preview first 5 rows of  CSV
      let previewText = 'Updated CSV Preview (first 5 rows):\n';
      previewText += columns.join(',') + '\n';
      parsedCSV.slice(0, 5).forEach(row => {
        previewText += columns.map(col => row[col]).join(',') + '\n';
      });
      csvPreview.textContent = previewText;

      // download
      updatedCSV = Papa.unparse(parsedCSV, { columns });
      downloadBtn.style.display = 'inline-block';
      csvSpinner.classList.remove('active');
    },
    error: function(err) {
      csvPreview.textContent = 'Error parsing CSV: ' + err.message;
      //downloadBtn.style.display = 'none';
      csvSpinner.classList.remove('active');
    }
  });
});

downloadBtn.addEventListener('click', function() {
  if (!updatedCSV) return;
  const blob = new Blob([updatedCSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'updated_revenue.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}); 