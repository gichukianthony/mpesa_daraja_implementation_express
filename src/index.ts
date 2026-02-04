// import 'dotenv/config';
import cors from 'cors';
import express from 'express';
// import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { paymentRouter } from './routes/payment.routes';
import { baseUrl, env } from './config/env';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Root: API info
app.get('/', (_req, res) => {
  res.json({
    service: 'mpesa-daraja',
    version: '1.0.0',
    docs: 'See README.md',
    endpoints: {
      health: 'GET /health',
      ready: 'GET /health/ready',
      payments: 'GET/POST /api/payments',
      validation: 'GET /api/payments/validation',
      callback: 'POST /api/payments/callback (Daraja webhook)',
    },
  });
});

// Health check (liveness)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mpesa-daraja' });
});


// Readiness: checks Daraja credentials by requesting an access token
app.get('/health/ready', async (_req, res) => {
  try {
    const authUrl = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
    const credentials = Buffer.from(
      `${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');
    const r = await fetch(authUrl, {
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!r.ok) {
      const text = await r.text();
      res.status(503).json({
        status: 'unhealthy',
        service: 'mpesa-daraja',
        daraja: 'token_failed',
        detail: text.slice(0, 200),
      });
      return;
    }
    res.json({ status: 'ok', service: 'mpesa-daraja', daraja: 'connected' });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'mpesa-daraja',
      daraja: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Mount payment routes at /api/payments
app.use('/api/payments', paymentRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(env.PORT, () => {
  console.log(`[Server] M-Pesa Daraja API running at http://localhost:${env.PORT}`);
  console.log(`[Server] Environment: ${env.MPESA_ENVIRONMENT}`);
});
