const Database = require('better-sqlite3');
(async () => {
  const db = new Database('data/club.db');
  await db.backup('work/pre-release-2026-10-06/club.db');
  db.close();
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
