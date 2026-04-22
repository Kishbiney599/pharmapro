require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'pharmapro_secret';

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// ─── Auth Middleware ──────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Admin-only middleware ─────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const role = (req.user.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'super admin') {
    return res.status(403).json({ error: 'Admin access required to reverse transactions' });
  }
  next();
};


// ══════════════════════════════════════════════════════════════
//  BULK IMPORT DRUGS (CSV / Excel via JSON rows)
// ══════════════════════════════════════════════════════════════
app.post('/api/drugs/bulk-import', auth, async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'No rows provided' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const results = { success: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // row 2 = first data row (row 1 = header)

      // Required fields check
      const name = (row.name || row.Name || row['Drug Name'] || '').toString().trim();
      const price = parseFloat(row.price || row.Price || row['Unit Price'] || 0);
      const quantity = parseInt(row.quantity || row.Quantity || row['Quantity'] || 0, 10);
      const expiry_date = (row.expiry_date || row['Expiry Date'] || row.expiry || '').toString().trim();

      if (!name) { results.errors.push({ row: rowNum, error: 'Drug name is required' }); results.skipped++; continue; }
      if (!price || price <= 0) { results.errors.push({ row: rowNum, drug: name, error: 'Valid price is required' }); results.skipped++; continue; }
      if (!quantity || quantity <= 0) { results.errors.push({ row: rowNum, drug: name, error: 'Valid quantity is required' }); results.skipped++; continue; }
      if (!expiry_date) { results.errors.push({ row: rowNum, drug: name, error: 'Expiry date is required' }); results.skipped++; continue; }

      // Optional fields
      const category       = (row.category || row.Category || 'Other').toString().trim();
      const unit           = (row.unit || row.Unit || 'Tabs').toString().trim();
      const reorder_level  = parseInt(row.reorder_level || row['Reorder Level'] || 50, 10);
      const barcode        = (row.barcode || row.Barcode || '').toString().trim() || null;
      const batch_number   = (row.batch_number || row['Batch Number'] || '').toString().trim() || null;
      const purchase_price = parseFloat(row.purchase_price || row['Purchase Price'] || 0) || null;

      // Resolve supplier name to ID if provided
      let supplier_id = null;
      const supplier_name = (row.supplier || row.Supplier || row['Supplier Name'] || '').toString().trim();
      if (supplier_name) {
        const [sup] = await conn.query('SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)', [supplier_name]);
        if (sup.length) supplier_id = sup[0].id;
      }

      // Check if drug with same name already exists
      const [existing] = await conn.query('SELECT id FROM drugs WHERE LOWER(name) = LOWER(?)', [name]);

      let drugId;
      if (existing.length) {
        // Update price & reorder level on existing drug
        await conn.query(
          'UPDATE drugs SET price = ?, reorder_level = ?, category = ?, unit = ?, supplier_id = COALESCE(?, supplier_id) WHERE id = ?',
          [price, reorder_level, category, unit, supplier_id, existing[0].id]
        );
        drugId = existing[0].id;
      } else {
        // Insert new drug
        const [drugResult] = await conn.query(
          'INSERT INTO drugs (name, category, unit, price, reorder_level, barcode, supplier_id) VALUES (?,?,?,?,?,?,?)',
          [name, category, unit, price, reorder_level, barcode, supplier_id]
        );
        drugId = drugResult.insertId;
      }

      // Always add a new batch for the stock
      const [batchResult] = await conn.query(
        'INSERT INTO drug_batches (drug_id, batch_number, quantity, expiry_date, purchase_price) VALUES (?,?,?,?,?)',
        [drugId, batch_number, quantity, expiry_date, purchase_price]
      );

      // Log stock movement
      await conn.query(
        'INSERT INTO stock_movements (drug_id, batch_id, movement_type, quantity, reason, user_id) VALUES (?,?,?,?,?,?)',
        [drugId, batchResult.insertId, 'in', quantity, 'Bulk import', req.user.id]
      );

      results.success++;
    }

    await conn.commit();
    await logActivity(req, 'BULK_IMPORT', 'Inventory', `Imported ${results.success} drugs, skipped ${results.skipped}`);
    res.json({
      success: true,
      message: `Import complete: ${results.success} items imported, ${results.skipped} skipped`,
      ...results
    });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});


// ══════════════════════════════════════════════════════════════
//  ACTIVITY LOGGING HELPER
// ══════════════════════════════════════════════════════════════
async function logActivity(req, action, module, description) {
  try {
    const userId   = req?.user?.id   || null;
    const userName = req?.user?.name || 'System';
    const userRole = req?.user?.role || '';
    const ip = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '';
    await db.query(
      'INSERT INTO activity_logs (user_id, user_name, user_role, action, module, description, ip_address) VALUES (?,?,?,?,?,?,?)',
      [userId, userName, userRole, action, module, description, ip]
    );
  } catch(e) { /* silent — never block the main request */ }
}

// GET activity logs (admin only)
app.get('/api/activity-logs', auth, adminOnly, async (req, res) => {
  try {
    const { limit = 100, user_id, action, date_from, date_to } = req.query;
    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];
    if (user_id)   { query += ' AND user_id = ?';                   params.push(user_id); }
    if (action)    { query += ' AND action = ?';                     params.push(action); }
    if (date_from) { query += ' AND DATE(created_at) >= ?';          params.push(date_from); }
    if (date_to)   { query += ' AND DATE(created_at) <= ?';          params.push(date_to); }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit));
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET distinct users who have activity (for filter dropdown)
app.get('/api/activity-logs/users', auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT DISTINCT user_id, user_name, user_role FROM activity_logs WHERE user_id IS NOT NULL ORDER BY user_name'
    );
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


// ══════════════════════════════════════════════════════════════
//  ACTIVATION / LICENSING SYSTEM v2
//  Branch-specific, single-use monthly codes
// ══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const LICENSE_SECRET = 'PHARMAPRO_LICENSE_ENGINE_V2_XK9Z_2024_SECRET';

// Check activation status — no auth needed
app.get('/api/activation/status', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM pharmacy_settings WHERE id = 1');
    if (!rows.length) return res.json({ activated: false });
    const s = rows[0];
    if (!s.activation_code) return res.json({ activated: false });

    // Check expiry — stored as YYYY-MM period
    const period  = s.activation_period || '';
    if (!period) return res.json({ activated: false });

    const now   = new Date();
    const y     = now.getFullYear();
    const m     = now.getMonth() + 1;
    const curP  = `${y}-${String(m).padStart(2,'0')}`;
    const prev  = new Date(y, m-2, 1);
    const prevP = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
    const grace = now.getDate() <= 5;

    const valid = period === curP || (grace && period === prevP);
    const expires = new Date(y, m, 0).toISOString().slice(0,10);

    res.json({
      activated: valid,
      expires:   valid ? expires : null,
      grace:     grace && period === prevP,
      branch:    s.branch_name || '',
      period,
    });
  } catch(e) { res.json({ activated: false }); }
});

