// PharmaPro — Fix Admin User (auto-detects column names)
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fix() {
  console.log('Connecting to database...');
  const db = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'pharmapro',
  });
  console.log('✅ Connected');

  // Show actual columns in users table
  const [cols] = await db.query('SHOW COLUMNS FROM users');
  console.log('Users table columns:');
  cols.forEach(c => console.log(' -', c.Field, '|', c.Type));

  // Get super admin role id
  const [[role]] = await db.query("SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1");
  console.log('\nSuper Admin role id:', role.id);

  const hash = await bcrypt.hash('admin123', 10);

  // Find the password column name
  const pwCol = cols.find(c =>
    c.Field.toLowerCase().includes('pass') ||
    c.Field.toLowerCase() === 'pwd' ||
    c.Field.toLowerCase() === 'hash'
  );

  if (!pwCol) {
    console.log('Cannot find password column. All columns:', cols.map(c=>c.Field).join(', '));
    await db.end();
    return;
  }

  console.log('\nPassword column:', pwCol.Field);

  // Delete existing admin
  await db.query("DELETE FROM users WHERE email = 'admin@pharmapro.local'");

  // Insert new admin
  const sql = `INSERT INTO users (name, email, ${pwCol.Field}, role_id, status) VALUES (?, ?, ?, ?, ?)`;
  await db.query(sql, ['System Admin', 'admin@pharmapro.local', hash, role.id, 'active']);

  console.log('\n✅ Admin user created!');
  console.log('   Email:    admin@pharmapro.local');
  console.log('   Password: admin123');
  await db.end();
}

fix().catch(err => { console.error('Error:', err.message); process.exit(1); });
