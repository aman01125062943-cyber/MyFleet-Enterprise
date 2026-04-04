const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'تصميم تطبيقات ويب', 'مدير الاسطول', 'MyFleet-Enterprise-main', 'components', 'Inventory.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix 'any' in filteredHist
content = content.replace(/filteredHist\.filter\(\(t: any\) => t\.type === 'income'\)\.reduce\(\(sum: number, t: any\) =>/g, "filteredHist.filter((t: Transaction) => t.type === 'income').reduce((sum: number, t: Transaction) =>");
content = content.replace(/filteredHist\.filter\(\(t: any\) => t\.type === 'expense'\)\.reduce\(\(sum: number, t: any\) =>/g, "filteredHist.filter((t: Transaction) => t.type === 'expense').reduce((sum: number, t: Transaction) =>");

// 2. Fix @ts-ignore to @ts-expect-error
content = content.replace(/\/\/ @ts-ignore/g, "// @ts-expect-error");

// 3. Fix Nullish Coalescing (Line 1319)
content = content.replace(/newTx\.car_id \? cars\.find\(c => c\.id === newTx\.car_id\)\.name : 'اختيار سيارة'/g, "cars.find(c => c.id === newTx.car_id)?.name ?? 'اختيار سيارة'");

fs.writeFileSync(filePath, content);
console.log('Successfully updated Inventory.tsx');
