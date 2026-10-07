'use strict';
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('../src/db');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const root = path.resolve(process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups'));
const destination = path.join(root, `fightclub-${stamp}`);

async function main() {
  fs.mkdirSync(destination, { recursive: true });
  await db.backup(path.join(destination, 'club.db'));
  const uploads = path.join(DATA_DIR, 'uploads');
  if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(destination, 'uploads'), { recursive: true });
  console.log(`Backup saved to ${destination}`);
}

main().catch((err) => { console.error('Backup failed:', err.message); process.exitCode = 1; });
