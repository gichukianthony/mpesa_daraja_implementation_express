import { Payment, PaymentStatus } from '../types/payment.types';

const payments = new Map<string, Payment>();

function generateId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

export const paymentStore = {
  create(data: Omit<Payment, 'id' | 'created_at' | 'updated_at'>): Payment {
    const id = generateId();
    const payment: Payment = {
      ...data,
      id,
      created_at: now(),
      updated_at: now(),
    };
    payments.set(id, payment);
    return payment;
  },

  update(id: string, updates: Partial<Payment>): Payment | null {
    const existing = payments.get(id);
    if (!existing) return null;
    const updated: Payment = { ...existing, ...updates, updated_at: now() };
    payments.set(id, updated);
    return updated;
  },

  findById(id: string): Payment | null {
    return payments.get(id) ?? null;
  },

  findByCheckoutRequestId(checkoutRequestId: string): Payment | null {
    for (const p of payments.values()) {
      if (p.checkoutRequestId === checkoutRequestId) return p;
    }
    return null;
  },

  findByMerchantRequestId(merchantRequestId: string): Payment | null {
    for (const p of payments.values()) {
      if (p.merchantRequestId === merchantRequestId) return p;
    }
    return null;
  },

  findAll(options: { userId?: string; status?: PaymentStatus; page?: number; perPage?: number }): Payment[] {
    let list = Array.from(payments.values());
    if (options.userId) list = list.filter((p) => p.user_id === options.userId);
    if (options.status) list = list.filter((p) => p.status === options.status);
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const page = Math.max(1, options.page ?? 1);
    const perPage = Math.min(100, Math.max(1, options.perPage ?? 20));
    const skip = (page - 1) * perPage;
    return list.slice(skip, skip + perPage);
  },

  count(options?: { userId?: string; status?: PaymentStatus }): number {
    let list = Array.from(payments.values());
    if (options?.userId) list = list.filter((p) => p.user_id === options.userId);
    if (options?.status) list = list.filter((p) => p.status === options.status);
    return list.length;
  },
};
