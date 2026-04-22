/**
 * PharmaPro Enterprise — Activation Code Generator
 * ================================================
 * Run this privately to generate monthly activation codes.
 * 
 * Usage:
 *   node keygen.js                     → generate code for current month
 *   node keygen.js 2026 5              → generate code for May 2026
 *   node keygen.js --list 12           → list codes for next 12 months
 * 
 * Place this file OUTSIDE the pharmapro project folder.
 * Never share this file with clients.
 */

const crypto = require('crypto');

// ── SECRET KEY — change this to your own secret, keep it private ──
const SECRET_KEY = 'PHARMAPRO_SECRET_KEY_CHANGE_THIS_2024_XK9Z';

// ── Generate a monthly activation code ───────────────────────
function generateCode(year, month) {
  // Pad month to 2 digits
  const mm   = String(month).padStart(2, '0');
  const seed = `PHARMAPRO-${year}-${mm}-${SECRET_KEY}`;
  
  // Create SHA256 hash and take first 24 chars, group in blocks of 6
  const hash = crypto.createHash('sha256').update(seed).digest('hex').toUpperCase();
  
  // Format as XXXXXX-XXXXXX-XXXXXX-XXXXXX
  const raw  = hash.slice(0, 24);
  const code = `${raw.slice(0,6)}-${raw.slice(6,12)}-${raw.slice(12,18)}-${raw.slice(18,24)}`;
  return code;
}

// ── Verify a code (same logic as the backend) ────────────────
function verifyCode(code) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // Check current month
  if (generateCode(year, month) === code.toUpperCase().trim()) {
    return { valid: true, period: `${year}-${String(month).padStart(2,'0')}` };
  }
  // Also allow previous month (grace period for renewals)
  const prevDate  = new Date(year, month - 2, 1);
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  if (generateCode(prevYear, prevMonth) === code.toUpperCase().trim()) {
    return { valid: true, period: `${prevYear}-${String(prevMonth).padStart(2,'0')}`, grace: true };
  }
  return { valid: false };
}

// ── CLI ───────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args[0] === '--list') {
  // List codes for next N months
  const count = parseInt(args[1] || '12', 10);
  const now   = new Date();
  
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     PharmaPro Enterprise — Activation Codes           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  for (let i = 0; i < count; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year  = d.getFullYear();
    const month = d.getMonth() + 1;
    const mm    = String(month).padStart(2, '0');
    const code  = generateCode(year, month);
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    console.log(`  ${label.padEnd(20)} →  ${code}`);
  }
  console.log('\n  ⚠️  Keep these codes private. Share one code per month with the client.\n');

} else {
  // Generate for specific year/month or current month
  const now   = new Date();
  const year  = parseInt(args[0] || now.getFullYear(), 10);
  const month = parseInt(args[1] || (now.getMonth() + 1), 10);
  const mm    = String(month).padStart(2, '0');
  const code  = generateCode(year, month);
  const label = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     PharmaPro Enterprise — Activation Code            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`  Period  :  ${label}`);
  console.log(`  Code    :  ${code}`);
  console.log('\n  Share this code with the client to activate the app for this month.');
  console.log('  ⚠️  Keep this script and the SECRET_KEY private.\n');
}

// Export for use in other scripts if needed
module.exports = { generateCode, verifyCode };
