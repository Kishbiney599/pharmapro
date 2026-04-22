const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path     = require('path');
const { spawn, execSync } = require('child_process');
const http     = require('http');
const fs       = require('fs');

const isDev = !app.isPackaged;
let mainWindow     = null;
let backendProcess = null;
const BACKEND_PORT = 4000;

// ── Logging ────────────────────────────────────────────────
const logFile = path.join(app.getPath('userData'), 'pharmapro.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(logFile, line); } catch(_) {}
}

// ── Find node.exe ──────────────────────────────────────────
function findNode() {
  // Try PATH first
  try {
    const v = execSync('node --version', { encoding: 'utf8', windowsHide: true, timeout: 3000 });
    log('Node found in PATH: ' + v.trim());
    return 'node';
  } catch(_) {}

  // Try common install locations
  const locs = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
    path.join(process.env.LOCALAPPDATA  || '', 'Programs', 'nodejs', 'node.exe'),
    path.join(process.env.APPDATA       || '', 'nvm', 'current', 'node.exe'),
    path.join(process.env.USERPROFILE   || '', 'AppData', 'Local', 'Programs', 'nodejs', 'node.exe'),
    'C:\\nodejs\\node.exe',
  ];
  for (const p of locs) {
    try { if (fs.existsSync(p)) { log('Node found at: ' + p); return p; } } catch(_) {}
  }

  // Try 'where node'
  try {
    const r = execSync('where node', { encoding: 'utf8', windowsHide: true, timeout: 3000 });
    const found = r.trim().split(/\r?\n/).find(l => l.toLowerCase().endsWith('node.exe'));
    if (found && fs.existsSync(found.trim())) { log('Node found via where: ' + found.trim()); return found.trim(); }
  } catch(_) {}

  log('ERROR: Node.js not found on this system');
  return null;
}

// ── Backend path ───────────────────────────────────────────
const backendDir = isDev
  ? path.join(__dirname, '..', 'pharmapro-backend')
  : path.join(process.resourcesPath, 'backend');

// ── Start backend ──────────────────────────────────────────
function startBackend(nodeBin) {
  return new Promise((resolve, reject) => {
    log('Starting backend: ' + backendDir);

    if (!fs.existsSync(path.join(backendDir, 'server.js'))) {
      return reject(new Error('server.js not found at: ' + backendDir));
    }

    // Load .env
    const env = { ...process.env, PORT: String(BACKEND_PORT), NODE_ENV: 'production' };
    const envFile = path.join(backendDir, '.env');
    if (fs.existsSync(envFile)) {
      fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return;
        const eq = t.indexOf('=');
        if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
      });
      log('.env loaded from: ' + envFile);
    } else {
      log('WARNING: No .env file at ' + envFile);
    }

    backendProcess = spawn(nodeBin, ['server.js'], {
      cwd: backendDir, env, windowsHide: true,
    });

    let resolved = false;
    const done = (err) => {
      if (resolved) return;
      resolved = true;
      if (err) reject(err); else resolve();
    };

    backendProcess.stdout.on('data', d => {
      const msg = d.toString().trim();
      log('[BE] ' + msg);
      if (msg.includes('running on') || msg.includes('PharmaPro API') || msg.includes('MySQL connected')) {
        done();
      }
    });
    backendProcess.stderr.on('data', d => log('[BE ERR] ' + d.toString().trim()));
    backendProcess.on('close', code => { log('Backend exited: ' + code); });
    backendProcess.on('error', err => { log('Spawn error: ' + err.message); done(err); });

    // Safety: resolve after 15s even if no ready message
    setTimeout(() => done(), 15000);
  });
}

