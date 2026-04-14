const fs = require('fs');
const path = require('path');
const p = process.argv[2] || path.join(process.env.TEMP || '/tmp', 'mebbis-kurum.html');
if (!fs.existsSync(p)) {
  console.log('[]');
  process.exit(0);
}
const html = fs.readFileSync(p, 'utf8');
const i = html.indexOf("ASPx.createControl(ASPxClientListBox,'cmbil_DDD_L'");
const chunk = html.slice(i, i + 25000);
const re = /\{'value':'([^']+)','text':'([^']+)'\}/g;
const items = [];
let m;
while ((m = re.exec(chunk))) items.push({ value: m[1], label: m[2] });
console.log(JSON.stringify(items, null, 2));
