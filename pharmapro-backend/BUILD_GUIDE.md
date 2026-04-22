# PharmaPro Enterprise — Build Guide
## Create a Windows .exe Installer

---

## What You Get
A single **PharmaPro Enterprise Setup.exe** installer that:
- Installs the app to Program Files
- Creates a desktop shortcut
- **Automatically starts the Node.js backend** when you launch the app
- Connects to your MySQL database using the saved `.env` settings
- No CMD windows needed — everything runs silently in the background

---

## Prerequisites (install these once)

1. **Node.js** — https://nodejs.org (download LTS version)
2. **MySQL** — must already be installed and running on your PC
3. Your project folder structure:
   ```
   pham/
   ├── pharmapro-frontend/   ← React app
   └── pharmapro-backend/    ← Express API
   ```

---

## Step 1 — Copy the new files

Replace these files in your project:

| File | Destination |
|------|-------------|
| `electron.js` | `pharmapro-frontend/electron.js` |
| `package.json` | `pharmapro-frontend/package.json` |

---

## Step 2 — Make sure your .env is correct

Open `pharmapro-backend/.env` and confirm your MySQL settings are correct:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=pharmapro
PORT=4000
JWT_SECRET=your_secret_key
PHARMACY_NAME=Your Pharmacy Name
```

> ⚠️ This `.env` file will be bundled inside the installer. Make sure the password is correct.

---

## Step 3 — Install backend dependencies

Open CMD in `pharmapro-backend/` and run:

```cmd
npm install
```

---

## Step 4 — Install frontend + Electron dependencies

Open CMD in `pharmapro-frontend/` and run:

```cmd
npm install
npm install --save-dev electron electron-builder concurrently wait-on
```

---

## Step 5 — Test it works before building

In `pharmapro-frontend/`, run:

```cmd
npm run electron-dev
```

This should:
1. Start the React dev server
2. Open the Electron window showing the app

If it works, proceed to build.

---

## Step 6 — Build the .exe

In `pharmapro-frontend/`, run:

```cmd
npm run dist
```

This will:
1. Build the React app (`npm run build`)
2. Bundle everything with Electron
3. Create the installer in `pharmapro-frontend/dist/`

**Output:** `pharmapro-frontend/dist/PharmaPro Enterprise Setup 1.0.0.exe`

This takes 3–8 minutes on first run (downloads Electron binaries).

---

## Step 7 — Install and run

1. Double-click **PharmaPro Enterprise Setup 1.0.0.exe**
2. Follow the installer (choose installation directory)
3. Launch from desktop shortcut or Start Menu
4. The app starts automatically — no CMD needed!

---

## How it works internally

When you launch **PharmaPro Enterprise**:

1. A splash screen appears while services start
2. Electron spawns `node server.js` (the backend) silently in the background
3. The backend connects to your MySQL database
4. Once the backend is ready, the main window loads
5. When you close the app, the backend process is killed automatically

---

## Troubleshooting

**"Backend failed to start" error:**
- Make sure MySQL is running (check Services in Windows)
- Check your `.env` file has the correct MySQL password
- Open the log file: `C:\Users\YourName\AppData\Roaming\pharmapro-desktop\pharmapro.log`

**Port 4000 already in use:**
- Another app is using port 4000. Change `PORT=4001` in `.env` and rebuild.

**App opens but shows blank/error:**
- The React build may need rebuilding: run `npm run build` then `npm run dist` again

**MySQL connection refused:**
- MySQL service isn't running. Go to Windows Services and start "MySQL80" or "MySQL"

---

## Distributing to other PCs

The generated `.exe` installer can be copied to any Windows PC **that has MySQL installed**.

If you want a fully self-contained app that works WITHOUT MySQL being installed separately,
that requires embedding a portable MySQL — which needs a different (more complex) setup.
For a pharmacy that always has one dedicated PC, the above approach is ideal.

---

## Re-building after code changes

After you update any source files:

1. Replace the changed files in your project
2. Run `npm run dist` again in `pharmapro-frontend/`
3. A new installer will be created in `dist/`