// ── Wait for health endpoint ───────────────────────────────
function waitForBackend(maxAttempts = 40) {
  return new Promise(resolve => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get('http://localhost:' + BACKEND_PORT + '/api/health', res => {
        if (res.statusCode === 200) {
          log('Backend health check OK');
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(500, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (attempts >= maxAttempts) { resolve(false); return; }
      setTimeout(check, 600);
    };
    check();
  });
}

// ── Splash screen ──────────────────────────────────────────
function createSplash() {
  const s = new BrowserWindow({
    width: 420, height: 280, frame: false,
    resizable: false, alwaysOnTop: true, backgroundColor: '#0F172A',
    webPreferences: { nodeIntegration: false },
  });
  s.loadURL(`data:text/html;charset=utf-8,<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0F172A;color:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;
     display:flex;align-items:center;justify-content:center;
     height:100vh;flex-direction:column;gap:14px}
.icon{font-size:56px;animation:pulse 1.6s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
h1{font-size:22px;font-weight:800;color:#22C55E;letter-spacing:-.5px}
p{font-size:12px;color:#64748B}
.bar{width:240px;height:4px;background:#1E293B;border-radius:4px;overflow:hidden;margin-top:4px}
.fill{height:100%;background:linear-gradient(90deg,#22C55E,#16a34a);border-radius:4px;
      animation:load 1.4s ease-in-out infinite}
@keyframes load{0%{width:10%;margin-left:0}50%{width:50%}100%{width:10%;margin-left:90%}}
</style></head><body>
<div class="icon">💊</div>
<h1>PharmaPro Enterprise</h1>
<p>Starting services, please wait...</p>
<div class="bar"><div class="fill"></div></div>
</body></html>`);
  return s;
}

// ── Main window ────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 860,
    minWidth: 1100, minHeight: 700,
    title: 'PharmaPro Enterprise',
    backgroundColor: '#0F172A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  // Allow notifications
  mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, cb) => {
    cb(permission === 'notifications');
  });

  const url = isDev
    ? 'http://localhost:3000'
    : 'file://' + path.join(__dirname, 'build', 'index.html');

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // If page fails to load, show error
  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    log('Page failed to load: ' + desc);
    mainWindow.loadURL(`data:text/html;charset=utf-8,<!DOCTYPE html><html><head><style>
      body{background:#0F172A;color:#F1F5F9;font-family:Segoe UI,sans-serif;
           display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px}
      h1{color:#EF4444;font-size:24px}p{color:#64748B;font-size:14px;max-width:400px;text-align:center}
      button{background:#22C55E;border:none;border-radius:10px;padding:12px 28px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px}
    </style></head><body>
      <div style="font-size:48px">💊</div>
      <h1>PharmaPro Failed to Load</h1>
      <p>The app could not connect to the backend server. Make sure MySQL is running and the .env file is configured correctly.</p>
      <p style="font-size:12px;color:#475569">Log: ${logFile}</p>
      <button onclick="location.reload()">🔄 Retry</button>
    </body></html>`);
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'PharmaPro', submenu: [
      { label: 'About', click: () => dialog.showMessageBox(mainWindow, {
          type: 'info', title: 'PharmaPro Enterprise',
          message: 'PharmaPro Enterprise v2.0',
          detail: 'Pharmacy Management System\nDeveloped by Stiles_Tech\n+233 247 063 292'
        })},
      { type: 'separator' },
      { label: 'View Log File',    click: () => shell.openPath(logFile) },
      { label: 'Open Data Folder', click: () => shell.openPath(app.getPath('userData')) },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'togglefullscreen' },
      { type: 'separator' },
      { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
    ]},
  ]));
}

// ── App lifecycle ──────────────────────────────────────────
app.whenReady().then(async () => {
  log('=== PharmaPro Enterprise Starting ===');
  log('Mode: ' + (isDev ? 'DEV' : 'PRODUCTION'));
  log('Backend dir: ' + backendDir);
  log('Resources: ' + (isDev ? 'N/A' : process.resourcesPath));

  const splash = createSplash();

  // Dev: check if backend already running
  if (isDev) {
    const already = await new Promise(resolve => {
      http.get('http://localhost:' + BACKEND_PORT + '/api/health', r => resolve(r.statusCode === 200))
          .on('error', () => resolve(false));
    });
    if (already) {
      log('Dev: backend already running');
      createWindow();
      setTimeout(() => { try { if (!splash.isDestroyed()) splash.close(); } catch(_) {} }, 400);
      return;
    }
  }

  // Find Node.js
  const nodeBin = findNode();
  if (!nodeBin) {
    if (splash && !splash.isDestroyed()) splash.close();
    await dialog.showErrorBox(
      'Node.js Not Found',
      'PharmaPro requires Node.js to run.\n\nPlease install it from:\nhttps://nodejs.org\n\nThen restart PharmaPro.'
    );
    app.quit();
    return;
  }

  // Start backend
  try {
    await startBackend(nodeBin);
    log('Backend process started, waiting for health check...');
    const ready = await waitForBackend(40);
    if (ready) {
      log('Backend is ready');
    } else {
      log('Backend health check timed out — loading app anyway');
    }
  } catch(err) {
    log('Backend error: ' + err.message);
    if (splash && !splash.isDestroyed()) splash.close();
    const choice = await dialog.showMessageBox({
      type: 'error',
      title: 'PharmaPro — Startup Error',
      message: 'Backend failed to start',
      detail: `Error: ${err.message}\n\nMake sure:\n• MySQL is running\n• .env file has correct credentials\n\nLog: ${logFile}`,
      buttons: ['View Log', 'Continue Anyway', 'Quit'],
      defaultId: 1, cancelId: 2,
    });
    if (choice.response === 0) { shell.openPath(logFile); app.quit(); return; }
    if (choice.response === 2) { app.quit(); return; }
  }

  createWindow();
  // Give window extra time to fully load before closing splash
  setTimeout(() => {
    try { if (splash && !splash.isDestroyed()) splash.close(); } catch(_) {}
  }, 800);
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    log('Stopping backend...');
    try { backendProcess.kill('SIGTERM'); } catch(_) {}
    backendProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) {
    try { backendProcess.kill('SIGTERM'); } catch(_) {}
    backendProcess = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
