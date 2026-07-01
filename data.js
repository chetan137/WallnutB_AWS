/**
 * Wallnut — Backend Data (CommonJS)
 * Mirror of frontend/src/data/salesData.js converted for Node.js.
 * Realistic Tally/ERP data for a building materials / construction chemicals company.
 * Multi-state coverage: Kerala, Maharashtra, Karnataka, Madhya Pradesh, Tamil Nadu, Gujarat, Rajasthan
 * ~400+ transactions spanning Apr 2025 – Jun 2025.
 *
 * Field format mirrors the real SALES REGISTER sheet:
 *   Vch No | Date | Vch. Type | Party Name | Item Name | Quantity | Units |
 *   Rate | Amount | Sales Man | Area/City | Stock Group | Stock Category | State
 */

'use strict';

const stateData = {
  Kerala: {
    branch: 'WBKER',
    districts: ['Ernakulam', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'],
    officers: {
      Ernakulam: ['Mr. Nikhil', 'Mr. Debin'],
      Thiruvananthapuram: ['Mr. Arun'],
      Kozhikode: ['Ms. Priya'],
      Thrissur: ['Mr. Sajith'],
    },
    dealers: {
      'Mr. Nikhil': ['TOOLS PARK', 'Einstek Engineering Insulations', 'Kerala Tile House', 'Kochi Building Centre'],
      'Mr. Debin': ['Nexa Tiles', 'Metro Tiles', 'Cochin Hardware Mart'],
      'Mr. Arun': ['TVM Construction Hub', 'Capital Hardware Store', 'Southern Building Materials'],
      'Ms. Priya': ['Malabar Tiles & Sanitary', 'Kozhikode Hardware Depot'],
      'Mr. Sajith': ['Thrissur Building Mart', 'Central Kerala Traders'],
    },
  },
  Maharashtra: {
    branch: 'WBMAH',
    districts: ['Mumbai', 'Pune', 'Kolhapur', 'Nashik'],
    officers: {
      Mumbai: ['Mr. Rohan', 'Mr. Aarav'],
      Pune: ['Mr. Vikrant'],
      Kolhapur: ['Ms. Swati'],
      Nashik: ['Mr. Ganesh'],
    },
    dealers: {
      'Mr. Rohan': ['Mumbai Infra Supplies', 'Dharavi Construction Co.', 'Andheri Hardware House'],
      'Mr. Aarav': ['Western Tiles Gallery', 'Bombay Building Depot'],
      'Mr. Vikrant': ['Pune Construction Centre', 'Shivaji Hardware & Paints', 'Deccan Traders'],
      'Ms. Swati': ['Kolhapur Cement House', 'Mahalaxmi Building Materials'],
      'Mr. Ganesh': ['Nashik Hardware Hub', 'Godavari Construction Supplies'],
    },
  },
  Karnataka: {
    branch: 'WBKAR',
    districts: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli'],
    officers: {
      Bengaluru: ['Mr. Karthik', 'Mr. Venkat'],
      Mysuru: ['Ms. Lakshmi'],
      Mangaluru: ['Mr. Suresh'],
      Hubli: ['Mr. Basavaraj'],
    },
    dealers: {
      'Mr. Karthik': ['Bengaluru Tile World', 'Whitefield Building Supplies', 'Electronic City Hardware'],
      'Mr. Venkat': ['Silicon Valley Construction', 'Jayanagar Infra Mart'],
      'Ms. Lakshmi': ['Royal Mysuru Traders', 'Palace City Hardware'],
      'Mr. Suresh': ['Coastal Hardware Centre', 'Mangalore Tiles Depot'],
      'Mr. Basavaraj': ['Hubli Construction Mart', 'Dharwad Building Materials'],
    },
  },
  'Madhya Pradesh': {
    branch: 'WBSIMK',
    districts: ['Indore', 'Bhopal', 'Jabalpur', 'Ujjain', 'Gwalior'],
    officers: {
      Indore: ['Mr. Rajesh Sharma', 'Mr. Amit Verma'],
      Bhopal: ['Mr. Sunil Patel', 'Mr. Vikram Singh'],
      Jabalpur: ['Mr. Manoj Tiwari', 'Mr. Deepak Jain'],
      Ujjain: ['Mr. Prakash Gupta'],
      Gwalior: ['Mr. Arvind Yadav', 'Ms. Kiran Deshmukh'],
    },
    dealers: {
      'Mr. Rajesh Sharma': ['M/s Shree Cement House', 'Indore Building Center', 'Kumar Hardware & Paints', 'Rajlaxmi Traders'],
      'Mr. Amit Verma': ['City Construction Supplies', 'Maheshwari Building Materials', 'New India Hardware'],
      'Mr. Sunil Patel': ['Bhopal Cement Depot', 'Capital Construction Co.', 'Sharma Building Solutions'],
      'Mr. Vikram Singh': ['Singh Brothers Trading', 'Royal Hardware Store', 'MP Construction Hub'],
      'Mr. Manoj Tiwari': ['Jabalpur Building Mart', 'Narmada Construction Supplies', 'Tiwari & Sons Hardware'],
      'Mr. Deepak Jain': ['Mahakoshal Traders', 'Jain Construction Materials'],
      'Mr. Prakash Gupta': ['Ujjain Hardware Center', 'Mahakal Building Supplies', 'Gupta Trading Co.'],
      'Mr. Arvind Yadav': ['Gwalior Construction Depot', 'Fort City Traders', 'Yadav Building Materials'],
      'Ms. Kiran Deshmukh': ['Chambal Hardware House', 'Scindia Building Supplies'],
    },
  },
  'Tamil Nadu': {
    branch: 'WBTN',
    districts: ['Chennai', 'Coimbatore', 'Madurai'],
    officers: {
      Chennai: ['Mr. Murugan', 'Ms. Divya'],
      Coimbatore: ['Mr. Senthil'],
      Madurai: ['Mr. Pandian'],
    },
    dealers: {
      'Mr. Murugan': ['Chennai Tiles Emporium', 'Adyar Building Hub', 'T Nagar Hardware Store'],
      'Ms. Divya': ['OMR Construction Supplies', 'Porur Infra Mart'],
      'Mr. Senthil': ['Coimbatore Hardware Palace', 'Kongu Traders', 'Tiruppur Building Centre'],
      'Mr. Pandian': ['Madurai Construction Depot', 'Temple City Hardware'],
    },
  },
  Gujarat: {
    branch: 'WBGUJ',
    districts: ['Ahmedabad', 'Surat', 'Vadodara'],
    officers: {
      Ahmedabad: ['Mr. Bharat', 'Mr. Jayesh'],
      Surat: ['Mr. Hitesh'],
      Vadodara: ['Ms. Rinku'],
    },
    dealers: {
      'Mr. Bharat': ['Ahmedabad Building Solutions', 'SG Highway Hardware', 'Sabarmati Traders'],
      'Mr. Jayesh': ['Naroda Construction Hub', 'Gota Tiles Centre'],
      'Mr. Hitesh': ['Surat Diamond Hardware', 'Textile City Construction', 'Varachha Building Mart'],
      'Ms. Rinku': ['Vadodara Infra Hub', 'Alkapuri Tiles & Paints'],
    },
  },
  Rajasthan: {
    branch: 'WBRAJ',
    districts: ['Jaipur', 'Jodhpur', 'Udaipur'],
    officers: {
      Jaipur: ['Mr. Mahendra', 'Mr. Lokesh'],
      Jodhpur: ['Mr. Bhanu'],
      Udaipur: ['Ms. Meera'],
    },
    dealers: {
      'Mr. Mahendra': ['Pink City Hardware', 'Jaipur Royal Traders', 'Malviya Nagar Construction'],
      'Mr. Lokesh': ['Mansarovar Building Centre', 'Tonk Road Hardware'],
      'Mr. Bhanu': ['Jodhpur Blue City Hardware', 'Suncity Construction Supplies'],
      'Ms. Meera': ['Lake City Tiles', 'Udaipur Heritage Building Co.'],
    },
  },
};

const products = [
  { name: 'Calcibond Secure White (20 Kg)-N', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Adhesives', rate: 525, unit: 'Kgs' },
  { name: 'Calcibond Secure Grey (20 Kg)-N', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Adhesives', rate: 480, unit: 'Kgs' },
  { name: 'Wallnut Tile Adhesive (20 Kg)', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Adhesives', rate: 450, unit: 'Kgs' },
  { name: 'Wallnut Wall Putty (40 Kg)-P', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Putty', rate: 680, unit: 'Kgs' },
  { name: 'Wallnut Waterproof Coat (20 L)-W', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Waterproofing', rate: 3200, unit: 'Nos' },
  { name: 'Wallnut Block Jointing Mortar (40 Kg)', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Adhesives', rate: 520, unit: 'Kgs' },
  { name: 'Wallnut Epoxy Grout (1 Kg)-E', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Adhesives', rate: 890, unit: 'Nos' },
  { name: 'Wallnut Crack Fill Paste (1 Kg)', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Repair', rate: 380, unit: 'Nos' },
  { name: 'Wallnut SBR Latex (5 L)-S', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Waterproofing', rate: 1450, unit: 'Nos' },
  { name: 'Wallnut Primer Coat (20 L)-PC', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Primer', rate: 2800, unit: 'Nos' },
  { name: 'Wallnut GP Adhesive (50 Kg)-GP', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Adhesives', rate: 320, unit: 'Kgs' },
  { name: 'Wallnut Heavy Duty Adhesive (20 Kg)-HD', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Adhesives', rate: 580, unit: 'Kgs' },
  { name: 'Wallnut Waterproof Cement (50 Kg)', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Waterproofing', rate: 750, unit: 'Kgs' },
  { name: 'Wallnut Anti-Corrosion Coat (4 L)-AC', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Repair', rate: 1800, unit: 'Nos' },
  { name: 'Wallnut Floor Leveler (25 Kg)-FL', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Putty', rate: 560, unit: 'Kgs' },
  { name: 'Wallnut Bonding Agent (5 L)-BA', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Primer', rate: 1200, unit: 'Nos' },
  { name: 'Wallnut Grout (2 Kg) White-GW', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Adhesives', rate: 240, unit: 'Nos' },
  { name: 'Wallnut Stone Adhesive (25 Kg)-SA', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Adhesives', rate: 720, unit: 'Kgs' },
  { name: 'Wallnut Roof Seal (10 L)-RS', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Waterproofing', rate: 4200, unit: 'Nos' },
  { name: 'Wallnut Plaster Bond (20 L)-PB', stockGroup: 'Finished Goods', stockCategory: 'Finished Goods Primer', rate: 2400, unit: 'Nos' },
];

/** Seeded pseudo-random number generator for reproducibility across frontend/backend */
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateTransactions() {
  const rand = seededRandom(42);
  const transactions = [];
  let vchCounter = 1;

  const months = [
    { year: 2026, month: 3, label: 'Apr' },
    { year: 2026, month: 4, label: 'May' },
    { year: 2026, month: 5, label: 'Jun' },
  ];

  const states = Object.keys(stateData);

  for (const monthInfo of months) {
    const seasonMult = [1.2, 1.1, 0.95][monthInfo.month - 3];

    for (const stateName of states) {
      const stInfo = stateData[stateName];
      const branch = stInfo.branch;
      const stateWeights = {
        Kerala: 1.1, Maharashtra: 1.4, Karnataka: 1.2,
        'Madhya Pradesh': 1.0, 'Tamil Nadu': 1.05, Gujarat: 1.15, Rajasthan: 0.85,
      };
      const stateWeight = stateWeights[stateName] || 1.0;

      for (const district of stInfo.districts) {
        const officers = stInfo.officers[district] || [];
        const districtMult = 0.7 + rand() * 0.6;

        for (const officer of officers) {
          const dealers = stInfo.dealers[officer] || [];

          for (const dealer of dealers) {
            const txnCount = Math.floor(rand() * 3) + 1;

            for (let t = 0; t < txnCount; t++) {
              const product = products[Math.floor(rand() * products.length)];
              const day = (t % 2) + 1; // Alternates between 1 and 2 for Tally Educational Mode compatibility
              const qty = Math.round((Math.floor(rand() * 120) + 10) * districtMult * seasonMult * stateWeight);
              const rate = Math.round(product.rate * (0.92 + rand() * 0.16));
              const amount = qty * rate;

              const outstandingRatio = rand() < 0.15 ? (0.25 + rand() * 0.4) : (rand() * 0.12);
              const outstanding = Math.round(amount * outstandingRatio);

              const dateStr = `${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const vchNoStr = `${branch}-${String(vchCounter).padStart(3, '0')}/26-27`;
              const vchType = rand() < 0.9 ? `Sales - ${district}` : `Credit Note - ${district}`;

              vchCounter++;

              transactions.push({
                vchNo: vchNoStr,
                date: dateStr,
                vchType,
                partyName: dealer,
                itemName: product.name,
                quantity: qty,
                units: product.unit,
                rate,
                amount,
                salesMan: officer,
                areaCity: district,
                stockGroup: product.stockGroup,
                stockCategory: product.stockCategory,
                finalOutstanding: outstanding,
                state: stateName,
              });
            }
          }
        }
      }
    }
  }

  return transactions;
}

const salesData = generateTransactions();

// Extract unique dealers
const _dealerMap = {};
salesData.forEach((r) => {
  if (!_dealerMap[r.partyName]) {
    _dealerMap[r.partyName] = {
      name: r.partyName,
      salesOfficer: r.salesMan,
      district: r.areaCity,
      state: r.state,
    };
  }
});
const allDealers = Object.values(_dealerMap);

// Extract unique officers
const _officerMap = {};
salesData.forEach((r) => {
  if (!_officerMap[r.salesMan]) {
    _officerMap[r.salesMan] = { name: r.salesMan, district: r.areaCity, state: r.state };
  }
});
const allSalesOfficers = Object.values(_officerMap);

// Inventory: aggregate qty & revenue per product
const _inventoryMap = {};
salesData.forEach((r) => {
  const key = r.itemName;
  if (!_inventoryMap[key]) {
    _inventoryMap[key] = {
      itemName: r.itemName,
      stockGroup: r.stockGroup,
      stockCategory: r.stockCategory,
      unit: r.units,
      totalQty: 0,
      totalRevenue: 0,
      txnCount: 0,
    };
  }
  _inventoryMap[key].totalQty += r.quantity;
  _inventoryMap[key].totalRevenue += r.amount;
  _inventoryMap[key].txnCount += 1;
});
const inventorySummary = Object.values(_inventoryMap);

module.exports = { salesData, allDealers, allSalesOfficers, inventorySummary };
