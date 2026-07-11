const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.join(__dirname, '..', 'test_files', 'property4.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const dom = new JSDOM(html);
const window = dom.window;
const document = window.document;

// Reuse the extraction logic from content.js (simplified)
const data = {};

data['URL'] = 'file://' + htmlPath;

// 8. Extract Building Name from list items (robust)
let buildingName = "";
const listItems = document.querySelectorAll('li');
for (const li of listItems) {
  const text = li.textContent || '';
  const m = text.match(/building\s*name\s*[:\-]\s*(.+)/i);
  if (m && m[1]) {
    buildingName = m[1].trim();
    break;
  }
}

if (buildingName) {
  data['Building Name'] = buildingName;
  data['Listing Name'] = data['Listing Name'] || buildingName;
  data['Property Name'] = data['Property Name'] || buildingName;
}

console.log('Extracted buildingName:', JSON.stringify(buildingName));
console.log('Data keys:', Object.keys(data));

if (!buildingName) process.exitCode = 2; else process.exitCode = 0;