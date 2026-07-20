const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'test_files', 'property4.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function extractBuildingName(html) {
  // Try several heuristics to match the examples in the screenshot and sample file
  let m;
  // 1) Plain text like: Building Name: Grand Central 2
  m = html.match(/Building Name\s*:\s*([^<>\n\r]+)/i);
  if (m && m[1]) return m[1].trim();
  // 2) Inside an li element: <li>Building Name: Grand Central 2</li>
  m = html.match(/<li[^>]*>\s*Building Name\s*:\s*([^<]+)<\/li>/i);
  if (m && m[1]) return m[1].trim();
  // 3) Look for other keys like "Property Name" or "Listing Name"
  m = html.match(/Property Name\s*:\s*([^<>\n\r]+)/i);
  if (m && m[1]) return m[1].trim();
  m = html.match(/Listing Name\s*:\s*([^<>\n\r]+)/i);
  if (m && m[1]) return m[1].trim();
  // 4) Fallback: try to extract any heading or strong text nearby "Building"
  m = html.match(/Building[^<]{0,40}([A-Z][A-Za-z0-9\-\s]{2,60})/i);
  if (m && m[1]) return m[1].trim();
  return '';
}

function extractMLS(html) {
  // MLS format like R3065176
  const m = html.match(/\bR\d{5,7}\b/i);
  return m ? m[0].toUpperCase() : '';
}

function normalizeMLS(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Simulated incoming data payload that the extension would post
const buildingName = extractBuildingName(html);
const mlsRaw = extractMLS(html);
const data = {
  'Building Name': buildingName,
  'MLS': mlsRaw,
  'Year Built': '2009',
  'Address': '2978 Glen Drive, Coquitlam',
  'Bedrooms': '2',
  'Bathrooms': '2'
};

console.log('Extracted from HTML:');
console.log('  Building Name:', JSON.stringify(buildingName));
console.log('  MLS raw:', JSON.stringify(mlsRaw));

// Translate Apps Script dedupe+append logic to JS and run against an in-memory sheet
const sheet2 = {
  header: ["Property Name", "Neighbourhood", "MLS®", "Age", "Address", "Beds", "Baths", "SqFt", "Price", "2026 Assessment", "Price/SqFt", "Maintenace", "Maintenace per SQFT", "Est. Monthly Cost", "Est. Monthly Rent", "Monthly Cash Flow", "Link/Notes"],
  rows: [
    // Simulate an older export where MLS was in column B, before Neighbourhood was inserted.
    ["Some Building", mlsRaw, "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
  ]
};

let mlsToCheck = normalizeMLS(data['MLS'] || '');
let duplicateFound = false;
let foundRowIndex = -1;
if (mlsToCheck) {
  for (let i = 0; i < sheet2.rows.length; i++) {
    const duplicateColumn = sheet2.rows[i].findIndex(cell => normalizeMLS(cell) === mlsToCheck);
    if (duplicateColumn !== -1) {
      duplicateFound = true;
      foundRowIndex = i + 2; // account for header (1-based)
      break;
    }
  }
}

if (duplicateFound) {
  console.log('\nDuplicate detected for MLS', mlsToCheck, 'at row', foundRowIndex);
} else {
  const nextRow = sheet2.rows.length + 2; // header row is 1
  const cashFlowFormula = `=N${nextRow}-M${nextRow}`;
  const rowData = [
    data['Building Name'] || '',
    mlsToCheck || (data['MLS'] || ''),
    data['Year Built'] || '',
    data['Address'] || '',
    data['Bedrooms'] || '',
    data['Bathrooms'] || '',
    data['Square Feet'] || data['Floor Area'] || '',
    data['Asking Price'] || data['Price'] || '',
    data['Assessed Value (2026)'] || '',
    data['Price per Floor SqFt'] || '',
    data['Maintenance Fee'] || '',
    data['Maint. Fee per SqFt'] || '',
    data['First Mortgage Payment'] || '',
    data['OfferRent Estimate'] || '',
    cashFlowFormula,
    data['URL'] || ''
  ];
  sheet2.rows.push(rowData);
  console.log('\nAppended rowData:');
  console.log(rowData);
}

// Also show all-params behavior (minimal)
console.log('\nSample "all-params" row (keys present in data):');
const allParamsRow = {};
Object.keys(data).forEach(k => allParamsRow[k] = data[k]);
allParamsRow['MLS_normalized'] = mlsToCheck;
console.log(allParamsRow);

// Exit with non-zero if buildingName empty to surface failing capture
if (!buildingName || !duplicateFound) {
  console.error('\nERROR: Building name not found by heuristic.');
  process.exitCode = 2;
} else {
  console.log('\nOK: Building name captured and duplicate detected.');
}
