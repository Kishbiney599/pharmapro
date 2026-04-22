# PharmaPro Enterprise 💊
### A Full-Stack Pharmacy Management System built with React · Node.js · Electron · MySQL

> Built and deployed by **Daniel Kish Biney** — IT Manager & Full-Stack Developer  
> 📍 Accra, Ghana | [LinkedIn](https://linkedin.com/in/Kishbiney59) | [GitHub](https://github.com/Kishbiney599)

---

## 🚀 What is PharmaPro?

PharmaPro is a production-ready, offline-capable desktop application designed to digitize and centralize pharmacy operations. It replaces manual processes (paper logs, spreadsheets, disconnected systems) with a single secure platform that handles everything from drug inventory to point-of-sale to financial reporting.

**Deployed in a live pharmacy environment.** Estimated to reduce manual processing time by ~50%.

---

## ✨ Features

| Module | What it does |
|--------|-------------|
| 🔐 **Authentication & RBAC** | Secure JWT login with role-based access (Admin, Pharmacist, Cashier) |
| 💊 **Drug Inventory** | Real-time stock tracking, low-stock alerts, expiry monitoring |
| 🛒 **Point of Sale (POS)** | Fast sales processing with receipt generation |
| 👥 **Staff Management** | Add, manage, and assign roles to staff members |
| 🚚 **Supplier Management** | Track suppliers and purchase orders |
| 📊 **Reports & Dashboard** | Sales analytics, expiry alerts, inventory summaries |
| 💾 **Backup & Restore** | One-click data backup and recovery system |
| 📋 **Audit Logging** | Full activity log for compliance and traceability |
| 📡 **Offline-First** | Works without internet — critical for real-world pharmacy environments |

---

## 🛠 Tech Stack

**Frontend (Desktop App)**
- React.js — UI framework
- Electron — Cross-platform desktop wrapper
- CSS Modules — Component-scoped styling

**Backend (API)**
- Node.js + Express — REST API server
- MySQL — Relational database
- JWT — Secure authentication tokens
- bcrypt — Password hashing

**DevOps & Tools**
- PM2 — Production process manager
- phpMyAdmin / MySQL Workbench — DB administration
- dotenv — Environment configuration

---

## 🏗 Architecture Overview

```
pharmapro/
├── pharmapro-desktop/        # Electron + React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # POS, Inventory, Reports, etc.
│   │   └── api.js            # Axios API client
│   └── main.js               # Electron entry point
│
└── pharmapro-backend/        # Node.js + Express API
    ├── routes/               # Auth, drugs, sales, staff, reports
    ├── middleware/           # JWT auth, role guard
    ├── db.js                 # MySQL connection pool
    └── server.js             # Entry point
```

---

## ⚡ Quick Setup

### Prerequisites
- Node.js v16+
- MySQL 8.0+
- npm

### Step 1 — Set up the database

Use **phpMyAdmin** or **MySQL Workbench**:
- Open `pharmapro_schema.sql`
- Run it on your MySQL server
- Creates the `pharmapro` database with all tables and seed data

### Step 2 — Configure environment

```bash
cd pharmapro-backend
cp .env.example .env
```

Edit `.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=pharmapro
PORT=4000
JWT_SECRET=change_this_to_a_random_string
```

### Step 3 — Install & run the backend

```bash
npm install
npm start
```

Expected output:
```
✅ MySQL connected successfully
🚀 PharmaPro API running on http://localhost:4000
```

### Step 4 — Install & run the desktop app

```bash
cd pharmapro-desktop
npm install
npm run electron
```

---

## 🌐 Deploying the API to a Server (Multi-user setup)

For clinic-wide access across multiple computers:

1. Upload `pharmapro-backend/` to your server
2. Install Node.js on the server
3. Set `DB_HOST` in `.env` to your MySQL server IP
4. Use PM2 for persistent background running:

```bash
npm install -g pm2
pm2 start server.js --name pharmapro-api
pm2 save
pm2 startup
```

5. In `pharmapro-desktop/src/api.js`, update:
```js
const BASE_URL = 'http://YOUR_SERVER_IP:4000/api';
```

---

## 📋 API Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Login & get JWT token | ❌ |
| GET | `/api/health` | DB health check | ❌ |
| GET | `/api/drugs` | All drugs + stock levels | ✅ |
| POST | `/api/drugs` | Add new drug | ✅ Admin |
| PUT | `/api/drugs/:id` | Update drug details | ✅ Admin |
| DELETE | `/api/drugs/:id` | Delete drug | ✅ Admin |
| GET | `/api/sales` | All sales records | ✅ |
| POST | `/api/sales` | Create new sale (POS) | ✅ |
| GET | `/api/suppliers` | All suppliers | ✅ |
| POST | `/api/suppliers` | Add supplier | ✅ Admin |
| GET | `/api/staff` | All staff members | ✅ Admin |
| POST | `/api/staff` | Add staff member | ✅ Admin |
| GET | `/api/reports/dashboard` | Dashboard statistics | ✅ |
| GET | `/api/reports/expiry` | Drugs nearing expiry | ✅ |

---

## 🔐 Default Login

> ⚠️ Change these credentials immediately after first login

| Field | Value |
|-------|-------|
| Email | `admin@pharmapro.local` |
| Password | `admin123` |

Change via **Staff Management → Edit Profile** after first login.

---

## 🔒 Security Features

- JWT-based stateless authentication
- bcrypt password hashing (salt rounds: 10)
- Role-based access control (Admin / Pharmacist / Cashier)
- Protected API routes — all sensitive endpoints require valid token
- Audit logging for all critical actions

---

## 👨‍💻 About the Developer

**Daniel Kish Biney** is an IT Manager and full-stack developer based in Accra, Ghana, with 5+ years of experience in IT infrastructure, systems administration, and software development. PharmaPro was designed, built, and deployed entirely by Daniel to solve real operational challenges in a live pharmacy environment.

- 🔗 [LinkedIn](https://linkedin.com/in/Kishbiney59)
- 🐙 [GitHub](https://github.com/Kishbiney599)
- 📧 netbiney59@gmail.com

---

## 📄 License

This project is proprietary software developed for real-world deployment.  
© 2024 Daniel Kish Biney. All rights reserved.
