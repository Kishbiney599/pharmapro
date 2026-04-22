# PharmaPro Enterprise — Backend API

This is the Node.js + Express API that connects to your MySQL database.

---

## ⚡ Quick Setup

### Step 1 — Upload the database schema to MySQL

Use **phpMyAdmin** or **MySQL Workbench**:
- Open `pharmapro_schema.sql`
- Run it on your MySQL server
- It creates the `pharmapro` database with all tables and seed data

### Step 2 — Configure your database connection

```bash
# Copy the example config
cp .env.example .env
```

Then edit `.env` and fill in your MySQL details:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=pharmapro
PORT=4000
JWT_SECRET=change_this_to_a_random_string
```

### Step 3 — Install dependencies

```bash
npm install
```

### Step 4 — Start the API

```bash
npm start
```

You should see:
```
✅ MySQL connected successfully
🚀 PharmaPro API running on http://localhost:4000
```

Test it: open http://localhost:4000/api/health in your browser.

---

## 🌐 Hosting the API on a Server

If you want the API on a remote server (so multiple computers can connect):

1. Upload this `pharmapro-backend/` folder to your server
2. Install Node.js on the server
3. Set `DB_HOST` in `.env` to your MySQL server IP
4. Run `npm start` or use **PM2** for persistence:
   ```bash
   npm install -g pm2
   pm2 start server.js --name pharmapro-api
   pm2 save
   ```
5. In the desktop app's `src/api.js`, change:
   ```js
   const BASE_URL = 'http://YOUR_SERVER_IP:4000/api';
   ```

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/health | DB health check |
| GET | /api/drugs | All drugs + stock |
| POST | /api/drugs | Add new drug |
| PUT | /api/drugs/:id | Update drug |
| DELETE | /api/drugs/:id | Delete drug |
| GET | /api/sales | All sales |
| POST | /api/sales | Create sale (POS) |
| GET | /api/suppliers | All suppliers |
| POST | /api/suppliers | Add supplier |
| GET | /api/staff | All staff |
| POST | /api/staff | Add staff |
| GET | /api/reports/dashboard | Dashboard stats |
| GET | /api/reports/expiry | Expiry alerts |

---

## 🔐 Default Login

- **Email**: admin@pharmapro.local
- **Password**: admin123

Change this after first login via the staff management page.
