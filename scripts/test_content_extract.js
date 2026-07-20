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

// 8. Extract Building Name and Neighbourhood from list items
let buildingName = "";
let neighbourhood = "";
const buildingInformation = document.getElementById('building-information');
const listItems = buildingInformation
  ? buildingInformation.querySelectorAll('li')
  : document.querySelectorAll('li');
for (const li of listItems) {
  const text = li.textContent || '';
  if (!buildingName) {
    const buildingMatch = text.match(/building\s*name\s*[:\-]\s*(.+)/i);
    if (buildingMatch && buildingMatch[1]) {
      buildingName = buildingMatch[1].trim();
    }
  }
  if (!neighbourhood) {
    const neighbourhoodMatch = text.match(/neighbourhood\s*[:\-]\s*(.+)/i);
    if (neighbourhoodMatch && neighbourhoodMatch[1]) {
      neighbourhood = neighbourhoodMatch[1].trim();
    }
  }
  if (buildingName && neighbourhood) {
    break;
  }
}

if (buildingName) {
  data['Building Name'] = buildingName;
  data['Listing Name'] = data['Listing Name'] || buildingName;
  data['Property Name'] = data['Property Name'] || buildingName;
}
if (neighbourhood) data['Neighbourhood'] = neighbourhood;

console.log('Extracted buildingName:', JSON.stringify(buildingName));
console.log('Extracted neighbourhood:', JSON.stringify(neighbourhood));
console.log('Data keys:', Object.keys(data));

if (!buildingName || !neighbourhood) process.exitCode = 2; else process.exitCode = 0;