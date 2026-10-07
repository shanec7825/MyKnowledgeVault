// Inspect the qmd search index: which vault files are actually indexed?
const path = require('path');
const NM = process.argv[2];           // .vault-meta/search/node_modules
const DB = process.argv[3];           // .qmd/index.sqlite
const Database = require(path.join(NM, 'better-sqlite3'));
const db = new Database(DB, { readonly: true, fileMustExist: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
console.log('tables: ' + tables.join(', '));

for (const t of tables) {
  try {
    const n = db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get().c;
    console.log(`  ${t}: ${n} rows`);
  } catch (e) { console.log(`  ${t}: (${e.message})`); }
}

// Heuristic: find a column holding file paths
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t}")`).all().map(c => c.name);
  const pathCol = cols.find(c => /path|file|source|uri|key/i.test(c));
  if (!pathCol) continue;
  try {
    const rows = db.prepare(`SELECT "${pathCol}" v FROM "${t}" LIMIT 5000`).all();
    const vals = rows.map(r => String(r.v)).filter(Boolean);
    if (!vals.length) continue;
    const top = {};
    for (const v of vals) {
      const norm = v.replace(/\\/g, '/').replace(/^.*?MyKnowledgeVault\//i, '');
      const seg = norm.split('/')[0];
      top[seg] = (top[seg] || 0) + 1;
    }
    console.log(`\n== ${t}.${pathCol}: ${vals.length} values, top-level coverage ==`);
    Object.entries(top).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(4)}  ${k}`));
    console.log('   sample: ' + vals.slice(0, 3).join(' | '));
  } catch (e) { /* column not usable */ }
}
db.close();
