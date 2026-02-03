import 'dotenv/config';

function getRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Config validation error: Missing required environment variable "${key}"`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mpesa: {
    environment: (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    consumerKey: getRequired('MPESA_CONSUMER_KEY'),
    consumerSecret: getRequired('MPESA_CONSUMER_SECRET'),
    passKey: getRequired('MPESA_PASS_KEY'),
    shortCode: getRequired('MPESA_SHORT_CODE'),
    callbackUrl: getRequired('MPESA_CALLBACK_URL'),
  },
  get baseUrl(): string {
    return this.mpesa.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  },
};
