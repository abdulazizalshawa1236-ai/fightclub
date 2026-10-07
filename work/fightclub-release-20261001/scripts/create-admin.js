'use strict';
require('dotenv').config({ quiet: true });
const { db } = require('../src/db');
const { bcrypt } = require('../src/auth');
const [user, pass] = process.argv.slice(2);
if (!user || !pass || pass.length < 12) {
  console.error('Usage: node scripts/create-admin.js <username> <password (12+ chars)>');
  process.exit(1);
}
const hash = bcrypt.hashSync(pass, 11);
const ex = db.prepare('SELECT id FROM admins WHERE username=?').get(user);
if (ex) { db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(hash, ex.id); console.log('Password reset for', user); }
else { db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run(user, hash); console.log('Admin created:', user); }
