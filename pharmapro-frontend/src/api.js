// ─── PharmaPro API Client ─────────────────────────────────────
const BASE_URL = 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('pharmapro_token');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Activation / Licensing
  checkActivation: () => fetch('http://localhost:4000/api/activation/status').then(r => r.json()),
  activate: (code) => fetch('http://localhost:4000/api/activation/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed'); return d; }),

  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  // Permissions
  getStaffWithPermissions: () => request('GET', '/staff/with-permissions'),
  getUserPermissions: (id) => request('GET', `/users/${id}/permissions`),
  setUserPermissions: (id, pages) => request('PUT', `/users/${id}/permissions`, { pages }),

  changePassword: (current_password, new_password) =>
    request('POST', '/auth/change-password', { current_password, new_password }),
  resetUserPassword: (userId, new_password) =>
    request('POST', `/users/${userId}/reset-password`, { new_password }),
  health: () => request('GET', '/health'),

  // Drugs
  getDrugs: () => request('GET', '/drugs'),
  getDrug: (id) => request('GET', `/drugs/${id}`),
  addDrug: (data) => request('POST', '/drugs', data),
  bulkImportDrugs: (rows) => request('POST', '/drugs/bulk-import', { rows }),
  updateDrug: (id, data) => request('PUT', `/drugs/${id}`, data),
  deleteDrug: (id) => request('DELETE', `/drugs/${id}`),
  addBatch: (drugId, data) => request('POST', `/drugs/${drugId}/batches`, data),

  // Sales & Transaction Reversal
  getSalesHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/sales/history' + (qs ? '?' + qs : ''));
  },
  getSaleDetail: (id) => request('GET', `/sales/${id}/detail`),
  reverseSale: (id) => request('POST', `/sales/${id}/reverse`),

  // Sales
  getSales: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/sales${qs ? '?' + qs : ''}`);
  },
  getSale: (id) => request('GET', `/sales/${id}`),
  createSale: (data) => request('POST', '/sales', data),

  // Suppliers
  getSuppliers: () => request('GET', '/suppliers'),
  addSupplier: (data) => request('POST', '/suppliers', data),
  updateSupplier: (id, data) => request('PUT', `/suppliers/${id}`, data),

  // Staff
  getStaff: () => request('GET', '/staff'),
  addStaff: (data) => request('POST', '/staff', data),
  updateStaff: (id, data) => request('PUT', `/staff/${id}`, data),



  // Reports
  getDashboard: () => request('GET', '/reports/dashboard'),
  getExpiryReport: () => request('GET', '/reports/expiry'),

  // Today Revenue Analytics
  getTodaySummary: () => request('GET', '/reports/today/summary'),
  getTodayPayments: () => request('GET', '/reports/today/payments'),
  getTodayStaff: () => request('GET', '/reports/today/staff'),
  getTodayCategories: () => request('GET', '/reports/today/categories'),
  getTodayTopDrugs: () => request('GET', '/reports/today/top-drugs'),
  getTodayReturns: () => request('GET', '/reports/today/returns'),
  getTodayHourly: () => request('GET', '/reports/today/hourly'),
  getTodayRxOtc: () => request('GET', '/reports/today/rx-otc'),
  getTodayInventoryImpact: () => request('GET', '/reports/today/inventory-impact'),
  // Expiry Report
  getExpiryFull: () => request('GET', '/reports/expiry-full'),

  // Low Stock Report
  getLowStock: () => request('GET', '/reports/low-stock'),
  // Barcode
  getDrugByBarcode: (barcode) => request('GET', `/drugs/barcode/${encodeURIComponent(barcode)}`),

  // Shifts
  getCurrentShift: ()             => request('GET',  '/shifts/active'),
  getShiftSummary: (id)           => request('GET',  `/shifts/${id}`),
  getShifts:       (p={})         => { const qs=new URLSearchParams(p).toString(); return request('GET','/shifts'+(qs?'?'+qs:'')); },
  getShift:        (id)           => request('GET',  `/shifts/${id}`),
  startShift:      (float)        => request('POST', '/shifts/open', { opening_float: float }),
  closeShift:      (id,cash,notes)=> request('POST', `/shifts/${id}/close`, { closing_cash: cash, notes }),

  // Purchase Orders & GRN
  getPurchaseOrders:    ()       => request('GET',  '/purchase-orders'),
  getPurchaseOrder:     (id)     => request('GET',  `/purchase-orders/${id}`),
  createPurchaseOrder:  (data)   => request('POST', '/purchase-orders', data),
  updatePOStatus:       (id, status) => request('PUT', `/purchase-orders/${id}/status`, { status }),
  getGRNs:              ()       => request('GET',  '/grn'),
  getGRN:               (id)     => request('GET',  `/grn/${id}`),
  createGRN:            (data)   => request('POST', '/grn', data),
  getSupplierStats:     (id)     => request('GET',  `/suppliers/${id}/stats`),


  // Error Logs
  getErrorLog:   () => request('GET',    '/logs/errors'),
  getLogPath:    () => request('GET',    '/logs/path'),
  clearErrorLog: () => request('DELETE', '/logs/errors'),
  getAppLog:     () => request('GET',    '/logs/activity'),

  // Prescriptions & NHIS
  getPrescriptions: (params={}) => { const qs = new URLSearchParams(params).toString(); return request('GET', '/prescriptions' + (qs ? '?' + qs : '')); },
  getNHISReport:    (date_from, date_to) => request('GET', `/reports/nhis?date_from=${date_from}&date_to=${date_to}`),

  // Customers
  getCustomers:        ()       => request('GET',  '/customers'),
  getCustomer:         (id)     => request('GET',  `/customers/${id}`),
  searchCustomers:     (q)      => request('GET',  `/customers/search/${encodeURIComponent(q)}`),
  createCustomer:      (data)   => request('POST', '/customers', data),
  updateCustomer:      (id, d)  => request('PUT',  `/customers/${id}`, d),

  // Reports
  getReorderAlerts:    ()                    => request('GET', '/reports/reorder'),
  getSalesByStaff:     (date_from, date_to)  => request('GET', `/reports/sales-by-staff?date_from=${date_from}&date_to=${date_to}`),
  getDailyCash:        (date)                => request('GET', `/reports/daily-cash?date=${date}`),

  // Partial returns
  getSaleItems:        (id)                  => request('GET',  `/sales/${id}/items`),
  partialReturn:       (id, data)            => request('POST', `/sales/${id}/partial-return`, data),

  // Excel Export
  exportToExcel: (type, params={}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/export/${type}` + (qs ? '?' + qs : ''));
  },

  // Profit & Loss
  getPLSummary: (date_from, date_to) =>
    request('GET', `/reports/pl/summary?date_from=${date_from}&date_to=${date_to}`),
  getPLItems: (date_from, date_to) =>
    request('GET', `/reports/pl/items?date_from=${date_from}&date_to=${date_to}`),

  // Stock Adjustment
  getAdjustmentDrugs:   ()              => request('GET', '/stock/adjustment/drugs'),
  getAdjustmentBatches: (drug_id)       => request('GET', `/stock/adjustment/batches/${drug_id}`),
  submitAdjustment:     (data)          => request('POST', '/stock/adjust', data),
  getStockMovements:    (params = {})   => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/stock/movements' + (qs ? '?' + qs : ''));
  },

  // Backup & Restore
  getBackupList:    ()         => request('GET',    '/backup/list'),
  createBackup:     ()         => request('POST',   '/backup/create', {}),
  deleteBackup:     (filename) => request('DELETE', `/backup/${encodeURIComponent(filename)}`),
  getAutoStatus:    ()         => request('GET',    '/backup/auto-status'),
  restoreBackup:    (data)     => request('POST',   '/backup/restore', { backup_data: data }),
  getBackupDownloadUrl: (filename) =>
    `http://localhost:4000/api/backup/download/${encodeURIComponent(filename)}`,

  getSettings: () => request('GET', '/settings'),
  getActivityLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/activity-logs' + (qs ? '?' + qs : ''));
  },
  getActivityUsers: () => request('GET', '/activity-logs/users'),
  updateSettings: (data) => request('PUT', '/settings', data),

  // Monthly Revenue Report
  getMonthlyReport: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/reports/monthly/detail-rows?' + qs);
  },
  getMonthlySummary: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/reports/monthly/summary?' + qs);
  },

  getTodayTransactions: (filters = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return request('GET', '/reports/today/transactions' + (qs ? '?' + qs : ''));
  },
};

