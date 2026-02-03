export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Payment {
  id: string;
  user_id: string | null;
  amount: number;
  phone_number: string;
  account_reference: string;
  transaction_description: string;
  payment_method: string;
  status: PaymentStatus;
  merchantRequestId: string | null;
  checkoutRequestId: string | null;
  mpesaReceiptNumber: string | null;
  transactionDate: string | null;
  phoneNumber: string | null;
  failure_reason: string | null;
  notes: string | null;
  daraja_response: Record<string, unknown> | null;
  daraja_callback: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentInput {
  phone_number: string;
  amount: number;
  account_reference: string;
  transaction_description: string;
  payment_method?: string;
  notes?: string;
}

export interface QueryPaymentStatusInput {
  checkoutRequestId: string;
}
