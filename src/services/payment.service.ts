import { darajaService } from './daraja.service';
import { paymentStore } from '../store/payment.store';
import {
  Payment,
  PaymentStatus,
  CreatePaymentInput,
  QueryPaymentStatusInput,
} from '../types/payment.types';

const PAYMENT_METHOD = 'MPESA_STK_PUSH';

export async function createPayment(
  input: CreatePaymentInput,
  userId?: string
): Promise<Payment> {
  const sanitizedPhone = input.phone_number.replace(/^0/, '254').replace(/^\+/, '');

  const payment = paymentStore.create({
    user_id: userId ?? null,
    amount: input.amount,
    phone_number: sanitizedPhone,
    account_reference: input.account_reference.substring(0, 12),
    transaction_description: input.transaction_description.substring(0, 13),
    payment_method: input.payment_method ?? PAYMENT_METHOD,
    status: PaymentStatus.PENDING,
    notes: input.notes ?? null,
    merchantRequestId: null,
    checkoutRequestId: null,
    mpesaReceiptNumber: null,
    transactionDate: null,
    phoneNumber: null,
    failure_reason: null,
    daraja_response: null,
    daraja_callback: null,
  });

  console.log(`[Payment] Creating payment ${payment.id} for ${sanitizedPhone}`);

  try {
    const darajaResponse = await darajaService.initiateSTKPush(
      sanitizedPhone,
      input.amount,
      input.account_reference.substring(0, 12),
      input.transaction_description.substring(0, 13)
    );

    const merchantRequestId = darajaResponse?.MerchantRequestID;
    const checkoutRequestId = darajaResponse?.CheckoutRequestID;
    const responseCode = darajaResponse?.ResponseCode;
    const responseDescription = darajaResponse?.ResponseDescription;
    const customerMessage = darajaResponse?.CustomerMessage;

    paymentStore.update(payment.id, {
      merchantRequestId: typeof merchantRequestId === 'string' ? merchantRequestId : null,
      checkoutRequestId: typeof checkoutRequestId === 'string' ? checkoutRequestId : null,
      daraja_response: darajaResponse,
    });

    const code = typeof responseCode === 'string' ? responseCode : String(responseCode ?? '');
    if (code === '0') {
      paymentStore.update(payment.id, { status: PaymentStatus.PROCESSING });
      console.log(`[Payment] STK Push initiated for payment ${payment.id}`);
    } else {
      const reason =
        typeof responseDescription === 'string'
          ? responseDescription
          : typeof customerMessage === 'string'
            ? customerMessage
            : 'STK Push request rejected by Daraja';
      paymentStore.update(payment.id, { status: PaymentStatus.FAILED, failure_reason: reason });
      console.warn(`[Payment] STK Push rejected for ${payment.id}: ${reason}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during STK Push';
    paymentStore.update(payment.id, { status: PaymentStatus.FAILED, failure_reason: message });
    console.error(`[Payment] Failed to initiate STK Push for ${payment.id}`, err);
    throw err;
  }

  return paymentStore.findById(payment.id)!;
}

export async function queryPaymentStatus(input: QueryPaymentStatusInput): Promise<Payment> {
  const payment = paymentStore.findByCheckoutRequestId(input.checkoutRequestId);
  if (!payment) {
    throw new Error(`Payment with checkout request ID ${input.checkoutRequestId} not found`);
  }

  console.log(`[Payment] Querying status for payment ${payment.id}`);

  const statusResponse = await darajaService.querySTKPushStatus(input.checkoutRequestId);

  const resultCode = statusResponse?.ResultCode;
  const resultDesc = statusResponse?.ResultDesc;

  paymentStore.update(payment.id, {
    daraja_response: {
      ...(payment.daraja_response || {}),
      queryResponse: statusResponse,
    },
  });

  const code = typeof resultCode === 'string' ? resultCode : String(resultCode ?? '');
  if (code !== '0') {
    const description = typeof resultDesc === 'string' ? resultDesc : 'Unknown error';
    paymentStore.update(payment.id, { failure_reason: description });
    console.warn(`[Payment] Query failed for ${payment.id}: ${description}`);
  } else {
    console.log(`[Payment] Query successful for ${payment.id}`);
  }

  return paymentStore.findById(payment.id)!;
}

export function handleCallback(callbackData: unknown): Payment {
  const parsed = darajaService.parseCallback(callbackData);

  const merchantRequestId = parsed?.merchantRequestId;
  const checkoutRequestId = parsed?.checkoutRequestId;

  if (!merchantRequestId && !checkoutRequestId) {
    throw new Error('Callback missing merchantRequestId or checkoutRequestId');
  }

  const payment = merchantRequestId
    ? paymentStore.findByMerchantRequestId(String(merchantRequestId))
    : paymentStore.findByCheckoutRequestId(String(checkoutRequestId!));

  if (!payment) {
    console.warn(`[Payment] Callback for unknown payment: ${merchantRequestId || checkoutRequestId}`);
    throw new Error('Payment not found for callback');
  }

  console.log(`[Payment] Processing callback for payment ${payment.id}`);

  paymentStore.update(payment.id, {
    daraja_callback: parsed.raw as Record<string, unknown>,
  });

  const resultCode = parsed?.resultCode;
  const resultDesc = parsed?.resultDesc;
  const code = typeof resultCode === 'string' ? resultCode : String(resultCode ?? '');

  if (code === '0') {
    const updates: Partial<Payment> = { status: PaymentStatus.COMPLETED };

    const extractedFields = parsed?.extractedFields;
    if (extractedFields && typeof extractedFields === 'object') {
      const fields = extractedFields as Record<string, unknown>;
      if ('MpesaReceiptNumber' in fields) updates.mpesaReceiptNumber = String(fields.MpesaReceiptNumber ?? '');
      if ('TransactionDate' in fields) updates.transactionDate = String(fields.TransactionDate ?? '');
      if ('PhoneNumber' in fields) updates.phoneNumber = String(fields.PhoneNumber ?? '');
      if ('Amount' in fields) {
        const amount = fields.Amount;
        if (typeof amount === 'number') updates.amount = amount;
        else if (typeof amount === 'string') {
          const n = parseFloat(amount);
          if (!isNaN(n)) updates.amount = n;
        }
      }
    }

    paymentStore.update(payment.id, updates);
    console.log(`[Payment] Payment ${payment.id} completed`);
  } else {
    paymentStore.update(payment.id, {
      status: PaymentStatus.FAILED,
      failure_reason: typeof resultDesc === 'string' ? resultDesc : 'Payment failed',
    });
    console.warn(`[Payment] Payment ${payment.id} failed: ${resultDesc}`);
  }

  return paymentStore.findById(payment.id)!;
}

export function findPaymentById(id: string): Payment | null {
  return paymentStore.findById(id);
}

export function findAllPayments(query: {
  page?: string;
  perPage?: string;
  userId?: string;
  status?: string;
}): { data: Payment[]; meta: { total: number; page: number; perPage: number; totalPages: number } } {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(query.perPage) || 20));
  const status = query.status as PaymentStatus | undefined;

  const data = paymentStore.findAll({
    userId: query.userId,
    status: status && Object.values(PaymentStatus).includes(status) ? status : undefined,
    page,
    perPage,
  });
  const total = paymentStore.count({ userId: query.userId, status });
  const totalPages = Math.ceil(total / perPage);

  return {
    data,
    meta: { total, page, perPage, totalPages },
  };
}
