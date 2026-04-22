# PharmaPro Enterprise — Build Guide

## Quick Start (Development)

### Terminal 1 — Backend:
```cmd
cd pharmapro-backend
npm install
npm start
```

### Terminal 2 — Frontend:
```cmd
cd pharmapro-frontend
npm install
npm start
```
Open http://localhost:3000

---

## Build Desktop App (.exe)

### Step 1 — Install Electron dependencies (first time only):
```cmd
cd pharmapro-frontend
npm install --save-dev electron@28 electron-builder concurrently wait-on
```

### Step 2 — Build the app folder (fast, ~30 seconds):
```cmd
npm run dist
```
Output: `pharmapro-frontend\dist\win-unpacked\PharmaPro Enterprise.exe`

Double-click `PharmaPro Enterprise.exe` to run — no installation needed.
Right-click → Send to Desktop (create shortcut) for easy access.

### Step 3 — Build installer (slow, ~5 minutes):
```cmd
npm run dist:installer
```
Output: `pharmapro-frontend\dist\PharmaPro Enterprise Setup 2.0.0.exe`

---

## Project Structure

```
pharmapro-frontend/src/
  App.js                  ← Main shell (432 lines)
  themes.js               ← Colors, fonts, utilities
  components.js           ← Shared UI components
  Login.js                ← Login + activation
  Dashboard.js            ← Dashboard page
  InventoryPage.js        ← Inventory with pagination
  POSPage.js              ← Point of Sale
  StaffPage.js            ← Staff management
  ReportsPage.js          ← Reports hub
  ChangePasswordModal.js  ← Password change
  Customers.js            ← Customer management
  DailyCash.js            ← Daily cash report
  StaffSales.js           ← Sales by staff
  ReorderAlerts.js        ← Drug reorder alerts
  ErrorLog.js             ← Error log viewer
  Settings.js             ← App settings + logo
  Backup.js               ← Backup & restore
  Suppliers.js            ← Supplier management
  StockAdjustment.js      ← Stock adjustment
  ProfitLoss.js           ← P&L report
  SalesHistory.js         ← Sales history
  api.js                  ← API client

pharmapro-backend/
  server.js               ← Express API (3000+ lines)
  .env                    ← Database credentials
```

---

## Environment Variables (.env)

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pharmapro
JWT_SECRET=your_strong_secret_min_32_chars
PORT=4000
PHARMACY_NAME=Your Pharmacy Name
LOG_DIR=C:\Users\YourName\pharmapro-logs
```

---

## Default Login
- Email: admin@pharmapro.local
- Password: admin123

---

## Log Files
- Error log: `%USERPROFILE%\pharmapro-logs\pharmapro-error.log`
- App log:   `%USERPROFILE%\pharmapro-logs\pharmapro-app.log`
- View in app: Settings → 🔴 Error Log

---

## Troubleshooting

**App won't start / blank screen**
→ Check backend is running on port 4000
→ Check MySQL is running
→ Check .env credentials

**"drugs.filter is not a function"**
→ Replace POSPage.js and api.js with latest versions

**"X is not defined" errors**
→ Check the file has the correct imports from ./components and ./themes

**Electron NSIS build hangs**
→ Use `npm run dist` (dir target) instead
→ Or clear cache: `rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\nsis"`
