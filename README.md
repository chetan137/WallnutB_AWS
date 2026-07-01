# Wallnut Tally Backend

> Node.js/Express API that bridges **data.js → Tally Prime XML API → React Dashboard**

---

## Architecture

```
data.js  ──►  tallyImportService  ──►  Tally Prime (port 9000)
                                            │
                                     tallyFetchService
                                            │
                                     Express REST APIs
                                            │
                                     React Dashboard
```

## Folder Structure

```
backend/
├── data.js                        ← All 545 transactions (CommonJS mirror of frontend data)
├── server.js                      ← Express app entry point
├── package.json
├── .env                           ← Tally host/port/company config
│
├── config/
│   └── index.js                   ← Centralised config (read from .env)
│
├── routes/
│   └── tally.js                   ← All API route definitions
│
├── controllers/
│   └── tallyController.js         ← Request handlers (thin, delegates to services)
│
├── services/
│   ├── tallyImportService.js      ← Imports vouchers → Tally (batched, duplicate-safe)
│   └── tallyFetchService.js       ← Fetches data from Tally → parses XML → returns JSON
│
├── utils/
│   ├── xmlGenerator.js            ← Builds all Tally XML envelopes
│   └── logger.js                  ← Coloured structured logger
│
└── scripts/
    └── runImport.js               ← CLI tool: node scripts/runImport.js
```

## Quick Start

### 1. Configure Environment

Edit `.env`:

```env
TALLY_HOST=http://localhost
TALLY_PORT=9000
TALLY_COMPANY_NAME=Wallnut Chemicals
PORT=4000
```

### 2. Start Tally Prime
- Open Tally Prime
- Enable the XML server: **F12 → Advanced Configuration → Enable Tally.NET Features**
- Make sure port **9000** is open (or match your `.env`)

### 3. Run the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 4. Import Vouchers into Tally

```bash
# Via CLI script
node scripts/runImport.js

# Via API (POST request)
curl -X POST http://localhost:4000/api/tally/import
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Service info & available endpoints |
| `GET` | `/api/tally/health` | Check if Tally Prime is reachable |
| `POST` | `/api/tally/import` | Import **all** vouchers from data.js |
| `POST` | `/api/tally/import/:vchNo` | Import a single voucher by number |
| `GET` | `/api/tally/sales` | Sales register (with `?from=YYYY-MM-DD&to=YYYY-MM-DD`) |
| `GET` | `/api/tally/dealers` | Dealer list with revenue & outstanding |
| `GET` | `/api/tally/outstanding` | Outstanding receivables per dealer |
| `GET` | `/api/tally/inventory` | Stock summary with qty & value |

### Response Shape

All endpoints return:

```json
{
  "ok": true,
  "data": {
    "source": "tally",   // or "local" when Tally is unavailable
    ...
  }
}
```

### Sales Response Sample

```json
{
  "ok": true,
  "data": {
    "source": "local",
    "totalRevenue": 51449413,
    "totalTransactions": 545,
    "monthly": [
      { "month": "2025-04", "revenue": 18432100, "txnCount": 190, "qty": 14200 }
    ],
    "byState": [
      { "state": "Maharashtra", "revenue": 9812300, "txnCount": 88 }
    ],
    "byOfficer": [...],
    "byProduct": [...],
    "recentVouchers": [...]
  }
}
```

---

## Tally Integration Details

### Import Strategy
- Vouchers sent in **batches of 50** to avoid Tally timeouts
- First attempt: `ACTION="CREATE"`
- On duplicate-voucher error: automatically retries with `ACTION="ALTER"` (updates existing)
- Full import result logged with `imported / duplicates / failed` counts

### Fallback Strategy
When Tally is **unreachable** (not running, wrong port, etc.):
- All fetch endpoints gracefully fall back to **local data.js**
- Response includes `"source": "local"` so the React dashboard can show a badge
- No errors thrown — dashboard always has data

### Tally XML Voucher Format
```xml
<VOUCHER VCHTYPE="Sales" ACTION="CREATE">
  <VOUCHERNUMBER>WBKER-001/25-26</VOUCHERNUMBER>
  <DATE>20250408</DATE>
  <ALLLEDGERENTRIES.LIST>...</ALLLEDGERENTRIES.LIST>
  <ALLINVENTORYENTRIES.LIST>...</ALLINVENTORYENTRIES.LIST>
  <UDF:SALESOFFICER>Mr. Nikhil</UDF:SALESOFFICER>
</VOUCHER>
```

---

## Data Summary (from data.js)

| Metric | Value |
|--------|-------|
| Total Transactions | 545 |
| Total Revenue | ₹5.14 Cr |
| Total Outstanding | ₹61.8 L |
| States | 7 |
| Districts | 25 |
| Sales Officers | 36 |
| Dealers | 92 |
| Products | 20 |
| Period | Apr–Jun 2025 |

---

## React Dashboard Integration

In your React components, call the APIs:

```js
// Fetch sales data
const { data } = await fetch('/api/tally/sales').then(r => r.json());
// data.totalRevenue, data.monthly[], data.byState[], data.byOfficer[]

// Fetch outstanding
const { data } = await fetch('/api/tally/outstanding').then(r => r.json());
// data.totalOutstanding, data.outstanding[]

// Fetch inventory
const { data } = await fetch('/api/tally/inventory').then(r => r.json());
// data.inventory[]

// Trigger import
const result = await fetch('/api/tally/import', { method: 'POST' }).then(r => r.json());
// result.data.imported, result.data.failed
```

Configure Vite proxy in `frontend/vite.config.js`:

```js
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
});
```
