#!/usr/bin/env node
/**
 * Check that required M-Pesa Daraja env vars are set (without starting the app).
 * Usage: node scripts/check-env.js
 * Exit 0 if all present, 1 otherwise.
 */
require('dotenv/config');

const required = [
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_PASS_KEY',
  'MPESA_SHORT_CODE',
  'MPESA_CALLBACK_URL',
];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');
if (missing.length) {
  console.error('Missing required environment variables:');
  missing.forEach((key) => console.error('  -', key));
  console.error('\nCopy env.example to .env and set values. See README.');
  process.exit(1);
}

const env = process.env.MPESA_ENVIRONMENT || 'sandbox';
console.log('OK: All required M-Pesa env vars set (MPESA_ENVIRONMENT=%s).', env);
process.exit(0);