// Activate with a branch-specific code
app.post('/api/activation/activate', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Activation code is required' });
  const clean = code.toUpperCase().trim();

  try {
    // Add columns if missing
    try { await db.query('ALTER TABLE pharmacy_settings ADD COLUMN activation_code VARCHAR(30) DEFAULT NULL'); } catch(e){}
    try { await db.query('ALTER TABLE pharmacy_settings ADD COLUMN activation_period VARCHAR(10) DEFAULT NULL'); } catch(e){}
    try { await db.query('ALTER TABLE pharmacy_settings ADD COLUMN activated_at DATETIME DEFAULT NULL'); } catch(e){}
    try { await db.query('ALTER TABLE pharmacy_settings ADD COLUMN branch_name VARCHAR(200) DEFAULT NULL'); } catch(e){}

    // Get current settings to find branch name
    const [rows] = await db.query('SELECT * FROM pharmacy_settings WHERE id = 1');
    const branchName = rows[0]?.branch_name || rows[0]?.pharmacy_name || '';

    // Validate the code period (first segment = period hash)
    const now    = new Date();
    const y      = now.getFullYear();
    const m      = now.getMonth() + 1;
    const mm     = String(m).padStart(2,'0');
    const curP   = `${y}-${mm}`;
    const prev   = new Date(y, m-2, 1);
    const prevP  = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
    const grace  = now.getDate() <= 5;

    // Check code segment against current and previous month
    const seg1Cur  = crypto.createHash('sha256').update(curP).digest('hex').toUpperCase().slice(0,6);
    const seg1Prev = crypto.createHash('sha256').update(prevP).digest('hex').toUpperCase().slice(0,6);
    const codeSeg1 = clean.split('-')[0] || '';

    let validPeriod = null;
    if (codeSeg1 === seg1Cur)  validPeriod = curP;
    else if (grace && codeSeg1 === seg1Prev) validPeriod = prevP;

    if (!validPeriod) {
      return res.status(400).json({
        error: 'Invalid or expired activation code.',
        hint:  'Codes are only valid for one calendar month. Contact your administrator for a new code.',
      });
    }

    // Check code is not already used (compare against stored code for this period)
    if (rows[0]?.activation_code === clean && rows[0]?.activation_period === validPeriod) {
      // Same code re-entered — already activated, just confirm
      return res.json({
        success: true,
        message: 'App is already activated with this code.',
        expires: new Date(y, m, 0).toISOString().slice(0,10),
        grace:   grace && validPeriod === prevP,
      });
    }

    // Save the activation
    await db.query(
      'UPDATE pharmacy_settings SET activation_code = ?, activation_period = ?, activated_at = NOW() WHERE id = 1',
      [clean, validPeriod]
    );

    const expires = new Date(y, m, 0).toISOString().slice(0,10);
    res.json({
      success: true,
      message: `App activated successfully${grace && validPeriod === prevP ? ' (grace period)' : ''}!`,
      expires,
      grace: grace && validPeriod === prevP,
    });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// Set branch name (called from settings)
app.post('/api/activation/set-branch', auth, adminOnly, async (req, res) => {
  const { branch_name } = req.body;
  try {
    try { await db.query('ALTER TABLE pharmacy_settings ADD COLUMN branch_name VARCHAR(200) DEFAULT NULL'); } catch(e){}
    await db.query('UPDATE pharmacy_settings SET branch_name = ? WHERE id = 1', [branch_name || '']);
    res.json({ success: true });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


// ══════════════════════════════════════════════════════════════
//  BACKUP & RESTORE SYSTEM
// ══════════════════════════════════════════════════════════════
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// Backup directory — inside user's documents folder
const BACKUP_DIR = path.join(os.homedir(), 'PharmaPro Backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

// Export all tables to a JSON backup object
async function createBackupData() {
  const tables = [
    'users', 'roles', 'drugs', 'drug_batches', 'stock_movements',
    'suppliers', 'sales', 'sale_items', 'pharmacy_settings', 'activity_logs',
  ];

  const backup = {
    version:    '2.0',
    created_at: new Date().toISOString(),
    pharmacy:   process.env.PHARMACY_NAME || 'PharmaPro Enterprise',
    tables:     {},
  };

  for (const table of tables) {
    try {
      const [rows] = await db.query(`SELECT * FROM ${table}`);
      backup.tables[table] = rows;
    } catch(e) {
      backup.tables[table] = []; // table may not exist yet
    }
  }

  backup.row_counts = {};
  for (const [t, rows] of Object.entries(backup.tables)) {
    backup.row_counts[t] = rows.length;
  }

  return backup;
}

// GET backup status and list of saved backups
app.get('/api/backup/list', auth, adminOnly, (req, res) => {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.pharmabackup'))
      .map(f => {
        const full = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(full);
        return {
          filename: f,
          path:     full,
          size:     stat.size,
          created:  stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json({ backups: files, backup_dir: BACKUP_DIR });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// POST create a manual backup
app.post('/api/backup/create', auth, adminOnly, async (req, res) => {
  try {
    ensureBackupDir();
    const data     = await createBackupData();
    const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const pharmKey = (process.env.PHARMACY_NAME || 'PharmaPro').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${pharmKey}_${ts}.pharmabackup`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    await logActivity(req, 'BACKUP_CREATED', 'Backup', `Manual backup created: ${filename}`);

    res.json({
      success:   true,
      filename,
      filepath,
      size:      fs.statSync(filepath).size,
      row_counts: data.row_counts,
    });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET download a specific backup file
app.get('/api/backup/download/:filename', auth, adminOnly, (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // sanitize
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath))
      return res.status(404).json({ error: 'Backup file not found' });
    res.download(filepath, filename);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// DELETE a backup file
app.delete('/api/backup/:filename', auth, adminOnly, (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath))
      return res.status(404).json({ error: 'Backup file not found' });
    fs.unlinkSync(filepath);
    res.json({ success: true });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// POST restore from uploaded backup JSON
app.post('/api/backup/restore', auth, adminOnly, async (req, res) => {
  const { backup_data } = req.body;
  if (!backup_data || !backup_data.tables)
    return res.status(400).json({ error: 'Invalid backup data' });
  if (!backup_data.version)
    return res.status(400).json({ error: 'Unrecognised backup format' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Restore order matters — respect foreign keys
    const ORDER = [
      'roles', 'suppliers', 'users',
      'drugs', 'drug_batches', 'stock_movements',
      'sales', 'sale_items',
      'pharmacy_settings', 'activity_logs',
    ];

    const stats = {};

    // Disable FK checks during restore
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of ORDER) {
      const rows = backup_data.tables[table];
      if (!rows || !rows.length) { stats[table] = 0; continue; }

      // Clear existing data
      await conn.query(`DELETE FROM ${table}`);

      // Re-insert all rows
      const cols = Object.keys(rows[0]);
      const placeholders = `(${cols.map(() => '?').join(',')})`;

      // Convert ISO datetime strings to MySQL format
      const fixDt = (v) => {
        if (!v || typeof v !== 'string') return v;
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v))
          return v.replace('T', ' ').replace(/\.\d{3}Z?$/, '').replace('Z', '');
        return v;
      };

      for (const row of rows) {
        const vals = cols.map(c => {
          const v = row[c];
          if (v === undefined || v === null) return null;
          return fixDt(v);
        });
        await conn.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders}`, vals);
      }
      stats[table] = rows.length;
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();

    await logActivity(req, 'BACKUP_RESTORED', 'Backup', `Database restored from backup v${backup_data.version} created ${backup_data.created_at}`);

    res.json({ success: true, message: 'Database restored successfully.', stats });
  } catch(e) {
    await conn.rollback();
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(()=>{});
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// GET auto-backup settings
app.get('/api/backup/auto-status', auth, adminOnly, (req, res) => {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.includes('_AUTO_') && f.endsWith('.pharmabackup'));
    const last = files.sort().reverse()[0] || null;
    res.json({
      enabled:    true,
      interval:   'daily',
      backup_dir: BACKUP_DIR,
      last_auto:  last,
    });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// ── Auto-backup scheduler (runs daily at 2 AM) ────────────────
async function runAutoBackup() {
  try {
    ensureBackupDir();
    const data     = await createBackupData();
    const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const pharmKey = (process.env.PHARMACY_NAME || 'PharmaPro').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${pharmKey}_AUTO_${ts}.pharmabackup`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Auto-backup saved: ${filename}`);

    // Keep only last 30 auto-backups to save disk space
    const autoFiles = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.includes('_AUTO_') && f.endsWith('.pharmabackup'))
      .sort().reverse();
    autoFiles.slice(30).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch(e) {}
    });
  } catch(e) {
    console.error('❌ Auto-backup failed:', e.message);
  }
}

// Schedule: run at next 2 AM, then every 24 hours
function scheduleAutoBackup() {
  const now       = new Date();
  const next2AM   = new Date(now);
  next2AM.setHours(2, 0, 0, 0);
  if (next2AM <= now) next2AM.setDate(next2AM.getDate() + 1);
  const msToNext2AM = next2AM - now;
  console.log(`⏰ Auto-backup scheduled at: ${next2AM.toLocaleString()}`);
  setTimeout(() => {
    runAutoBackup();
    setInterval(runAutoBackup, 24 * 60 * 60 * 1000); // every 24h
  }, msToNext2AM);
}


// ══════════════════════════════════════════════════════════════
//  PASSWORD MANAGEMENT
// ══════════════════════════════════════════════════════════════

// POST change own password (any logged-in user)
app.post('/api/auth/change-password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Current and new password are required' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    await logActivity(req, 'PASSWORD_CHANGED', 'Auth', `${req.user.name} changed their password`);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// POST admin resets another user's password
app.post('/api/users/:id/reset-password', auth, adminOnly, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password)
    return res.status(400).json({ error: 'New password is required' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    await logActivity(req, 'PASSWORD_RESET', 'Staff', `Admin ${req.user.name} reset password for ${rows[0].name}`);
    res.json({ success: true, message: `Password reset for ${rows[0].name}` });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


// ══════════════════════════════════════════════════════════════
//  USER PERMISSIONS
// ══════════════════════════════════════════════════════════════

// GET permissions for a user
app.get('/api/users/:id/permissions', auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT page FROM user_permissions WHERE user_id = ?', [req.params.id]);
    res.json({ permissions: rows.map(r => r.page) });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// PUT set permissions for a user (replaces all existing)
app.put('/api/users/:id/permissions', auth, adminOnly, async (req, res) => {
  const { pages } = req.body; // array of page ids
  if (!Array.isArray(pages)) return res.status(400).json({ error: 'pages must be an array' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [req.params.id]);
    if (pages.length > 0) {
      const vals = pages.map(p => [req.params.id, p]);
      await conn.query('INSERT INTO user_permissions (user_id, page) VALUES ?', [vals]);
    }
    await conn.commit();
    const [user] = await db.query('SELECT name FROM users WHERE id = ?', [req.params.id]);
    await logActivity(req, 'PERMISSIONS_UPDATED', 'Staff',
      `Permissions updated for ${user[0]?.name}: [${pages.join(', ')}]`);
    res.json({ success: true, permissions: pages });
  } catch(e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// GET all staff WITH their permissions (for staff management page)
app.get('/api/staff/with-permissions', auth, adminOnly, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT u.id, u.name, u.email, u.shift, u.status, u.last_login, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.name'
    );
    const [perms] = await db.query('SELECT user_id, page FROM user_permissions');
    // Group permissions by user
    const permMap = {};
    perms.forEach(p => {
      if (!permMap[p.user_id]) permMap[p.user_id] = [];
      permMap[p.user_id].push(p.page);
    });
    const result = users.map(u => ({ ...u, permissions: permMap[u.id] || [] }));
    res.json(result);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


// ══════════════════════════════════════════════════════════════
//  STOCK ADJUSTMENT
// ══════════════════════════════════════════════════════════════

// Adjustment types and their effect on stock
// add_stock     → +qty  (new delivery received)
// write_off     → -qty  (damaged / expired / lost)
// stock_count   → set to exact qty (manual count correction)
// transfer_in   → +qty  (received from another branch)
// transfer_out  → -qty  (sent to another branch)

// GET all drugs with batches for adjustment picker
app.get('/api/stock/adjustment/drugs', auth, async (req, res) => {
  try {
    const [drugs] = await db.query(`
      SELECT d.id, d.name, d.unit, d.category,
             COALESCE(SUM(b.quantity),0) AS total_stock
      FROM drugs d
      LEFT JOIN drug_batches b ON b.drug_id = d.id
      GROUP BY d.id ORDER BY d.name
    `);
    res.json(drugs);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET batches for a specific drug (for batch-level adjustments)
app.get('/api/stock/adjustment/batches/:drug_id', auth, async (req, res) => {
  try {
    const [batches] = await db.query(`
      SELECT id, batch_number, quantity, expiry_date, purchase_price
      FROM drug_batches
      WHERE drug_id = ? AND quantity > 0
      ORDER BY expiry_date ASC
    `, [req.params.drug_id]);
    res.json(batches);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// POST perform a stock adjustment
app.post('/api/stock/adjust', auth, async (req, res) => {
  const { drug_id, batch_id, adjustment_type, quantity, reason, notes } = req.body;

  if (!drug_id)          return res.status(400).json({ error: 'Drug is required' });
  if (!adjustment_type)  return res.status(400).json({ error: 'Adjustment type is required' });
  if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' });
  if (!reason)           return res.status(400).json({ error: 'Reason is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Get drug info
    const [[drug]] = await conn.query('SELECT * FROM drugs WHERE id = ?', [drug_id]);
    if (!drug) { await conn.rollback(); return res.status(404).json({ error: 'Drug not found' }); }

    let batchIdUsed = batch_id || null;
    let movementType = 'in';
    let newQty = null;

    if (adjustment_type === 'add_stock') {
      // Add to existing batch or create a new one
      movementType = 'in';
      if (batch_id) {
        await conn.query('UPDATE drug_batches SET quantity = quantity + ? WHERE id = ?', [quantity, batch_id]);
      } else {
        // Create a new batch with no expiry (open delivery)
        const [b] = await conn.query(
          'INSERT INTO drug_batches (drug_id, quantity, batch_number, expiry_date) VALUES (?,?,?,NULL)',
          [drug_id, quantity, `ADJ-${Date.now()}`]
        );
        batchIdUsed = b.insertId;
      }
    }
    else if (adjustment_type === 'write_off') {
      movementType = 'out';
      if (batch_id) {
        // Write off from specific batch
        const [[batch]] = await conn.query('SELECT quantity FROM drug_batches WHERE id = ?', [batch_id]);
        if (!batch) { await conn.rollback(); return res.status(404).json({ error: 'Batch not found' }); }
        if (quantity > batch.quantity)
          { await conn.rollback(); return res.status(400).json({ error: `Cannot write off more than available stock (${batch.quantity} units)` }); }
        await conn.query('UPDATE drug_batches SET quantity = quantity - ? WHERE id = ?', [quantity, batch_id]);
      } else {
        // Write off from total stock (FIFO — oldest batch first)
        const [batches] = await conn.query(
          'SELECT * FROM drug_batches WHERE drug_id = ? AND quantity > 0 ORDER BY expiry_date ASC, id ASC',
          [drug_id]
        );
        let remaining = quantity;
        const [[total]] = await conn.query(
          'SELECT COALESCE(SUM(quantity),0) AS total FROM drug_batches WHERE drug_id = ?', [drug_id]
        );
        if (quantity > total.total)
          { await conn.rollback(); return res.status(400).json({ error: `Cannot write off more than total stock (${total.total} units)` }); }
        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduct = Math.min(remaining, batch.quantity);
          await conn.query('UPDATE drug_batches SET quantity = quantity - ? WHERE id = ?', [deduct, batch.id]);
          remaining -= deduct;
        }
        batchIdUsed = null;
      }
    }
    else if (adjustment_type === 'stock_count') {
      // Set exact quantity (stock count correction)
      movementType = 'adjustment';
      if (!batch_id) { await conn.rollback(); return res.status(400).json({ error: 'A batch must be selected for stock count correction' }); }
      const [[batch]] = await conn.query('SELECT quantity FROM drug_batches WHERE id = ?', [batch_id]);
      if (!batch) { await conn.rollback(); return res.status(404).json({ error: 'Batch not found' }); }
      const diff = quantity - batch.quantity;
      newQty = quantity;
      movementType = diff >= 0 ? 'in' : 'out';
      await conn.query('UPDATE drug_batches SET quantity = ? WHERE id = ?', [quantity, batch_id]);
      // Override quantity for movement log to show actual change
      const absChange = Math.abs(diff);
      await conn.query(
        'INSERT INTO stock_movements (drug_id, batch_id, movement_type, quantity, reason, user_id) VALUES (?,?,?,?,?,?)',
        [drug_id, batchIdUsed, movementType, absChange, `Stock Count: ${reason}${notes ? ' — ' + notes : ''}`, req.user.id]
      );
      await conn.commit();
      await logActivity(req, 'STOCK_ADJUSTED', 'Inventory', `Stock count: ${drug.name} set to ${quantity} units (${diff >= 0 ? '+' : ''}${diff})`);
      return res.json({ success: true, message: `Stock count saved — ${drug.name} adjusted by ${diff >= 0 ? '+' : ''}${diff} units`, drug: drug.name, adjustment_type, quantity, diff });
    }
    else if (adjustment_type === 'transfer_in') {
      movementType = 'in';
      if (batch_id) {
        await conn.query('UPDATE drug_batches SET quantity = quantity + ? WHERE id = ?', [quantity, batch_id]);
      } else {
        const [b] = await conn.query(
          'INSERT INTO drug_batches (drug_id, quantity, batch_number, expiry_date) VALUES (?,?,?,NULL)',
          [drug_id, quantity, `TRIN-${Date.now()}`]
        );
        batchIdUsed = b.insertId;
      }
    }
    else if (adjustment_type === 'transfer_out') {
      movementType = 'out';
      const [[total]] = await conn.query(
        'SELECT COALESCE(SUM(quantity),0) AS total FROM drug_batches WHERE drug_id = ?', [drug_id]
      );
      if (quantity > total.total)
        { await conn.rollback(); return res.status(400).json({ error: `Cannot transfer out more than total stock (${total.total} units)` }); }
      if (batch_id) {
        const [[batch]] = await conn.query('SELECT quantity FROM drug_batches WHERE id = ?', [batch_id]);
        if (quantity > batch.quantity)
          { await conn.rollback(); return res.status(400).json({ error: `Batch only has ${batch.quantity} units` }); }
        await conn.query('UPDATE drug_batches SET quantity = quantity - ? WHERE id = ?', [quantity, batch_id]);
      } else {
        // FIFO deduction
        const [batches] = await conn.query(
          'SELECT * FROM drug_batches WHERE drug_id = ? AND quantity > 0 ORDER BY expiry_date ASC, id ASC', [drug_id]
        );
        let remaining = quantity;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduct = Math.min(remaining, batch.quantity);
          await conn.query('UPDATE drug_batches SET quantity = quantity - ? WHERE id = ?', [deduct, batch.id]);
          remaining -= deduct;
        }
        batchIdUsed = null;
      }
    }

    // Log stock movement
    await conn.query(
      'INSERT INTO stock_movements (drug_id, batch_id, movement_type, quantity, reason, user_id) VALUES (?,?,?,?,?,?)',
      [drug_id, batchIdUsed, movementType, quantity, `${adjustment_type}: ${reason}${notes ? ' — ' + notes : ''}`, req.user.id]
    );

    await conn.commit();
    await logActivity(req, 'STOCK_ADJUSTED', 'Inventory',
      `${adjustment_type.replace(/_/g,' ')}: ${drug.name} — ${movementType === 'in' ? '+' : '-'}${quantity} units. Reason: ${reason}`
    );
    res.json({ success: true, message: `Stock adjusted: ${drug.name} ${movementType === 'in' ? '+' : '-'}${quantity} units`, drug: drug.name, adjustment_type, quantity });
  } catch(e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// GET stock adjustment history (movement log)
app.get('/api/stock/movements', auth, async (req, res) => {
  try {
    const { drug_id, type, date_from, date_to, limit = 100 } = req.query;
    let query = `
      SELECT sm.*, d.name AS drug_name, d.unit, u.name AS user_name,
             b.batch_number
      FROM stock_movements sm
      LEFT JOIN drugs d ON d.id = sm.drug_id
      LEFT JOIN users u ON u.id = sm.user_id
      LEFT JOIN drug_batches b ON b.id = sm.batch_id
      WHERE 1=1
    `;
    const params = [];
    if (drug_id)   { query += ' AND sm.drug_id = ?';             params.push(drug_id); }
    if (type)      { query += ' AND sm.movement_type = ?';        params.push(type); }
    if (date_from) { query += ' AND DATE(sm.created_at) >= ?';    params.push(date_from); }
    if (date_to)   { query += ' AND DATE(sm.created_at) <= ?';    params.push(date_to); }
    query += ' ORDER BY sm.created_at DESC LIMIT ?';
    params.push(Number(limit));
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


// ══════════════════════════════════════════════════════════════
//  PROFIT & LOSS REPORTING
// ══════════════════════════════════════════════════════════════

// GET P&L summary for a date range
app.get('/api/reports/pl/summary', auth, async (req, res) => {
  const { date_from, date_to } = req.query;
  if (!date_from || !date_to)
    return res.status(400).json({ error: 'date_from and date_to are required' });
  try {
    // Revenue, cost, profit per sale item (joined to batch purchase_price)
    const [rows] = await db.query(`
      SELECT
        s.id AS sale_id,
        s.sale_ref,
        s.created_at,
        s.payment_method,
        s.status,
        si.drug_id,
        d.name AS drug_name,
        d.category,
        si.quantity,
        si.unit_price,
        si.subtotal AS revenue,
        COALESCE(b.purchase_price, 0) AS purchase_price,
        (COALESCE(b.purchase_price, 0) * si.quantity) AS cost,
        (si.subtotal - (COALESCE(b.purchase_price, 0) * si.quantity)) AS profit
      FROM sale_items si
      JOIN sales s     ON s.id = si.sale_id
      LEFT JOIN drugs d       ON d.id = si.drug_id
      LEFT JOIN drug_batches b ON b.id = si.batch_id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
        AND s.status = 'complete'
    `, [date_from, date_to]);

    // Overall totals
    const totalRevenue  = rows.reduce((s, r) => s + Number(r.revenue), 0);
    const totalCost     = rows.reduce((s, r) => s + Number(r.cost), 0);
    const totalProfit   = rows.reduce((s, r) => s + Number(r.profit), 0);
    const profitMargin  = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // By category
    const byCat = {};
    rows.forEach(r => {
      const cat = r.category || 'Uncategorised';
      if (!byCat[cat]) byCat[cat] = { revenue: 0, cost: 0, profit: 0, qty: 0 };
      byCat[cat].revenue += Number(r.revenue);
      byCat[cat].cost    += Number(r.cost);
      byCat[cat].profit  += Number(r.profit);
      byCat[cat].qty     += Number(r.quantity);
    });
    const byCategory = Object.entries(byCat)
      .map(([category, v]) => ({ category, ...v, margin: v.revenue > 0 ? (v.profit/v.revenue)*100 : 0 }))
      .sort((a, b) => b.profit - a.profit);

    // By drug (top performers)
    const byDrug = {};
    rows.forEach(r => {
      if (!r.drug_name) return;
      if (!byDrug[r.drug_name]) byDrug[r.drug_name] = { revenue: 0, cost: 0, profit: 0, qty: 0, category: r.category };
      byDrug[r.drug_name].revenue += Number(r.revenue);
      byDrug[r.drug_name].cost    += Number(r.cost);
      byDrug[r.drug_name].profit  += Number(r.profit);
      byDrug[r.drug_name].qty     += Number(r.quantity);
    });
    const topDrugs = Object.entries(byDrug)
      .map(([name, v]) => ({ name, ...v, margin: v.revenue > 0 ? (v.profit/v.revenue)*100 : 0 }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 20);

    // By payment method
    const byPayment = {};
    rows.forEach(r => {
      const pm = r.payment_method || 'Unknown';
      if (!byPayment[pm]) byPayment[pm] = { revenue: 0, cost: 0, profit: 0, count: 0 };
      byPayment[pm].revenue += Number(r.revenue);
      byPayment[pm].cost    += Number(r.cost);
      byPayment[pm].profit  += Number(r.profit);
    });

    // Daily P&L trend
    const daily = {};
    rows.forEach(r => {
      const d = r.created_at.toISOString().slice(0,10);
      if (!daily[d]) daily[d] = { revenue: 0, cost: 0, profit: 0 };
      daily[d].revenue += Number(r.revenue);
      daily[d].cost    += Number(r.cost);
      daily[d].profit  += Number(r.profit);
    });
    const dailyTrend = Object.entries(daily)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, ...v, margin: v.revenue > 0 ? (v.profit/v.revenue)*100 : 0 }));

    // Total sales count & items
    const [salesCount] = await db.query(`
      SELECT COUNT(DISTINCT s.id) AS sales, SUM(si.quantity) AS items
      FROM sales s JOIN sale_items si ON si.sale_id = s.id
      WHERE DATE(s.created_at) BETWEEN ? AND ? AND s.status = 'complete'
    `, [date_from, date_to]);

    res.json({
      summary: {
        total_revenue:  totalRevenue,
        total_cost:     totalCost,
        total_profit:   totalProfit,
        profit_margin:  profitMargin,
        total_sales:    salesCount[0]?.sales || 0,
        total_items:    salesCount[0]?.items || 0,
        avg_margin:     profitMargin,
        date_from,
        date_to,
      },
      by_category:  byCategory,
      top_drugs:    topDrugs,
      by_payment:   Object.entries(byPayment).map(([method, v]) => ({ method, ...v })),
      daily_trend:  dailyTrend,
    });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET itemised P&L line items (for detailed table)
app.get('/api/reports/pl/items', auth, async (req, res) => {
  const { date_from, date_to } = req.query;
  if (!date_from || !date_to)
    return res.status(400).json({ error: 'date_from and date_to are required' });
  try {
    const [rows] = await db.query(`
      SELECT
        s.sale_ref, s.created_at, s.payment_method,
        d.name AS drug_name, d.category,
        si.quantity, si.unit_price,
        si.subtotal AS revenue,
        COALESCE(b.purchase_price, 0) AS purchase_price,
        (COALESCE(b.purchase_price, 0) * si.quantity) AS cost,
        (si.subtotal - (COALESCE(b.purchase_price, 0) * si.quantity)) AS profit,
        CASE WHEN si.subtotal > 0
          THEN ROUND(((si.subtotal - (COALESCE(b.purchase_price,0)*si.quantity))/si.subtotal)*100, 1)
          ELSE 0 END AS margin_pct
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN drugs d       ON d.id  = si.drug_id
      LEFT JOIN drug_batches b ON b.id = si.batch_id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
        AND s.status = 'complete'
      ORDER BY s.created_at DESC
      LIMIT 500
    `, [date_from, date_to]);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


// ══════════════════════════════════════════════════════════════
//  PURCHASE ORDERS & GRN
// ══════════════════════════════════════════════════════════════

// Helper: generate PO number
function genPONumber() {
  const d = new Date();
  return `PO-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`;
}
function genGRNNumber() {
  const d = new Date();
  return `GRN-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`;
}

// ── PURCHASE ORDERS ───────────────────────────────────────────

// GET all POs
app.get('/api/purchase-orders', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT po.*, s.name AS supplier_name, u.name AS created_by_name,
             COUNT(pi.id) AS item_count,
             SUM(pi.received_qty) AS total_received,
             SUM(pi.quantity) AS total_ordered
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN users u ON u.id = po.created_by
      LEFT JOIN po_items pi ON pi.po_id = po.id
      GROUP BY po.id ORDER BY po.created_at DESC
    `);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET single PO with items
app.get('/api/purchase-orders/:id', auth, async (req, res) => {
  try {
    const [[po]] = await db.query(`
      SELECT po.*, s.name AS supplier_name, s.contact AS supplier_contact,
             s.email AS supplier_email, u.name AS created_by_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN users u ON u.id = po.created_by
      WHERE po.id = ?
    `, [req.params.id]);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    const [items] = await db.query(`
      SELECT pi.*, d.name AS drug_name_linked
      FROM po_items pi
      LEFT JOIN drugs d ON d.id = pi.drug_id
      WHERE pi.po_id = ?
    `, [po.id]);
    res.json({ ...po, items });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// POST create PO
app.post('/api/purchase-orders', auth, async (req, res) => {
  const { supplier_id, order_date, expected_date, notes, items } = req.body;
  if (!supplier_id || !order_date || !items?.length)
    return res.status(400).json({ error: 'supplier, order_date and items are required' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const po_number   = genPONumber();
    const totalAmount = items.reduce((s, i) => s + (Number(i.unit_price||0) * Number(i.quantity||0)), 0);
    const [po] = await conn.query(`
      INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_date, notes, total_amount, created_by, status)
      VALUES (?,?,?,?,?,?,'sent',?)
    `, [po_number, supplier_id, order_date, expected_date||null, notes||'', totalAmount, req.user.id]);
    const poId = po.insertId;
    for (const item of items) {
      await conn.query(
        'INSERT INTO po_items (po_id, drug_id, drug_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)',
        [poId, item.drug_id||null, item.drug_name, item.quantity, item.unit_price||0, (item.unit_price||0)*(item.quantity||0)]
      );
    }
    await conn.commit();
    await logActivity(req, 'PO_CREATED', 'Suppliers', `Purchase order ${po_number} created for supplier ID ${supplier_id}`);
    res.status(201).json({ id: poId, po_number, status: 'sent' });
  } catch(e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// PUT update PO status
app.put('/api/purchase-orders/:id/status', auth, adminOnly, async (req, res) => {
  const { status } = req.body;
  const valid = ['draft','sent','partial','received','cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await db.query('UPDATE purchase_orders SET status=? WHERE id=?', [status, req.params.id]);
    await logActivity(req, 'PO_UPDATED', 'Suppliers', `PO ID ${req.params.id} status changed to ${status}`);
    res.json({ success: true });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// ── GRN ───────────────────────────────────────────────────────

// GET all GRNs
app.get('/api/grn', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT g.*, s.name AS supplier_name, po.po_number,
             u.name AS created_by_name, COUNT(gi.id) AS item_count
      FROM grn g
      JOIN suppliers s ON s.id = g.supplier_id
      LEFT JOIN purchase_orders po ON po.id = g.po_id
      LEFT JOIN users u ON u.id = g.created_by
      LEFT JOIN grn_items gi ON gi.grn_id = g.id
      GROUP BY g.id ORDER BY g.created_at DESC
    `);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET single GRN with items
app.get('/api/grn/:id', auth, async (req, res) => {
  try {
    const [[grn]] = await db.query(`
      SELECT g.*, s.name AS supplier_name, po.po_number, u.name AS created_by_name
      FROM grn g
      JOIN suppliers s ON s.id = g.supplier_id
      LEFT JOIN purchase_orders po ON po.id = g.po_id
      LEFT JOIN users u ON u.id = g.created_by
      WHERE g.id = ?
    `, [req.params.id]);
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    const [items] = await db.query('SELECT * FROM grn_items WHERE grn_id = ?', [grn.id]);
    res.json({ ...grn, items });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// POST create GRN (and update stock)
app.post('/api/grn', auth, async (req, res) => {
  const { po_id, supplier_id, received_date, notes, items } = req.body;
  if (!supplier_id || !received_date || !items?.length)
    return res.status(400).json({ error: 'supplier, received_date and items are required' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const grn_number = genGRNNumber();
    const [g] = await conn.query(`
      INSERT INTO grn (grn_number, po_id, supplier_id, received_date, notes, status, created_by)
      VALUES (?,?,?,?,?,'confirmed',?)
    `, [grn_number, po_id||null, supplier_id, received_date, notes||'', req.user.id]);
    const grnId = g.insertId;

    for (const item of items) {
      if (!item.drug_name || !item.received_qty || item.received_qty <= 0) continue;
      // Save GRN item
      await conn.query(`
        INSERT INTO grn_items (grn_id, drug_id, drug_name, po_item_id, ordered_qty, received_qty, batch_number, expiry_date, purchase_price)
        VALUES (?,?,?,?,?,?,?,?,?)
      `, [grnId, item.drug_id||null, item.drug_name, item.po_item_id||null,
          item.ordered_qty||0, item.received_qty, item.batch_number||null,
          item.expiry_date||null, item.purchase_price||0]);

      // Add to drug stock if drug_id provided
      if (item.drug_id) {
        const [batchRes] = await conn.query(
          'INSERT INTO drug_batches (drug_id, batch_number, quantity, expiry_date, purchase_price) VALUES (?,?,?,?,?)',
          [item.drug_id, item.batch_number||`GRN-${grn_number}`, item.received_qty,
           item.expiry_date||null, item.purchase_price||0]
        );
        await conn.query(
          'INSERT INTO stock_movements (drug_id, batch_id, movement_type, quantity, reason, user_id) VALUES (?,?,?,?,?,?)',
          [item.drug_id, batchRes.insertId, 'in', item.received_qty, `GRN ${grn_number}`, req.user.id]
        );
      }
      // Update PO item received qty
      if (item.po_item_id) {
        await conn.query(
          'UPDATE po_items SET received_qty = received_qty + ? WHERE id = ?',
          [item.received_qty, item.po_item_id]
        );
      }
    }

    // Update PO status based on received quantities
    if (po_id) {
      const [poItems] = await conn.query('SELECT quantity, received_qty FROM po_items WHERE po_id = ?', [po_id]);
      const allReceived = poItems.every(i => i.received_qty >= i.quantity);
      const someReceived = poItems.some(i => i.received_qty > 0);
      const newStatus = allReceived ? 'received' : someReceived ? 'partial' : 'sent';
      await conn.query('UPDATE purchase_orders SET status=? WHERE id=?', [newStatus, po_id]);
    }

    await conn.commit();
    await logActivity(req, 'GRN_CREATED', 'Suppliers', `GRN ${grn_number} created — ${items.length} item(s) received`);
    res.status(201).json({ id: grnId, grn_number, status: 'confirmed' });
  } catch(e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// GET supplier dashboard stats
app.get('/api/suppliers/:id/stats', auth, async (req, res) => {
  try {
    const [[stats]] = await db.query(`
      SELECT
        s.id, s.name,
        COUNT(DISTINCT po.id)  AS total_orders,
        COUNT(DISTINCT g.id)   AS total_grns,
        COALESCE(SUM(po.total_amount),0) AS total_value,
        COUNT(DISTINCT CASE WHEN po.status='sent' THEN po.id END) AS pending_orders,
        MAX(po.order_date) AS last_order_date
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id
      LEFT JOIN grn g ON g.supplier_id = s.id
      WHERE s.id = ?
      GROUP BY s.id
    `, [req.params.id]);
    res.json(stats || {});
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


// ══════════════════════════════════════════════════════════════
//  BARCODE SEARCH & SHIFT MANAGEMENT (ENHANCED)
// ══════════════════════════════════════════════════════════════

// GET drug by exact barcode — used by barcode scanner
app.get('/api/drugs/barcode/:barcode', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM drug_stock_summary WHERE barcode = ? LIMIT 1',
      [req.params.barcode.trim()]
    );
    if (!rows.length) return res.status(404).json({ error: 'No drug found with this barcode' });
    res.json(rows[0]);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET current open shift for logged-in user
app.get('/api/shifts/current', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT sh.*, u.name AS staff_name,
        COUNT(s.id) AS sale_count,
        COALESCE(SUM(CASE WHEN s.status='complete' THEN s.total END), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN s.status='complete' AND s.payment_method='Cash' THEN s.total END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN s.status='complete' AND s.payment_method='MoMo' THEN s.total END), 0) AS momo_sales,
        COALESCE(SUM(CASE WHEN s.status='complete' AND s.payment_method='POS'  THEN s.total END), 0) AS pos_sales
       FROM shifts sh
       JOIN users u ON u.id = sh.user_id
       LEFT JOIN sales s ON s.shift_id = sh.id
       WHERE sh.user_id = ? AND sh.status = 'open'
       GROUP BY sh.id
       LIMIT 1`,
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET shift summary (for close shift reconciliation)
app.get('/api/shifts/:id/summary', auth, async (req, res) => {
  try {
    const [[shift]] = await db.query(
      `SELECT sh.*, u.name AS staff_name,
        COUNT(DISTINCT s.id) AS sale_count,
        COALESCE(SUM(CASE WHEN s.status='complete' THEN s.total END), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN s.status='complete' AND s.payment_method='Cash' THEN s.total END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN s.status='complete' AND s.payment_method='MoMo' THEN s.total END), 0) AS momo_sales,
        COALESCE(SUM(CASE WHEN s.status='complete' AND s.payment_method='POS'  THEN s.total END), 0) AS pos_sales,
        COUNT(DISTINCT CASE WHEN s.status='refunded' THEN s.id END) AS reversals,
        COALESCE(SUM(CASE WHEN s.status='refunded' THEN s.total END), 0) AS refunded_amount
       FROM shifts sh
       JOIN users u ON u.id = sh.user_id
       LEFT JOIN sales s ON s.shift_id = sh.id
       WHERE sh.id = ?
       GROUP BY sh.id`,
      [req.params.id]
    );
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    res.json(shift);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET all shifts with summaries (for admin view)
app.get('/api/shifts/all', auth, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let where = '1=1';
    const params = [];
    if (date_from) { where += ' AND DATE(sh.started_at) >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND DATE(sh.started_at) <= ?'; params.push(date_to);   }
    const [rows] = await db.query(
      `SELECT sh.*, u.name AS staff_name,
        COUNT(DISTINCT s.id) AS sale_count,
        COALESCE(SUM(CASE WHEN s.status='complete' THEN s.total END), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN s.status='complete' AND s.payment_method='Cash' THEN s.total END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN s.status='complete' AND s.payment_method='MoMo'  THEN s.total END), 0) AS momo_sales,
        COALESCE(SUM(CASE WHEN s.status='complete' AND s.payment_method='POS'   THEN s.total END), 0) AS pos_sales
       FROM shifts sh
       JOIN users u ON u.id = sh.user_id
       LEFT JOIN sales s ON s.shift_id = sh.id
       WHERE ${where}
       GROUP BY sh.id ORDER BY sh.started_at DESC LIMIT 100`,
      params
    );
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// POST close shift with cash count
app.get('/api/shifts/active', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM shifts WHERE user_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
      [req.user.id, 'open']
    );
    res.json(rows[0] || null);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


app.get('/api/shifts', auth, async (req, res) => {
  try {
    const { date_from, date_to, user_id, status } = req.query;
    let query = `
      SELECT s.*, u.name AS user_name
      FROM shifts s JOIN users u ON u.id = s.user_id
      WHERE 1=1
    `;
    const params = [];
    if (date_from) { query += ' AND DATE(COALESCE(s.opened_at, s.created_at, NOW())) >= ?'; params.push(date_from); }
    if (date_to)   { query += ' AND DATE(COALESCE(s.opened_at, s.created_at, NOW())) <= ?'; params.push(date_to); }
    if (user_id)   { query += ' AND s.user_id = ?';          params.push(user_id); }
    if (status)    { query += ' AND s.status = ?';           params.push(status); }
    query += ' ORDER BY s.id DESC LIMIT 100';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET single shift with sales breakdown
app.get('/api/shifts/:id', auth, async (req, res) => {
  try {
    const [[shift]] = await db.query(
      'SELECT s.*, u.name AS user_name FROM shifts s JOIN users u ON u.id = s.user_id WHERE s.id = ?',
      [req.params.id]
    );
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    // Sales during this shift
    const [sales] = await db.query(`
      SELECT sale_ref, created_at, payment_method, total, status
      FROM sales
      WHERE shift_id = ?
      ORDER BY created_at ASC
    `, [shift.id]);

    // Payment method breakdown
    const [breakdown] = await db.query(`
      SELECT payment_method,
             COUNT(*) AS count,
             SUM(CASE WHEN status='complete' THEN total ELSE 0 END) AS revenue,
             SUM(CASE WHEN status='refunded' THEN total ELSE 0 END) AS refunds
      FROM sales WHERE shift_id = ?
      GROUP BY payment_method
    `, [shift.id]);

    res.json({ ...shift, sales, breakdown });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// POST open a new shift
app.post('/api/shifts/open', auth, async (req, res) => {
  const { opening_float, shift_type, notes } = req.body;

  // Check no open shift already
  const [existing] = await db.query(
    'SELECT id FROM shifts WHERE user_id = ? AND status = ?',
    [req.user.id, 'open']
  );
  if (existing.length)
    return res.status(400).json({ error: 'You already have an open shift. Close it before opening a new one.' });

  try {
    const shift_ref = `SH-${Date.now().toString().slice(-8)}`;
    const [result] = await db.query(`
      INSERT INTO shifts (shift_ref, user_id, cashier_name, shift_type, opening_float, notes, status)
      VALUES (?,?,?,?,?,?,'open')
    `, [shift_ref, req.user.id, req.user.name, shift_type || 'Morning', opening_float || 0, notes || '']);

    await logActivity(req, 'SHIFT_OPENED', 'POS',
      `${req.user.name} opened shift ${shift_ref} with float GH₵${opening_float || 0}`);

    res.status(201).json({ id: result.insertId, shift_ref, status: 'open' });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// POST close a shift
app.post('/api/shifts/:id/close', auth, async (req, res) => {
  const { closing_cash, notes } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[shift]] = await conn.query('SELECT * FROM shifts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!shift)        { await conn.rollback(); return res.status(404).json({ error: 'Shift not found' }); }
    if (shift.status === 'closed') { await conn.rollback(); return res.status(400).json({ error: 'Shift already closed' }); }

    // Calc totals from sales
    const [[totals]] = await conn.query(`
      SELECT
        COUNT(CASE WHEN status='complete' THEN 1 END)         AS total_sales,
        COALESCE(SUM(CASE WHEN status='complete' THEN total END), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN status='refunded' THEN total END), 0) AS total_refunds,
        COALESCE(SUM(CASE WHEN status='complete' AND payment_method='Cash' THEN total END), 0) AS cash_sales
      FROM sales WHERE shift_id = ?
    `, [shift.id]);

    const expectedCash   = Number(shift.opening_float) + Number(totals.cash_sales) - Number(totals.total_refunds || 0);
    const closingCash    = Number(closing_cash || 0);
    const cashVariance   = closingCash - expectedCash;

    await conn.query(`
      UPDATE shifts SET
        status='closed', closed_at=NOW(),
        closing_cash=?, expected_cash=?, cash_variance=?,
        total_sales=?, total_revenue=?, total_refunds=?,
        notes=CONCAT(COALESCE(notes,''), ?)
      WHERE id=?
    `, [closingCash, expectedCash, cashVariance,
        totals.total_sales, totals.total_revenue, totals.total_refunds,
        notes ? '\nClose notes: ' + notes : '', shift.id]);

    await conn.commit();
    await logActivity(req, 'SHIFT_CLOSED', 'POS',
      `${req.user.name} closed shift ${shift.shift_ref} — Revenue: GH₵${totals.total_revenue}, Variance: GH₵${cashVariance}`);

    res.json({
      success: true,
      shift_ref:     shift.shift_ref,
      total_sales:   totals.total_sales,
      total_revenue: totals.total_revenue,
      expected_cash: expectedCash,
      closing_cash:  closingCash,
      cash_variance: cashVariance,
    });
  } catch(e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});


// =====================================================================
//  CUSTOMERS
// =====================================================================
app.get('/api/customers', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*,
        COUNT(DISTINCT s.id) AS total_purchases,
        COALESCE(SUM(s.total),0) AS total_spent,
        MAX(s.created_at) AS last_purchase
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'complete'
      GROUP BY c.id ORDER BY c.name
    `);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

app.get('/api/customers/:id', auth, async (req, res) => {
  try {
    const [[c]] = await db.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    const [purchases] = await db.query(`
      SELECT s.id, s.sale_ref, s.created_at, s.total, s.payment_method, s.status
      FROM sales s WHERE s.customer_id = ? ORDER BY s.created_at DESC LIMIT 50
    `, [c.id]);
    res.json({ ...c, purchases });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

app.post('/api/customers', auth, async (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const [r] = await db.query(
      'INSERT INTO customers (name, phone, email, address, notes) VALUES (?,?,?,?,?)',
      [name, phone||null, email||null, address||null, notes||null]
    );
    res.status(201).json({ id: r.insertId, name, phone, email });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

app.put('/api/customers/:id', auth, async (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  try {
    await db.query(
      'UPDATE customers SET name=?,phone=?,email=?,address=?,notes=? WHERE id=?',
      [name, phone||null, email||null, address||null, notes||null, req.params.id]
    );
    res.json({ success: true });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// Search customers by name or phone
app.get('/api/customers/search/:q', auth, async (req, res) => {
  try {
    const q = '%' + req.params.q + '%';
    const [rows] = await db.query(
      'SELECT id, name, phone, email, loyalty_points FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 10',
      [q, q]
    );
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// =====================================================================
//  REORDER ALERTS
// =====================================================================
app.get('/api/reports/reorder', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.id, d.name, d.category, d.unit, d.reorder_level,
             COALESCE(SUM(b.quantity),0) AS total_stock,
             d.supplier_id, s.name AS supplier_name
      FROM drugs d
      LEFT JOIN drug_batches b ON b.drug_id = d.id
      LEFT JOIN suppliers s ON s.id = d.supplier_id
      WHERE d.reorder_level > 0
      GROUP BY d.id
      HAVING total_stock <= d.reorder_level
      ORDER BY total_stock ASC
    `);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// =====================================================================
//  SALES BY STAFF REPORT
// =====================================================================
app.get('/api/reports/sales-by-staff', auth, async (req, res) => {
  const { date_from, date_to } = req.query;
  if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to required' });
  try {
    const [rows] = await db.query(`
      SELECT u.id AS user_id, u.name AS staff_name, u.shift,
             r.name AS role,
             COUNT(DISTINCT s.id) AS total_sales,
             COALESCE(SUM(CASE WHEN s.status='complete' THEN s.total ELSE 0 END),0) AS total_revenue,
             COALESCE(SUM(CASE WHEN s.status='refunded' THEN s.total ELSE 0 END),0) AS total_refunds,
             COUNT(DISTINCT CASE WHEN s.status='refunded' THEN s.id END) AS refund_count,
             MIN(s.created_at) AS first_sale, MAX(s.created_at) AS last_sale
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN sales s ON s.user_id = u.id AND DATE(s.created_at) BETWEEN ? AND ?
      WHERE u.status = 'active'
      GROUP BY u.id ORDER BY total_revenue DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// =====================================================================
//  DAILY CASH SUMMARY
// =====================================================================
app.get('/api/reports/daily-cash', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0,10);
  try {
    // Sales breakdown by payment method
    const [byPayment] = await db.query(`
      SELECT payment_method,
             COUNT(*) AS count,
             SUM(CASE WHEN status='complete' THEN total ELSE 0 END) AS revenue,
             SUM(CASE WHEN status='refunded' THEN total ELSE 0 END) AS refunds
      FROM sales
      WHERE DATE(created_at) = ?
      GROUP BY payment_method
    `, [date]);

    // Totals
    const [totals] = await db.query(`
      SELECT
        COUNT(CASE WHEN status='complete' THEN 1 END) AS total_sales,
        COUNT(CASE WHEN status='refunded' THEN 1 END) AS total_refunds,
        COALESCE(SUM(CASE WHEN status='complete' THEN total ELSE 0 END),0) AS gross_revenue,
        COALESCE(SUM(CASE WHEN status='refunded' THEN total ELSE 0 END),0) AS total_refunded,
        COALESCE(SUM(CASE WHEN status='complete' THEN total ELSE 0 END),0) -
        COALESCE(SUM(CASE WHEN status='refunded' THEN total ELSE 0 END),0) AS net_revenue
      FROM sales WHERE DATE(created_at) = ?
    `, [date]);

    // Hourly breakdown
    const [hourly] = await db.query(`
      SELECT HOUR(created_at) AS hour, COUNT(*) AS count,
             SUM(CASE WHEN status='complete' THEN total ELSE 0 END) AS revenue
      FROM sales WHERE DATE(created_at) = ?
      GROUP BY HOUR(created_at) ORDER BY hour
    `, [date]);

    // Top selling drugs today
    const [topDrugs] = await db.query(`
      SELECT d.name, SUM(si.quantity) AS qty, SUM(si.subtotal) AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN drugs d ON d.id = si.drug_id
      WHERE DATE(s.created_at) = ? AND s.status = 'complete'
      GROUP BY d.id ORDER BY revenue DESC LIMIT 10
    `, [date]);

    res.json({ date, summary: totals[0], by_payment: byPayment, hourly, top_drugs: topDrugs });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// =====================================================================
//  PARTIAL RETURNS
// =====================================================================
app.post('/api/sales/:id/partial-return', auth, adminOnly, async (req, res) => {
  const { items, reason } = req.body; // items: [{ sale_item_id, quantity }]
  if (!items?.length) return res.status(400).json({ error: 'Items required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[sale]] = await conn.query('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) { await conn.rollback(); return res.status(404).json({ error: 'Sale not found' }); }
    if (sale.status === 'refunded') { await conn.rollback(); return res.status(400).json({ error: 'Sale already fully refunded' }); }

    let returnTotal = 0;
    for (const item of items) {
      const [[si]] = await conn.query('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?', [item.sale_item_id, sale.id]);
      if (!si) continue;
      const returnQty = Math.min(item.quantity, si.quantity);
      const returnAmt = returnQty * Number(si.unit_price);
      returnTotal += returnAmt;

      // Restore stock
      if (si.batch_id) {
        await conn.query('UPDATE drug_batches SET quantity = quantity + ? WHERE id = ?', [returnQty, si.batch_id]);
      } else if (si.drug_id) {
        // Restore to first available batch
        const [[batch]] = await conn.query('SELECT id FROM drug_batches WHERE drug_id = ? LIMIT 1', [si.drug_id]);
        if (batch) await conn.query('UPDATE drug_batches SET quantity = quantity + ? WHERE id = ?', [returnQty, batch.id]);
      }

      // Log movement
      if (si.drug_id) {
        await conn.query(
          'INSERT INTO stock_movements (drug_id, batch_id, movement_type, quantity, reason, user_id) VALUES (?,?,?,?,?,?)',
          [si.drug_id, si.batch_id, 'in', returnQty, `Partial return: ${sale.sale_ref} — ${reason||'Customer return'}`, req.user.id]
        );
      }
    }

    // Record the return
    await conn.query(
      'INSERT INTO sale_returns (sale_id, returned_by, return_amount, reason, items_json) VALUES (?,?,?,?,?)',
      [sale.id, req.user.id, returnTotal, reason||'Customer return', JSON.stringify(items)]
    );

    await conn.commit();
    await logActivity(req, 'PARTIAL_RETURN', 'Sales', `Partial return on ${sale.sale_ref} — GH₵${returnTotal.toFixed(2)} refunded`);
    res.json({ success: true, return_amount: returnTotal, sale_ref: sale.sale_ref });
  } catch(e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// GET sale items for partial return
app.get('/api/sales/:id/items', auth, async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT si.*, d.name AS drug_name, d.unit
      FROM sale_items si
      LEFT JOIN drugs d ON d.id = si.drug_id
      WHERE si.sale_id = ?
    `, [req.params.id]);
    res.json(items);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


// =====================================================================
//  EXCEL EXPORT
// =====================================================================
app.get('/api/export/:type', auth, async (req, res) => {
  const { type } = req.params;
  const { date_from, date_to } = req.query;

  try {
    let rows = [];
    let filename = '';
    let headers = [];

    if (type === 'inventory') {
      [rows] = await db.query(`
        SELECT d.name, d.category, d.unit, d.price, d.reorder_level,
               COALESCE(SUM(b.quantity),0) AS stock,
               s.name AS supplier,
               MIN(b.expiry_date) AS nearest_expiry
        FROM drugs d
        LEFT JOIN drug_batches b ON b.drug_id = d.id
        LEFT JOIN suppliers s ON s.id = d.supplier_id
        GROUP BY d.id ORDER BY d.name
      `);
      headers  = ['Name','Category','Unit','Price','Reorder Level','Stock','Supplier','Nearest Expiry'];
      filename = 'inventory.csv';
    }
    else if (type === 'sales') {
      const from = date_from || new Date().toISOString().slice(0,10);
      const to   = date_to   || from;
      [rows] = await db.query(`
        SELECT s.sale_ref, s.created_at, u.name AS cashier,
               s.payment_method, s.total, s.status
        FROM sales s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE DATE(s.created_at) BETWEEN ? AND ?
        ORDER BY s.created_at DESC
      `, [from, to]);
      headers  = ['Sale Ref','Date','Cashier','Payment','Total','Status'];
      filename = 'sales.csv';
    }
    else if (type === 'customers') {
      [rows] = await db.query(`
        SELECT c.name, c.phone, c.email, c.address,
               COUNT(DISTINCT s.id) AS purchases,
               COALESCE(SUM(s.total),0) AS total_spent,
               MAX(s.created_at) AS last_purchase
        FROM customers c
        LEFT JOIN sales s ON s.customer_id = c.id AND s.status='complete'
        GROUP BY c.id ORDER BY c.name
      `);
      headers  = ['Name','Phone','Email','Address','Purchases','Total Spent','Last Purchase'];
      filename = 'customers.csv';
    }
    else if (type === 'stock-movements') {
      const from = date_from || new Date().toISOString().slice(0,10);
      const to   = date_to   || from;
      [rows] = await db.query(`
        SELECT sm.created_at, d.name AS drug, sm.movement_type, sm.quantity,
               sm.reason, u.name AS user
        FROM stock_movements sm
        LEFT JOIN drugs d ON d.id = sm.drug_id
        LEFT JOIN users u ON u.id = sm.user_id
        WHERE DATE(sm.created_at) BETWEEN ? AND ?
        ORDER BY sm.created_at DESC
      `, [from, to]);
      headers  = ['Date','Drug','Type','Quantity','Reason','By'];
      filename = 'stock_movements.csv';
    }
    else {
      return res.status(400).json({ error: 'Unknown export type' });
    }

    // Build CSV
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = [
      headers.map(escape).join(','),
      ...rows.map(r => Object.values(r).map(escape).join(','))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});


// =====================================================================
//  PRESCRIPTION TRACKING
// =====================================================================
app.get('/api/prescriptions', auth, async (req, res) => {
  const { date_from, date_to, search } = req.query;
  try {
    let where = "WHERE s.prescription_no IS NOT NULL AND s.prescription_no != ''";
    const params = [];
    if (date_from) { where += ' AND DATE(s.created_at) >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND DATE(s.created_at) <= ?'; params.push(date_to); }
    if (search)    { where += ' AND (s.prescription_no LIKE ? OR u.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    const [rows] = await db.query(`
      SELECT s.id, s.sale_ref, s.prescription_no, s.insurance_type, s.insurance_id,
             s.total, s.created_at, u.name AS cashier,
             COUNT(si.id) AS item_count
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      ${where}
      GROUP BY s.id ORDER BY s.created_at DESC LIMIT 200
    `, params);
    res.json(rows);
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// NHIS Summary report
app.get('/api/reports/nhis', auth, async (req, res) => {
  const { date_from, date_to } = req.query;
  const from = date_from || new Date().toISOString().slice(0,10);
  const to   = date_to   || from;
  try {
    const [summary] = await db.query(`
      SELECT insurance_type,
             COUNT(*) AS count,
             SUM(total) AS total_amount
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'complete'
      GROUP BY insurance_type
    `, [from, to]);
    const [items] = await db.query(`
      SELECT s.sale_ref, s.prescription_no, s.insurance_id, s.insurance_type,
             s.total, s.created_at, u.name AS cashier
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
        AND s.insurance_type != 'cash' AND s.status = 'complete'
      ORDER BY s.created_at DESC
    `, [from, to]);
    res.json({ summary, items, date_from: from, date_to: to });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date() });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message });
  }
});


// ── Rate limiting for login endpoint ──────────────────────────
const loginAttempts = new Map();
function loginRateLimiter(req, res, next) {
  const ip  = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `login:${ip}`;
  const now = Date.now();
  const data = loginAttempts.get(key) || { count: 0, firstAttempt: now, lockedUntil: 0 };

  // Check if locked
  if (data.lockedUntil > now) {
    const secs = Math.ceil((data.lockedUntil - now) / 1000);
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${secs} seconds.` });
  }

  // Reset window after 15 minutes
  if (now - data.firstAttempt > 15 * 60 * 1000) {
    loginAttempts.set(key, { count: 1, firstAttempt: now, lockedUntil: 0 });
    return next();
  }

  data.count++;
  if (data.count >= 5) {
    data.lockedUntil = now + 15 * 60 * 1000; // lock for 15 minutes
    loginAttempts.set(key, data);
    return res.status(429).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
  }

  loginAttempts.set(key, data);
  next();
}

// Clear successful logins from attempt map
function clearLoginAttempts(ip) {
  loginAttempts.delete(`login:${ip}`);
}


// ══════════════════════════════════════════════════════════════
//  ERROR LOGGING SYSTEM
// ══════════════════════════════════════════════════════════════
// Log directory — AppData on Windows, /var/log on Linux
const LOG_DIR  = process.env.LOG_DIR || path.join(require('os').homedir(), 'pharmapro-logs');
const LOG_FILE = path.join(LOG_DIR, 'pharmapro-error.log');
const APP_LOG  = path.join(LOG_DIR, 'pharmapro-app.log');

// Ensure log directory exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch(_) {}

// Write to log file with rotation (max 5MB)
function writeLog(filepath, entry) {
  try {
    // Rotate if over 5MB
    try {
      const stat = fs.statSync(filepath);
      if (stat.size > 5 * 1024 * 1024) {
        fs.renameSync(filepath, filepath + '.bak');
      }
    } catch(_) {}
    fs.appendFileSync(filepath, entry + '\n');
  } catch(_) {}
}

// App logger — info/warn/error
const logger = {
  info: (module, msg, meta = {}) => {
    const entry = JSON.stringify({ level: 'INFO', time: new Date().toISOString(), module, msg, ...meta });
    console.log(`[${module}] ${msg}`);
    writeLog(APP_LOG, entry);
  },
  warn: (module, msg, meta = {}) => {
    const entry = JSON.stringify({ level: 'WARN', time: new Date().toISOString(), module, msg, ...meta });
    console.warn(`⚠️  [${module}] ${msg}`);
    writeLog(APP_LOG, entry);
    writeLog(LOG_FILE, entry);
  },
  error: (module, msg, err = null, meta = {}) => {
    const entry = JSON.stringify({
      level: 'ERROR', time: new Date().toISOString(), module, msg,
      error: err ? { message: err.message, stack: err.stack?.split('\n').slice(0,5).join(' | ') } : null,
      ...meta
    });
    console.error(`❌ [${module}] ${msg}`, err?.message || '');
    writeLog(LOG_FILE, entry);
    writeLog(APP_LOG, entry);
  }
};

// Log all unhandled errors
process.on('uncaughtException', (err) => {
  logger.error('PROCESS', 'Uncaught Exception — server may be unstable', err);
});
process.on('unhandledRejection', (reason) => {
  logger.error('PROCESS', 'Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

// Express error logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    const entry = JSON.stringify({
      level, time: new Date().toISOString(), module: 'HTTP',
      method: req.method, path: req.path,
      status: res.statusCode, ms,
      user: req.user?.name || 'anonymous',
      ip: req.ip || req.connection?.remoteAddress
    });
    if (res.statusCode >= 400) writeLog(LOG_FILE, entry);
    if (ms > 2000) writeLog(APP_LOG, JSON.stringify({ level: 'WARN', time: new Date().toISOString(), module: 'PERF', msg: `Slow request: ${req.method} ${req.path} took ${ms}ms` }));
  });
  next();
}

// Express global error handler
function errorHandler(err, req, res, next) {
  logger.error('EXPRESS', `${req.method} ${req.path} — ${err.message}`, err, {
    user: req.user?.name, body: req.method === 'POST' ? JSON.stringify(req.body).slice(0, 200) : undefined
  });
  res.status(500).json({ error: 'Internal server error. Check logs for details.' });
}

// Get log file path endpoint
app.get('/api/logs/path', auth, adminOnly, (req, res) => {
  res.json({ log_file: LOG_FILE, app_log: APP_LOG, log_dir: LOG_DIR });
});

// Get recent errors
app.get('/api/logs/errors', auth, adminOnly, (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) return res.json({ entries: [], message: 'No errors logged yet' });
    const lines = fs.readFileSync(LOG_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .slice(-100)  // last 100 entries
      .map(l => { try { return JSON.parse(l); } catch(_) { return null; } })
      .filter(Boolean)
      .reverse();   // newest first
    res.json({ entries: lines, log_file: LOG_FILE });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// Get recent app activity
app.get('/api/logs/activity', auth, adminOnly, (req, res) => {
  try {
    if (!fs.existsSync(APP_LOG)) return res.json({ entries: [] });
    const lines = fs.readFileSync(APP_LOG, 'utf8')
      .split('\n').filter(Boolean)
      .slice(-200)
      .map(l => { try { return JSON.parse(l); } catch(_) { return null; } })
      .filter(Boolean)
      .reverse();
    res.json({ entries: lines });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// Clear error log
app.delete('/api/logs/errors', auth, adminOnly, (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '');
    logger.info('ADMIN', `Error log cleared by ${req.user.name}`);
    res.json({ success: true });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

console.log(`📋 Logs directory: ${LOG_DIR}`);

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const [rows] = await db.query(
      'SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?',
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    await logActivity({ user: { id: user.id, name: user.name, role: user.role_name }, headers: req.headers, socket: req.socket }, 'LOGIN', 'Auth', `${user.name} logged in`);
    // Load this user's page permissions
    const [permRows] = await db.query('SELECT page FROM user_permissions WHERE user_id = ?', [user.id]);
    const perms = permRows.map(r => r.page);
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role_name },
      JWT_SECRET, { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role_name, shift: user.shift, permissions: perms } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  DRUGS / INVENTORY
// ══════════════════════════════════════════════════════════════

// GET all drugs with stock summary
app.get('/api/drugs', auth, async (req, res) => {
  try {
    const { page = 1, limit = 100, search = '', category = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = 'WHERE 1=1';
    if (search)   { where += ' AND (d.name LIKE ? OR d.barcode LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (category) { where += ' AND d.category = ?'; params.push(category); }

    const [[{ total }]] = await db.query(`SELECT COUNT(DISTINCT d.id) AS total FROM drugs d ${where}`, params);
    const [rows] = await db.query(`
      SELECT d.*, s.name AS supplier_name,
             COALESCE(SUM(b.quantity), 0) AS total_stock,
             MIN(b.expiry_date) AS nearest_expiry
      FROM drugs d
      LEFT JOIN suppliers s ON s.id = d.supplier_id
      LEFT JOIN drug_batches b ON b.drug_id = d.id
      ${where}
      GROUP BY d.id
      ORDER BY d.name
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);
    res.json({ drugs: rows, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) });
  } catch(e) { logger.error('API', e.message, e); res.status(500).json({ error: e.message }); }
});

// GET single drug with full batch details for editing
app.get('/api/drugs/:id', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM drug_stock_summary WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Drug not found' });
    const [batches] = await db.query('SELECT * FROM drug_batches WHERE drug_id = ? ORDER BY expiry_date ASC', [req.params.id]);
    // Also get raw drug fields (supplier_id etc) not in view
    const [raw] = await db.query('SELECT * FROM drugs WHERE id = ?', [req.params.id]);
    res.json({ ...rows[0], ...raw[0], batches });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add new drug + first batch
app.post('/api/drugs', auth, async (req, res) => {
  const { name, category, unit, price, reorder_level, barcode, supplier_id,
          batch_number, quantity, expiry_date, purchase_price } = req.body;
  if (!name || !price || !expiry_date || !quantity)
    return res.status(400).json({ error: 'name, price, quantity, expiry_date are required' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [drugResult] = await conn.query(
      'INSERT INTO drugs (name, category, unit, price, reorder_level, barcode, supplier_id) VALUES (?,?,?,?,?,?,?)',
      [name, category || null, unit || 'Tabs', price, reorder_level || 50, barcode || null, supplier_id || null]
    );
    const drugId = drugResult.insertId;
    const [batchResult] = await conn.query(
      'INSERT INTO drug_batches (drug_id, batch_number, quantity, expiry_date, purchase_price) VALUES (?,?,?,?,?)',
      [drugId, batch_number || null, quantity, expiry_date, purchase_price || null]
    );
    await conn.query(
      'INSERT INTO stock_movements (drug_id, batch_id, movement_type, quantity, reason, user_id) VALUES (?,?,?,?,?,?)',
      [drugId, batchResult.insertId, 'in', quantity, 'Initial stock', req.user.id]
    );
    await conn.commit();
    const [newDrug] = await db.query('SELECT * FROM drug_stock_summary WHERE id = ?', [drugId]);
    res.status(201).json(newDrug[0]);
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// PUT update drug
app.put('/api/drugs/:id', auth, async (req, res) => {
  const { name, category, unit, price, reorder_level, barcode, supplier_id } = req.body;
  try {
    await db.query(
      'UPDATE drugs SET name=?, category=?, unit=?, price=?, reorder_level=?, barcode=?, supplier_id=? WHERE id=?',
      [name, category, unit, price, reorder_level, barcode, supplier_id, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM drug_stock_summary WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE drug — safely nullify foreign key references first
app.delete('/api/drugs/:id', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Nullify drug_id in sale_items (preserve sales history but remove drug link)
    await conn.query('UPDATE sale_items SET drug_id = NULL WHERE drug_id = ?', [req.params.id]);
    // Nullify drug_id in stock_movements
    await conn.query('UPDATE stock_movements SET drug_id = NULL WHERE drug_id = ?', [req.params.id]);
    // Nullify drug_id in alerts
    await conn.query('UPDATE alerts SET drug_id = NULL WHERE drug_id = ?', [req.params.id]);
    // Delete batches (cascade should handle this but be explicit)
    await conn.query('DELETE FROM drug_batches WHERE drug_id = ?', [req.params.id]);
    // Now delete the drug
    await conn.query('DELETE FROM drugs WHERE id = ?', [req.params.id]);
    await conn.commit();
    await logActivity(req, 'DRUG_DELETED', 'Inventory', `Deleted drug ID ${req.params.id}`);
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// POST add batch to existing drug
app.post('/api/drugs/:id/batches', auth, async (req, res) => {
  const { batch_number, quantity, expiry_date, purchase_price } = req.body;
  if (!quantity || !expiry_date)
    return res.status(400).json({ error: 'quantity and expiry_date required' });
  try {
    const [result] = await db.query(
      'INSERT INTO drug_batches (drug_id, batch_number, quantity, expiry_date, purchase_price) VALUES (?,?,?,?,?)',
      [req.params.id, batch_number, quantity, expiry_date, purchase_price || null]
    );
    await db.query(
      'INSERT INTO stock_movements (drug_id, batch_id, movement_type, quantity, reason, user_id) VALUES (?,?,?,?,?,?)',
      [req.params.id, result.insertId, 'in', quantity, 'New batch received', req.user.id]
    );
    res.status(201).json({ id: result.insertId, message: 'Batch added' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  SUPPLIERS
// ══════════════════════════════════════════════════════════════
app.get('/api/suppliers', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, COUNT(d.id) AS drug_count,
        (SELECT MAX(sa.created_at) FROM sales sa
         JOIN sale_items si ON si.sale_id = sa.id
         JOIN drugs dr ON dr.id = si.drug_id WHERE dr.supplier_id = s.id) AS last_order
      FROM suppliers s
      LEFT JOIN drugs d ON d.supplier_id = s.id
      GROUP BY s.id ORDER BY s.name`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/suppliers', auth, async (req, res) => {
  const { name, contact, email, address } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const [result] = await db.query(
      'INSERT INTO suppliers (name, contact, email, address) VALUES (?,?,?,?)',
      [name, contact, email, address]
    );
    res.status(201).json({ id: result.insertId, name, contact, email, address, status: 'active' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/suppliers/:id', auth, async (req, res) => {
  const { name, contact, email, address, status } = req.body;
  try {
    await db.query(
      'UPDATE suppliers SET name=?, contact=?, email=?, address=?, status=? WHERE id=?',
      [name, contact, email, address, status, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  SALES / POS
// ══════════════════════════════════════════════════════════════
app.get('/api/sales', auth, async (req, res) => {
  const { limit = 50, offset = 0, date } = req.query;
  try {
    let query = `SELECT s.*, u.name AS cashier_name FROM sales s
                 LEFT JOIN users u ON u.id = s.user_id`;
    const params = [];
    if (date) { query += ' WHERE DATE(s.created_at) = ?'; params.push(date); }
    query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Specific named routes MUST come before /api/sales/:id ────
// Otherwise Express treats "history" and "detail" as an :id value

// GET sales history with filters (for reversal page)
app.get('/api/sales/history', auth, async (req, res) => {
  try {
    const { date_from, date_to, status } = req.query;
    let query = `
      SELECT
        s.id, s.sale_ref, s.created_at,
        s.payment_method, s.subtotal, s.total,
        s.status, s.customer_phone,
        u.name AS cashier_name,
        COUNT(si.id) AS item_count,
        SUM(si.quantity) AS total_qty,
        s.reversed_at,
        rv.name AS reversed_by_name
      FROM sales s
      LEFT JOIN users u  ON u.id = s.user_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN users rv ON rv.id = s.reversed_by
      WHERE 1=1
    `;
    const params = [];
    if (date_from) { query += ' AND DATE(s.created_at) >= ?'; params.push(date_from); }
    if (date_to)   { query += ' AND DATE(s.created_at) <= ?'; params.push(date_to); }
    if (status)    { query += ' AND s.status = ?'; params.push(status); }
    query += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT 200';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single sale full detail (for drawer view)
app.get('/api/sales/:id/detail', auth, async (req, res) => {
  try {
    const [[sale]] = await db.query(`
      SELECT s.*, u.name AS cashier_name, rv.name AS reversed_by_name
      FROM sales s
      LEFT JOIN users u  ON u.id = s.user_id
      LEFT JOIN users rv ON rv.id = s.reversed_by
      WHERE s.id = ?
    `, [req.params.id]);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    const [items] = await db.query(`
      SELECT si.*, d.name AS drug_name, d.unit, b.batch_number
      FROM sale_items si
      LEFT JOIN drugs d ON d.id = si.drug_id
      LEFT JOIN drug_batches b ON b.id = si.batch_id
      WHERE si.sale_id = ?
    `, [req.params.id]);
    res.json({ ...sale, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST reverse a transaction — admin only
app.post('/api/sales/:id/reverse', auth, adminOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[sale]] = await conn.query('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) { await conn.rollback(); return res.status(404).json({ error: 'Sale not found' }); }
    if (sale.status === 'refunded') { await conn.rollback(); return res.status(400).json({ error: 'Sale has already been reversed' }); }
    if (sale.status === 'voided')   { await conn.rollback(); return res.status(400).json({ error: 'Sale has been voided and cannot be reversed' }); }

    const [items] = await conn.query('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);

    for (const item of items) {
      if (!item.drug_id) continue;
      if (item.batch_id) {
        await conn.query('UPDATE drug_batches SET quantity = quantity + ? WHERE id = ?', [item.quantity, item.batch_id]);
      } else {
        const [batches] = await conn.query('SELECT id FROM drug_batches WHERE drug_id = ? ORDER BY expiry_date DESC LIMIT 1', [item.drug_id]);
        if (batches.length) await conn.query('UPDATE drug_batches SET quantity = quantity + ? WHERE id = ?', [item.quantity, batches[0].id]);
      }
      await conn.query(
        'INSERT INTO stock_movements (drug_id, batch_id, movement_type, quantity, reason, user_id) VALUES (?,?,?,?,?,?)',
        [item.drug_id, item.batch_id, 'in', item.quantity, `Reversal of ${sale.sale_ref}`, req.user.id]
      );
    }

    await conn.query('UPDATE sales SET status = ?, reversed_by = ?, reversed_at = NOW() WHERE id = ?', ['refunded', req.user.id, sale.id]);
    await conn.commit();
    await logActivity(req, 'SALE_REVERSED', 'Sales', `Reversed sale ${sale.sale_ref} — GH₵${sale.total} refunded`);
    res.json({ success: true, message: `Sale ${sale.sale_ref} reversed. Stock restored.`, sale_ref: sale.sale_ref, total_refunded: sale.total });
  } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
  finally { conn.release(); }
});

// ── Generic :id route — must stay AFTER all named routes above ─
app.get('/api/sales/:id', auth, async (req, res) => {
  try {
    const [sale] = await db.query(
      'SELECT s.*, u.name AS cashier_name FROM sales s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ?',
      [req.params.id]
    );
    if (!sale.length) return res.status(404).json({ error: 'Sale not found' });
    const [items] = await db.query(
      'SELECT si.*, d.name AS drug_name FROM sale_items si JOIN drugs d ON d.id = si.drug_id WHERE si.sale_id = ?',
      [req.params.id]
    );
    res.json({ ...sale[0], items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create a sale (full POS transaction)
app.post('/api/sales', auth, async (req, res) => {
  const { items, payment_method, customer_phone, shift_id, prescription_no, insurance_type, insurance_id } = req.body;
  if (!items || !items.length)
    return res.status(400).json({ error: 'items array required' });

  // Validate all drug IDs exist before starting transaction
  for (const item of items) {
    if (!item.drug_id || !item.qty || item.qty <= 0)
      return res.status(400).json({ error: `Invalid item: drug_id and qty required` });
    const [[drug]] = await db.query('SELECT id FROM drugs WHERE id = ?', [item.drug_id]);
    if (!drug) return res.status(400).json({ error: `Drug ID ${item.drug_id} not found` });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.unit_price * item.qty;
    }
    const total = subtotal; // 0% tax
    const sale_ref = 'S-' + Date.now();
    // Auto-link to cashier's active shift if one exists
    let autoShiftId = null;
    try {
      const [activeShift] = await db.query(
        'SELECT id FROM shifts WHERE user_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
        [req.user.id, 'open']
      );
      autoShiftId = activeShift.length ? activeShift[0].id : null;
    } catch(e) { autoShiftId = null; }

    // Insert sale
    const [saleResult] = await conn.query(
      'INSERT INTO sales (sale_ref, user_id, shift_id, payment_method, subtotal, total, customer_phone, prescription_no, insurance_type, insurance_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [sale_ref, req.user.id, shift_id || autoShiftId || null, payment_method || 'Cash', subtotal, total, customer_phone || null, prescription_no || null, insurance_type || 'cash', insurance_id || null]
    );
    const saleId = saleResult.insertId;

    // Insert each item + deduct stock using FIFO (oldest batch first)
    for (const item of items) {
      let remainingQty = item.qty;
      let primaryBatchId = item.batch_id || null;

      if (!item.batch_id) {
        // FIFO: get batches ordered by expiry date (oldest first), with stock > 0
        const [batches] = await conn.query(
          'SELECT id, quantity FROM drug_batches WHERE drug_id = ? AND quantity > 0 ORDER BY expiry_date ASC',
          [item.drug_id]
        );

        // Deduct across batches until qty fulfilled
        for (const batch of batches) {
          if (remainingQty <= 0) break;
          const deduct = Math.min(remainingQty, batch.quantity);
          await conn.query(
            'UPDATE drug_batches SET quantity = quantity - ? WHERE id = ?',
            [deduct, batch.id]
          );
          if (!primaryBatchId) primaryBatchId = batch.id;
          remainingQty -= deduct;
        }
      } else {
        // Specific batch_id provided — deduct directly
        await conn.query(
          'UPDATE drug_batches SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
          [item.qty, item.batch_id, item.qty]
        );
      }

      // Insert sale item record
      await conn.query(
        'INSERT INTO sale_items (sale_id, drug_id, batch_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?)',
        [saleId, item.drug_id, primaryBatchId, item.qty, item.unit_price, item.unit_price * item.qty]
      );

      // Log stock movement
      await conn.query(
        'INSERT INTO stock_movements (drug_id, batch_id, movement_type, quantity, reason, user_id) VALUES (?,?,?,?,?,?)',
        [item.drug_id, primaryBatchId, 'out', item.qty, `Sale ${sale_ref}`, req.user.id]
      );
    }

    // Insert payment record
    await conn.query(
      'INSERT INTO payments (sale_id, method, amount) VALUES (?,?,?)',
      [saleId, payment_method || 'Cash', total]
    );

    await conn.commit();
    await logActivity(req, 'SALE_COMPLETE', 'POS', `Sale ${sale_ref} — ${items.length} item(s) — GH₵${total}`);
    res.status(201).json({ id: saleId, sale_ref, total, status: 'complete' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════════
//  STAFF / USERS
// ══════════════════════════════════════════════════════════════
app.get('/api/staff', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT u.id, u.name, u.email, u.shift, u.status, u.last_login, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.name'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/staff', auth, adminOnly, async (req, res) => {
  const { name, email, password, role_id, shift } = req.body;
  if (!name || !email || !password || !role_id)
    return res.status(400).json({ error: 'name, email, password, role_id required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role_id, shift) VALUES (?,?,?,?,?)',
      [name, email, hash, role_id, shift || 'Morning']
    );
    res.status(201).json({ id: result.insertId, name, email, shift });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/staff/:id', auth, async (req, res) => {
  const { name, shift, status, role_id } = req.body;
  try {
    await db.query(
      'UPDATE users SET name=?, shift=?, status=?, role_id=? WHERE id=?',
      [name, shift, status, role_id, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  SHIFTS
// ══════════════════════════════════════════════════════════════
app.get('/api/reports/dashboard', auth, async (req, res) => {
  try {
    const [[dailySales]] = await db.query(
      "SELECT COUNT(*) AS tx, COALESCE(SUM(total),0) AS revenue FROM sales WHERE DATE(created_at)=CURDATE() AND status='complete'"
    );
    const [[monthlySales]] = await db.query(
      "SELECT COALESCE(SUM(total),0) AS revenue FROM sales WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) AND status='complete'"
    );
    const [[lowStock]] = await db.query(
      'SELECT COUNT(*) AS count FROM drug_stock_summary WHERE total_stock <= reorder_level'
    );
    const [[expiringSoon]] = await db.query(
      'SELECT COUNT(*) AS count FROM drug_stock_summary WHERE nearest_expiry BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)'
    );
    const [[expired]] = await db.query(
      'SELECT COUNT(*) AS count FROM drug_stock_summary WHERE nearest_expiry < CURDATE()'
    );
    const [topDrugs] = await db.query(
      `SELECT d.name, SUM(si.quantity) AS units_sold, SUM(si.subtotal) AS revenue
       FROM sale_items si JOIN drugs d ON d.id = si.drug_id
       JOIN sales s ON s.id = si.sale_id WHERE s.status='complete'
       GROUP BY d.id ORDER BY units_sold DESC LIMIT 5`
    );
    const [dailyChart] = await db.query(
      "SELECT * FROM daily_sales_summary LIMIT 30"
    );
    res.json({
      today: { transactions: dailySales.tx, revenue: dailySales.revenue },
      monthly_revenue: monthlySales.revenue,
      low_stock: lowStock.count,
      expiring_soon: expiringSoon.count,
      expired: expired.count,
      top_drugs: topDrugs,
      daily_chart: dailyChart,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/expiry', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.id, d.name, d.category, b.batch_number, b.quantity,
             b.expiry_date, DATEDIFF(b.expiry_date, CURDATE()) AS days_until_expiry
      FROM drug_batches b
      JOIN drugs d ON d.id = b.drug_id
      WHERE b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      ORDER BY b.expiry_date ASC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});



// ══════════════════════════════════════════════════════════════
//  EXPIRY REPORT — FULL DETAILS
// ══════════════════════════════════════════════════════════════
app.get('/api/reports/expiry-full', auth, async (req, res) => {
  try {
    // All batches grouped by urgency — expired, within 30, 60, 90 days and also beyond 90
    const [rows] = await db.query(`
      SELECT
        d.id AS drug_id,
        d.name AS drug_name,
        d.category,
        d.unit,
        d.barcode,
        s.name AS supplier_name,
        b.id AS batch_id,
        b.batch_number,
        b.quantity,
        b.expiry_date,
        b.received_date,
        DATEDIFF(b.expiry_date, CURDATE()) AS days_until_expiry,
        CASE
          WHEN DATEDIFF(b.expiry_date, CURDATE()) < 0     THEN 'expired'
          WHEN DATEDIFF(b.expiry_date, CURDATE()) <= 30   THEN 'critical'
          WHEN DATEDIFF(b.expiry_date, CURDATE()) <= 60   THEN 'warning'
          WHEN DATEDIFF(b.expiry_date, CURDATE()) <= 90   THEN 'soon'
          ELSE 'ok'
        END AS urgency
      FROM drug_batches b
      JOIN drugs d ON d.id = b.drug_id
      LEFT JOIN suppliers s ON s.id = d.supplier_id
      WHERE b.quantity > 0
      ORDER BY b.expiry_date ASC
    `);

    // Summary counts
    const expired  = rows.filter(r => r.urgency === 'expired').length;
    const critical = rows.filter(r => r.urgency === 'critical').length;
    const warning  = rows.filter(r => r.urgency === 'warning').length;
    const soon     = rows.filter(r => r.urgency === 'soon').length;
    const totalQty = rows.filter(r => r.urgency !== 'ok').reduce((s, r) => s + Number(r.quantity), 0);

    res.json({
      batches: rows,
      summary: { expired, critical, warning, soon, total_flagged: expired + critical + warning + soon, total_qty: totalQty }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  TODAY'S REVENUE — FULL ANALYTICS
// ══════════════════════════════════════════════════════════════

// 1. Summary metrics for today vs yesterday
app.get('/api/reports/today/summary', auth, async (req, res) => {
  try {
    const [[today]] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status='complete' THEN total END), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN status='complete' THEN total - subtotal END), 0) AS tax_collected,
        COUNT(CASE WHEN status='complete' THEN 1 END) AS transactions,
        COALESCE(AVG(CASE WHEN status='complete' THEN total END), 0) AS avg_sale,
        COALESCE(SUM(CASE WHEN status='refunded' THEN total END), 0) AS refunds,
        COUNT(CASE WHEN status='voided' THEN 1 END) AS voided,
        COUNT(CASE WHEN status='refunded' THEN 1 END) AS refunded_count
      FROM sales
      WHERE DATE(created_at) = CURDATE()
    `);

    const [[yesterday]] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status='complete' THEN total END), 0) AS total_revenue,
        COUNT(CASE WHEN status='complete' THEN 1 END) AS transactions,
        COALESCE(AVG(CASE WHEN status='complete' THEN total END), 0) AS avg_sale
      FROM sales
      WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `);

    // Estimate profit as 30% margin
    const profit = today.total_revenue * 0.30;
    const yesterday_profit = yesterday.total_revenue * 0.30;

    res.json({
      today: {
        total_revenue: Number(today.total_revenue),
        total_profit: Number(profit.toFixed(2)),
        transactions: today.transactions,
        avg_sale: Number(today.avg_sale),
        discounts: 0,
        refunds: Number(today.refunds),
        voided: today.voided,
        refunded_count: today.refunded_count,
      },
      yesterday: {
        total_revenue: Number(yesterday.total_revenue),
        total_profit: Number(yesterday_profit.toFixed(2)),
        transactions: yesterday.transactions,
        avg_sale: Number(yesterday.avg_sale),
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Payment method breakdown for today
app.get('/api/reports/today/payments', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        payment_method AS method,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total), 0) AS amount
      FROM sales
      WHERE DATE(created_at) = CURDATE() AND status = 'complete'
      GROUP BY payment_method
      ORDER BY amount DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Sales by staff today
app.get('/api/reports/today/staff', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        u.name AS staff_name,
        u.id AS staff_id,
        COUNT(s.id) AS transactions,
        COALESCE(SUM(s.total), 0) AS total_sales
      FROM sales s
      JOIN users u ON u.id = s.user_id
      WHERE DATE(s.created_at) = CURDATE() AND s.status = 'complete'
      GROUP BY s.user_id, u.name
      ORDER BY total_sales DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Sales by drug category today
app.get('/api/reports/today/categories', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        COALESCE(d.category, 'Uncategorized') AS category,
        SUM(si.quantity) AS qty_sold,
        COALESCE(SUM(si.subtotal), 0) AS revenue
      FROM sale_items si
      JOIN drugs d ON d.id = si.drug_id
      JOIN sales s ON s.id = si.sale_id
      WHERE DATE(s.created_at) = CURDATE() AND s.status = 'complete'
      GROUP BY d.category
      ORDER BY revenue DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. Top 10 selling drugs today
app.get('/api/reports/today/top-drugs', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        d.id,
        d.name,
        d.reorder_level,
        SUM(si.quantity) AS qty_sold,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE((
          SELECT SUM(b.quantity)
          FROM drug_batches b
          WHERE b.drug_id = d.id
        ), 0) AS remaining_stock
      FROM sale_items si
      JOIN drugs d ON d.id = si.drug_id
      JOIN sales s ON s.id = si.sale_id
      WHERE DATE(s.created_at) = CURDATE() AND s.status = 'complete'
      GROUP BY d.id, d.name, d.reorder_level
      ORDER BY qty_sold DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6. Returns and voids today
app.get('/api/reports/today/returns', auth, async (req, res) => {
  try {
    const [[returns]] = await db.query(`
      SELECT
        COUNT(CASE WHEN status='refunded' THEN 1 END) AS refunded_txns,
        COALESCE(SUM(CASE WHEN status='refunded' THEN total END), 0) AS refund_amount,
        COUNT(CASE WHEN status='voided' THEN 1 END) AS voided_txns,
        (SELECT COALESCE(SUM(si.quantity),0)
         FROM sale_items si JOIN sales s2 ON s2.id = si.sale_id
         WHERE DATE(s2.created_at) = CURDATE() AND s2.status = 'refunded'
        ) AS returned_items
      FROM sales
      WHERE DATE(created_at) = CURDATE()
    `);
    res.json(returns);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 7. Hourly revenue trend for today
app.get('/api/reports/today/hourly', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        HOUR(created_at) AS hour,
        COUNT(*) AS transactions,
        COALESCE(SUM(total), 0) AS revenue
      FROM sales
      WHERE DATE(created_at) = CURDATE() AND status = 'complete'
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `);
    // Fill in all hours 8-20 with 0 if no data
    const hours = [8,9,10,11,12,13,14,15,16,17,18,19,20];
    const filled = hours.map(h => {
      const found = rows.find(r => r.hour === h);
      return { hour: h, revenue: found ? Number(found.revenue) : 0, transactions: found ? found.transactions : 0 };
    });
    res.json(filled);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 8. Prescription vs OTC breakdown today
app.get('/api/reports/today/rx-otc', auth, async (req, res) => {
  try {
    // Use category as proxy: Antibiotics, Cardiovascular, Antidiabetics = Prescription, rest = OTC
    const [rows] = await db.query(`
      SELECT
        CASE
          WHEN d.category IN ('Antibiotics','Cardiovascular','Antidiabetics','Antimalarials')
          THEN 'Prescription'
          ELSE 'OTC'
        END AS type,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        SUM(si.quantity) AS qty
      FROM sale_items si
      JOIN drugs d ON d.id = si.drug_id
      JOIN sales s ON s.id = si.sale_id
      WHERE DATE(s.created_at) = CURDATE() AND s.status = 'complete'
      GROUP BY type
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 9. Inventory impact today
app.get('/api/reports/today/inventory-impact', auth, async (req, res) => {
  try {
    const [[impact]] = await db.query(`
      SELECT
        COALESCE(SUM(si.quantity), 0) AS items_sold,
        COALESCE(SUM(si.subtotal), 0) AS stock_value_sold
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE DATE(s.created_at) = CURDATE() AND s.status = 'complete'
    `);

    const [[lowStockHit]] = await db.query(`
      SELECT COUNT(*) AS count
      FROM drug_stock_summary
      WHERE total_stock <= reorder_level
    `);

    res.json({
      items_sold: Number(impact.items_sold),
      stock_value_sold: Number(impact.stock_value_sold),
      low_stock_count: lowStockHit.count,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 10. All transactions today (with filters)
app.get('/api/reports/today/transactions', auth, async (req, res) => {
  try {
    const { method, staff_id } = req.query;
    let query = `
      SELECT
        s.id,
        s.sale_ref AS invoice,
        s.created_at,
        u.name AS staff_name,
        s.payment_method,
        s.subtotal,
        s.total,
        s.status,
        COUNT(si.id) AS item_count
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE DATE(s.created_at) = CURDATE()
    `;
    const params = [];
    if (method && method !== 'All') { query += ' AND s.payment_method = ?'; params.push(method); }
    if (staff_id && staff_id !== 'All') { query += ' AND s.user_id = ?'; params.push(staff_id); }
    query += ' GROUP BY s.id ORDER BY s.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ══════════════════════════════════════════════════════════════
//  MONTHLY REVENUE — DATE RANGE REPORT
// ══════════════════════════════════════════════════════════════

// Sales report by date range + optional user filter
app.get('/api/reports/monthly/sales', auth, async (req, res) => {
  try {
    const { date_from, date_to, user_id } = req.query;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to required' });

    let query = `
      SELECT
        s.id,
        s.sale_ref,
        DATE(s.created_at) AS sale_date,
        TIME(s.created_at) AS sale_time,
        s.created_at,
        u.name AS staff_name,
        s.payment_method,
        s.subtotal,
        s.total,
        s.status,
        COUNT(si.id) AS item_count,
        SUM(si.quantity) AS total_qty
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
        AND s.status = 'complete'
    `;
    const params = [date_from, date_to];
    if (user_id && user_id !== 'all') {
      query += ' AND s.user_id = ?';
      params.push(user_id);
    }
    query += ' GROUP BY s.id ORDER BY s.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sale items detail for a specific sale
app.get('/api/reports/monthly/sale-items/:saleId', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        si.id,
        d.name AS drug_name,
        d.category,
        si.quantity,
        si.unit_price,
        si.subtotal
      FROM sale_items si
      JOIN drugs d ON d.id = si.drug_id
      WHERE si.sale_id = ?
    `, [req.params.saleId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Summary totals for date range
app.get('/api/reports/monthly/summary', auth, async (req, res) => {
  try {
    const { date_from, date_to, user_id } = req.query;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to required' });

    let query = `
      SELECT
        COUNT(DISTINCT s.id) AS total_transactions,
        COALESCE(SUM(s.total), 0) AS total_revenue,
        COALESCE(SUM(si.quantity), 0) AS total_qty,
        COALESCE(AVG(s.total), 0) AS avg_sale,
        COUNT(DISTINCT s.user_id) AS staff_count,
        COUNT(DISTINCT DATE(s.created_at)) AS days_active
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
        AND s.status = 'complete'
    `;
    const params = [date_from, date_to];
    if (user_id && user_id !== 'all') {
      query += ' AND s.user_id = ?';
      params.push(user_id);
    }

    const [[summary]] = await db.query(query, params);

    // Daily breakdown
    let dailyQuery = `
      SELECT
        DATE(s.created_at) AS date,
        COUNT(s.id) AS transactions,
        COALESCE(SUM(s.total), 0) AS revenue
      FROM sales s
      WHERE DATE(s.created_at) BETWEEN ? AND ?
        AND s.status = 'complete'
    `;
    const dailyParams = [date_from, date_to];
    if (user_id && user_id !== 'all') {
      dailyQuery += ' AND s.user_id = ?';
      dailyParams.push(user_id);
    }
    dailyQuery += ' GROUP BY DATE(s.created_at) ORDER BY date ASC';
    const [daily] = await db.query(dailyQuery, dailyParams);

    res.json({ summary, daily });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Expanded rows: one row per sale item (for detailed report table)
app.get('/api/reports/monthly/detail-rows', auth, async (req, res) => {
  try {
    const { date_from, date_to, user_id } = req.query;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to required' });

    let query = `
      SELECT
        s.sale_ref,
        DATE(s.created_at) AS sale_date,
        TIME(s.created_at) AS sale_time,
        u.name AS staff_name,
        d.name AS drug_name,
        d.category,
        si.quantity,
        si.unit_price,
        si.subtotal,
        s.payment_method,
        s.status
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN drugs d ON d.id = si.drug_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
        AND s.status = 'complete'
    `;
    const params = [date_from, date_to];
    if (user_id && user_id !== 'all') {
      query += ' AND s.user_id = ?';
      params.push(user_id);
    }
    query += ' ORDER BY s.created_at DESC, si.id ASC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ══════════════════════════════════════════════════════════════
//  LOW STOCK REPORT
// ══════════════════════════════════════════════════════════════
app.get('/api/reports/low-stock', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        d.id,
        d.name AS drug_name,
        d.category,
        d.unit,
        d.reorder_level,
        d.barcode,
        s.name AS supplier_name,
        COALESCE(SUM(b.quantity), 0) AS total_stock,
        MIN(b.expiry_date) AS nearest_expiry,
        COUNT(b.id) AS batch_count,
        GROUP_CONCAT(
          CONCAT(COALESCE(b.batch_number,'N/A'), ' (', b.quantity, ')')
          ORDER BY b.expiry_date ASC
          SEPARATOR ' | '
        ) AS batch_details
      FROM drugs d
      LEFT JOIN suppliers s ON s.id = d.supplier_id
      LEFT JOIN drug_batches b ON b.drug_id = d.id
      GROUP BY d.id
      HAVING total_stock <= d.reorder_level
      ORDER BY total_stock ASC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  PHARMACY SETTINGS — stored in DB, editable by admin
// ══════════════════════════════════════════════════════════════

// pharmacy_settings table created in startup sequence below

// GET settings — pharmacy_name always comes from .env, never editable
app.get('/api/settings', auth, async (req, res) => {
  const pharmacyName = process.env.PHARMACY_NAME || 'PharmaPro Enterprise';
  try {
    const [rows] = await db.query('SELECT * FROM pharmacy_settings WHERE id = 1');
    if (!rows.length) return res.json({ pharmacy_name: pharmacyName, email: '', phone: '', address: '', city: '', country: 'Ghana', website: '', tagline: '' });
    // Always override pharmacy_name with the .env value
    res.json({ ...rows[0], pharmacy_name: pharmacyName });
  } catch (e) {
    res.json({ pharmacy_name: pharmacyName, email: '', phone: '', address: '', city: '', country: 'Ghana', website: '', tagline: '' });
  }
});

// PUT update settings — admin only (pharmacy_name is NOT editable — set in .env)
app.put('/api/settings', auth, adminOnly, async (req, res) => {
  const { email, phone, address, city, country, website, tagline, logo_base64 } = req.body;
  const pharmacyName = process.env.PHARMACY_NAME || 'PharmaPro Enterprise';
  try {
    await db.query(`
      UPDATE pharmacy_settings SET
        email = ?, phone = ?, address = ?,
        city = ?, country = ?, website = ?, tagline = ?,
        logo_base64 = ?,
        updated_at = NOW()
      WHERE id = 1
    `, [email || '', phone || '', address || '',
        city || '', country || 'Ghana', website || '', tagline || '',
        logo_base64 || null]);
    const [rows] = await db.query('SELECT * FROM pharmacy_settings WHERE id = 1');
    await logActivity(req, 'SETTINGS_UPDATED', 'Settings', `Settings updated by ${req.user?.name}`);
    res.json({ success: true, settings: { ...rows[0], pharmacy_name: pharmacyName } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ─── Startup: run all migrations THEN start listening ─────────
async function startServer() {
  try {
    // 1. Create pharmacy_settings table if missing
    await db.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_settings (
        id INT PRIMARY KEY DEFAULT 1,
        pharmacy_name VARCHAR(200) NOT NULL DEFAULT 'PharmaPro Enterprise',
        email VARCHAR(200) DEFAULT '',
        phone VARCHAR(100) DEFAULT '',
        address TEXT,
        city VARCHAR(100) DEFAULT '',
        country VARCHAR(100) DEFAULT 'Ghana',
        website VARCHAR(200) DEFAULT '',
        tagline VARCHAR(300) DEFAULT '',
        updated_at DATETIME DEFAULT NOW()
      )
    `);
    // Seed default row if empty
    await db.query(`
      INSERT IGNORE INTO pharmacy_settings (id, pharmacy_name)
      VALUES (1, ?)
    `, [process.env.PHARMACY_NAME || 'PharmaPro Enterprise']);
    // Add activation columns if missing
    try { await db.query('ALTER TABLE pharmacy_settings ADD COLUMN activation_code VARCHAR(30) DEFAULT NULL'); } catch(e) {}
    try { await db.query('ALTER TABLE pharmacy_settings ADD COLUMN activated_at DATETIME DEFAULT NULL'); } catch(e) {}
    console.log('✅ pharmacy_settings table ready');

    // Create activity_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT,
        user_name   VARCHAR(200),
        user_role   VARCHAR(100),
        action      VARCHAR(100) NOT NULL,
        module      VARCHAR(100),
        description TEXT,
        ip_address  VARCHAR(50),
        created_at  DATETIME DEFAULT NOW(),
        INDEX idx_created (created_at),
        INDEX idx_user (user_id)
      )
    `);
    console.log('✅ activity_logs table ready');

    // Create user_permissions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id    INT NOT NULL,
        page       VARCHAR(50) NOT NULL,
        PRIMARY KEY (user_id, page),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ user_permissions table ready');
    // Customers table
    await db.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        name           VARCHAR(200) NOT NULL,
        phone          VARCHAR(50),
        email          VARCHAR(200),
        address        TEXT,
        notes          TEXT,
        loyalty_points INT DEFAULT 0,
        credit_balance DECIMAL(10,2) DEFAULT 0,
        created_at     DATETIME DEFAULT NOW(),
        updated_at     DATETIME DEFAULT NOW() ON UPDATE NOW()
      )
    `);
    // Add customer_id to sales if missing
    try { await db.query('ALTER TABLE sales ADD COLUMN customer_id INT NULL, ADD FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL'); } catch(e) {}
    // Sale returns table
    await db.query(`
      CREATE TABLE IF NOT EXISTS sale_returns (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        sale_id       INT NOT NULL,
        returned_by   INT,
        return_amount DECIMAL(10,2) DEFAULT 0,
        reason        TEXT,
        items_json    JSON,
        created_at    DATETIME DEFAULT NOW(),
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      )
    `);
    console.log('✅ Customers & returns tables ready');
    // Add prescription and insurance columns to sales
    try { await db.query("ALTER TABLE sales ADD COLUMN prescription_no VARCHAR(100) NULL"); } catch(e) {}
    try { await db.query("ALTER TABLE sales ADD COLUMN insurance_type ENUM('cash','nhis','insurance') DEFAULT 'cash'"); } catch(e) {}
    try { await db.query("ALTER TABLE sales ADD COLUMN insurance_id VARCHAR(100) NULL"); } catch(e) {}
    console.log('✅ Prescription & insurance columns ready');
    try { await db.query("ALTER TABLE pharmacy_settings ADD COLUMN logo_base64 MEDIUMTEXT NULL"); } catch(e) {}
    console.log('✅ Logo column ready');



    // Create purchase_orders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        po_number     VARCHAR(50) UNIQUE NOT NULL,
        supplier_id   INT NOT NULL,
        status        ENUM('draft','sent','partial','received','cancelled') DEFAULT 'draft',
        order_date    DATE NOT NULL,
        expected_date DATE,
        notes         TEXT,
        total_amount  DECIMAL(12,2) DEFAULT 0,
        created_by    INT,
        created_at    DATETIME DEFAULT NOW(),
        updated_at    DATETIME DEFAULT NOW() ON UPDATE NOW(),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS po_items (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        po_id         INT NOT NULL,
        drug_id       INT,
        drug_name     VARCHAR(200) NOT NULL,
        quantity      INT NOT NULL,
        unit_price    DECIMAL(10,2) DEFAULT 0,
        total_price   DECIMAL(12,2) DEFAULT 0,
        received_qty  INT DEFAULT 0,
        FOREIGN KEY (po_id)   REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE SET NULL
      )
    `);
    // GRN — Goods Received Notes
    await db.query(`
      CREATE TABLE IF NOT EXISTS grn (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        grn_number    VARCHAR(50) UNIQUE NOT NULL,
        po_id         INT,
        supplier_id   INT NOT NULL,
        received_date DATE NOT NULL,
        notes         TEXT,
        status        ENUM('draft','confirmed') DEFAULT 'draft',
        created_by    INT,
        created_at    DATETIME DEFAULT NOW(),
        FOREIGN KEY (po_id)         REFERENCES purchase_orders(id) ON DELETE SET NULL,
        FOREIGN KEY (supplier_id)   REFERENCES suppliers(id),
        FOREIGN KEY (created_by)    REFERENCES users(id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS grn_items (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        grn_id          INT NOT NULL,
        drug_id         INT,
        drug_name       VARCHAR(200) NOT NULL,
        po_item_id      INT,
        ordered_qty     INT DEFAULT 0,
        received_qty    INT NOT NULL,
        batch_number    VARCHAR(100),
        expiry_date     DATE,
        purchase_price  DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (grn_id)     REFERENCES grn(id) ON DELETE CASCADE,
        FOREIGN KEY (drug_id)    REFERENCES drugs(id) ON DELETE SET NULL,
        FOREIGN KEY (po_item_id) REFERENCES po_items(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Purchase Orders & GRN tables ready');

    // 2. Add reversal columns to sales if missing
    try { await db.query('ALTER TABLE sales ADD COLUMN reversed_by INT NULL'); } catch(e) {}
    try { await db.query('ALTER TABLE sales ADD COLUMN reversed_at DATETIME NULL'); } catch(e) {}
    console.log('✅ Sales reversal columns ready');
    try { await db.query('ALTER TABLE shifts ADD COLUMN cash_variance DECIMAL(10,2) DEFAULT 0'); } catch(e) {}
    try { await db.query('ALTER TABLE shifts ADD COLUMN notes TEXT'); } catch(e) {}

    // 3. Schedule auto-backup
    scheduleAutoBackup();

    // 4. Start listening
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 PharmaPro API running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error(`   Another instance of PharmaPro may already be running.`);
        console.error(`   Fix: Open Task Manager → find "node.exe" → End Task, then try again.\n`);
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}

startServer();