export function saveToken(token) { localStorage.setItem('pharmapro_token', token); }

export function clearToken() {
  localStorage.removeItem('pharmapro_token');
  localStorage.removeItem('pharmapro_user');
  localStorage.removeItem('pharmapro_login_time');
  sessionStorage.removeItem('pharmapro_session');
}

// Save user + login timestamp + mark session as active
export function saveUser(user) {
  localStorage.setItem('pharmapro_user', JSON.stringify(user));
  localStorage.setItem('pharmapro_login_time', Date.now().toString());
  sessionStorage.setItem('pharmapro_session', '1'); // cleared when tab/window closes
}

const SESSION_HOURS = 3;
const SESSION_MS    = SESSION_HOURS * 60 * 60 * 1000;

// Returns user only if:
//  1. sessionStorage flag is present (same browser session — not closed & reopened)
//  2. login is less than 3 hours old
export function savedUser() {
  try {
    // If window was closed and reopened, sessionStorage is gone → force re-login
    const sessionActive = sessionStorage.getItem('pharmapro_session');
    if (!sessionActive) return null;

    const user      = JSON.parse(localStorage.getItem('pharmapro_user'));
    const loginTime = parseInt(localStorage.getItem('pharmapro_login_time') || '0', 10);
    if (!user || !loginTime) return null;

    // Auto-expire after SESSION_HOURS
    if (Date.now() - loginTime > SESSION_MS) {
      clearToken();
      return null;
    }
    return user;
  } catch { return null; }
}
