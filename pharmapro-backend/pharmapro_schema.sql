-- ============================================================
--  PharmaPro Enterprise — MySQL Database Schema
--  Upload this file to your MySQL server using phpMyAdmin
--  or MySQL Workbench: File > Run SQL Script
-- ============================================================

CREATE DATABASE IF NOT EXISTS pharmapro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pharmapro;

-- ─── Users & Auth ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  permissions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  shift ENUM('Morning','Afternoon','Evening') DEFAULT 'Morning',
  status ENUM('active','on-leave','inactive') DEFAULT 'active',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ─── Suppliers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contact VARCHAR(30),
  email VARCHAR(100),
  address TEXT,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Drugs & Inventory ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS drugs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(80),
  unit VARCHAR(30) DEFAULT 'Tabs',
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  reorder_level INT DEFAULT 50,
  barcode VARCHAR(60) UNIQUE,
  supplier_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS drug_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  drug_id INT NOT NULL,
  batch_number VARCHAR(60),
  quantity INT NOT NULL DEFAULT 0,
  expiry_date DATE NOT NULL,
  purchase_price DECIMAL(10,2),
  received_date DATE DEFAULT (CURRENT_DATE),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  drug_id INT NOT NULL,
  batch_id INT,
  movement_type ENUM('in','out','adjustment','expired') NOT NULL,
  quantity INT NOT NULL,
  reason VARCHAR(200),
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (drug_id) REFERENCES drugs(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Shifts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  opening_cash DECIMAL(10,2) DEFAULT 0.00,
  closing_cash DECIMAL(10,2),
  status ENUM('open','closed') DEFAULT 'open',
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─── Sales & POS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_ref VARCHAR(20) NOT NULL UNIQUE,
  user_id INT,
  shift_id INT,
  payment_method ENUM('Cash','MoMo','POS') NOT NULL DEFAULT 'Cash',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  customer_phone VARCHAR(20),
  status ENUM('complete','refunded','voided') DEFAULT 'complete',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  drug_id INT NOT NULL,
  batch_id INT,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (drug_id) REFERENCES drugs(id),
  FOREIGN KEY (batch_id) REFERENCES drug_batches(id) ON DELETE SET NULL
);

-- ─── Payments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  method ENUM('Cash','MoMo','POS') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference VARCHAR(100),
  status ENUM('success','failed','pending') DEFAULT 'success',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- ─── Alerts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('low_stock','expiry','expired','system') NOT NULL,
  drug_id INT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE CASCADE
);

-- ─── Seed: Default Roles ─────────────────────────────────────
INSERT IGNORE INTO roles (name) VALUES
  ('Super Admin'), ('Admin'), ('Pharmacist'), ('Cashier'), ('Store Manager'), ('Auditor');

-- ─── Seed: Default Admin User (password: admin123) ───────────
INSERT IGNORE INTO users (name, email, password_hash, role_id) VALUES
  ('System Admin', 'admin@pharmapro.local',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1);

-- ─── Seed: Sample Suppliers ──────────────────────────────────
INSERT IGNORE INTO suppliers (name, contact, email) VALUES
  ('PharmaCo Ltd', '+233 20 123 4567', 'orders@pharmaco.gh'),
  ('MedSupply GH', '+233 24 987 6543', 'supply@medsupply.gh'),
  ('GlobalMed', '+233 26 555 0011', 'gh@globalmed.com');

-- ─── View: Drug Stock Summary ────────────────────────────────
CREATE OR REPLACE VIEW drug_stock_summary AS
SELECT
  d.id,
  d.name,
  d.category,
  d.unit,
  d.price,
  d.reorder_level,
  d.barcode,
  s.name AS supplier_name,
  COALESCE(SUM(b.quantity), 0) AS total_stock,
  MIN(b.expiry_date) AS nearest_expiry,
  COUNT(b.id) AS batch_count
FROM drugs d
LEFT JOIN suppliers s ON d.supplier_id = s.id
LEFT JOIN drug_batches b ON b.drug_id = d.id
GROUP BY d.id;

-- ─── View: Daily Sales Summary ───────────────────────────────
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT
  DATE(created_at) AS sale_date,
  COUNT(*) AS total_transactions,
  SUM(total) AS total_revenue,
  SUM(CASE WHEN payment_method = 'Cash' THEN total ELSE 0 END) AS cash_revenue,
  SUM(CASE WHEN payment_method = 'MoMo' THEN total ELSE 0 END) AS momo_revenue,
  SUM(CASE WHEN payment_method = 'POS'  THEN total ELSE 0 END) AS pos_revenue
FROM sales
WHERE status = 'complete'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;
