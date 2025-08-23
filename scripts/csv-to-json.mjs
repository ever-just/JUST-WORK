import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const inputPath = path.join('public', 'ForMinnesotacompanies.org $10M + 10+ ppl + MN Only.csv');
const outputPath = path.join('public', 'companies.json');

const csv = fs.readFileSync(inputPath, 'utf8');
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

const unique = new Map();
for (const row of parsed.data) {
  const key = row['Company Name'];
  if (key && !unique.has(key)) {
    unique.set(key, row);
  }
}

const records = Array.from(unique.values());
fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));
console.log(`Converted ${parsed.data.length} rows -> ${records.length} unique records`);
