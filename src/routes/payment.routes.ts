import { Router, Request, Response } from 'express';
import * as paymentService from '../services/payment.service';
import {
  createPaymentSchema,
  queryPaymentStatusSchema,
} from '../validators/payment.validator';

export const paymentRouter: Router = Router();

// POST /payments - Initiate STK Push
paymentRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createPaymentSchema.safeParse({
      ...req.body,
      amount: req.body.amount != null ? Number(req.body.amount) : undefined,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('; ');
      res.status(400).json({ success: false, error: msg });
      return;
    }
    const userId = (req as Request & { userId?: string }).userId;
    const payment = await paymentService.createPayment(parsed.data, userId);
    res.status(201).json({ success: true, data: payment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment';
    const status = message.includes('Invalid') || message.includes('Amount') || message.includes('phone') ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

// POST /payments/query - Query STK Push status
paymentRouter.post('/query', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = queryPaymentStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('; ');
      res.status(400).json({ success: false, error: msg });
      return;
    }
    const payment = await paymentService.queryPaymentStatus(parsed.data);
    res.json({ success: true, data: payment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to query status';
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

// POST /payments/callback - M-Pesa Daraja webhook (called by Safaricom)
paymentRouter.post('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const payment = paymentService.handleCallback(req.body);

    // Daraja expects a response with ResultCode and ResultDesc
    res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Success',
      // Optional: you can log payment.id for your records
    });
  } catch (err) {
    console.error('[Payment] Callback error:', err);
    // Still return 200 so Daraja doesn't retry; log the error
    res.status(200).json({
      ResultCode: 1,
      ResultDesc: err instanceof Error ? err.message : 'Callback processing failed',
    });
  }
});

// GET /payments - List payments with optional filters
paymentRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = paymentService.findAllPayments({
      page: req.query.page as string,
      perPage: req.query.perPage as string,
      userId: req.query.userId as string,
      status: req.query.status as string,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list payments';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /payments/validation - Daraja C2B Validation URL (called when you register URLs)
// Return this shape so Daraja accepts your validation endpoint
paymentRouter.get('/validation', (_req: Request, res: Response): void => {
  res.status(200).json({
    ResultCode: 0,
    ResultDesc: 'Validation passed',
  });
});

// GET /payments/:id - Get single payment
paymentRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const payment = paymentService.findPaymentById(req.params.id);
    if (!payment) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }
    res.json({ success: true, data: payment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get payment';
    res.status(500).json({ success: false, error: message });
  }
});
