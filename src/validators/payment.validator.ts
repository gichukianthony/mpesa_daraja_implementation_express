import { z } from 'zod';

const phoneRegex = /^(\+?254|0)?[17]\d{8}$/;

export const createPaymentSchema = z.object({
  phone_number: z
    .string()
    .min(1, 'phone_number is required')
    .refine((val) => phoneRegex.test(val), {
      message: 'Invalid phone number. Use 254XXXXXXXXX or 07XXXXXXXX',
    }),
  amount: z
    .number()
    .refine((val) => Number.isInteger(val), { message: 'amount must be a whole number' })
    .min(1, { message: 'amount must be at least 1 KES' })
    .max(70000, { message: 'amount must be at most 70,000 KES' }),
  account_reference: z
    .string()
    .min(1, 'account_reference is required')
    .max(12, 'account_reference max 12 characters'),
  transaction_description: z
    .string()
    .min(1, 'transaction_description is required')
    .max(13, 'transaction_description is required')
    .max(13, 'transaction_description max 13 characters'),
  notes: z.string().max(500).optional(),
});

export const queryPaymentStatusSchema = z.object({
  checkoutRequestId: z.string().min(1, 'checkoutRequestId is required'),
});

export type CreatePaymentBody = z.infer<typeof createPaymentSchema>;
export type QueryPaymentStatusBody = z.infer<typeof queryPaymentStatusSchema>;
