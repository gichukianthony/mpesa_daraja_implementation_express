import { config } from '../config';

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export class DarajaService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private readonly baseUrl = config.baseUrl;
  private readonly consumerKey = config.mpesa.consumerKey;
  private readonly consumerSecret = config.mpesa.consumerSecret;
  private readonly passKey = config.mpesa.passKey;
  private readonly shortCode = config.mpesa.shortCode;
  private readonly callBackUrl = config.mpesa.callbackUrl;

  constructor() {
    console.log(`[Daraja] Initialized in ${config.mpesa.environment} mode`);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const authUrl = `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

    const raw = (await fetch(authUrl, {
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
    })) as FetchResponse;

    const text = await raw.text();
    let responseData: Record<string, unknown> | null = null;

    if (text?.trim().length > 0) {
      try {
        responseData = JSON.parse(text) as Record<string, unknown>;
      } catch {
        console.warn(`[Daraja] Auth returned non-JSON (status ${raw.status}). Body sample: ${text.slice(0, 200)}`);
      }
    }

    if (!raw.ok) {
      throw new Error(
        `Daraja auth failed (HTTP ${raw.status}). Check MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET. Body: ${text?.slice(0, 150) ?? 'empty'}`
      );
    }

    if (!responseData || typeof responseData !== 'object') {
      throw new Error(
        `Daraja auth returned empty or invalid JSON. Check MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET and MPESA_ENVIRONMENT.`
      );
    }

    const token = responseData?.access_token;
    const expiresIn = responseData?.expires_in;

    if (!token || typeof token !== 'string') {
      throw new Error('Access token not found in Daraja response');
    }

    const expiresInSeconds = typeof expiresIn === 'number' ? expiresIn : 3599;
    this.accessToken = token;
    this.tokenExpiry = new Date(Date.now() + (expiresInSeconds - 60) * 1000);

    console.log('[Daraja] Successfully obtained access token');
    return this.accessToken;
  }

  private generatePassword(): { password: string; timestamp: string } {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`).toString('base64');
    return { password, timestamp };
  }

  async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    transactionDesc: string
  ): Promise<Record<string, unknown>> {
    const sanitizedPhone = phoneNumber.replace(/^0/, '254').replace(/^\+/, '');
    if (!/^254\d{9}$/.test(sanitizedPhone)) {
      throw new Error('Invalid phone number format. Expected format: 254XXXXXXXXX');
    }

    if (amount <= 0 || amount > 70000) {
      throw new Error('Amount must be between 1 and 70,000 KES');
    }

    const accessToken = await this.getAccessToken();
    const { password, timestamp } = this.generatePassword();

    const stkUrl = `${this.baseUrl}/mpesa/stkpush/v1/processrequest`;

    const requestBody = {
      BusinessShortCode: this.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.floor(amount),
      PartyA: sanitizedPhone,
      PartyB: this.shortCode,
      PhoneNumber: sanitizedPhone,
      CallBackURL: this.callBackUrl,
      AccountReference: accountReference.substring(0, 12),
      TransactionDesc: transactionDesc.substring(0, 13),
    };

    console.log(`[Daraja] Initiating STK Push: ${amount} KES to ${sanitizedPhone}`);

    const raw = (await fetch(stkUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })) as FetchResponse;

    const text = await raw.text();
    let responseData: Record<string, unknown> | null = null;

    if (text?.trim().length > 0) {
      try {
        responseData = JSON.parse(text) as Record<string, unknown>;
      } catch {
        console.warn(`[Daraja] STK Push returned non-JSON (status ${raw.status}). Body: ${text.slice(0, 300)}`);
      }
    }

    if (!raw.ok) {
      const errBody = text?.slice(0, 200) ?? 'empty';
      throw new Error(
        `Daraja STK Push failed (HTTP ${raw.status}). Body: ${errBody}. Check MPESA_SHORT_CODE, MPESA_PASS_KEY, MPESA_CALLBACK_URL.`
      );
    }

    if (!responseData || typeof responseData !== 'object') {
      throw new Error(
        `Daraja STK Push returned empty or invalid JSON. Body: ${text?.slice(0, 200) ?? 'empty'}.`
      );
    }

    const errCode = responseData?.errorCode ?? responseData?.requestId;
    const errMsg = responseData?.errorMessage ?? responseData?.error_message;
    if (errCode != null || (typeof errMsg === 'string' && errMsg.length > 0)) {
      console.warn(
        `[Daraja] STK Push body indicates error: code=${String(errCode ?? '')} message=${String(errMsg ?? '')}`
      );
    }

    console.log('[Daraja] STK Push initiated successfully');
    return responseData as Record<string, unknown>;
  }

  async querySTKPushStatus(checkoutRequestId: string): Promise<Record<string, unknown>> {
    if (!checkoutRequestId || typeof checkoutRequestId !== 'string') {
      throw new Error('Checkout request ID is required');
    }

    const accessToken = await this.getAccessToken();
    const { password, timestamp } = this.generatePassword();

    const queryUrl = `${this.baseUrl}/mpesa/stkpushquery/v1/query`;

    const requestBody = {
      BusinessShortCode: this.shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    console.log(`[Daraja] Querying STK Push status for: ${checkoutRequestId}`);

    const raw = (await fetch(queryUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })) as FetchResponse;

    const text = await raw.text();
    let responseData: Record<string, unknown> | null = null;

    if (text?.trim().length > 0) {
      try {
        responseData = JSON.parse(text) as Record<string, unknown>;
      } catch {
        console.warn(`[Daraja] STK Query returned non-JSON (status ${raw.status}). Body: ${text.slice(0, 300)}`);
      }
    }

    if (!raw.ok) {
      throw new Error(
        `Daraja STK Query failed (HTTP ${raw.status}). Body: ${text?.slice(0, 200) ?? 'empty'}.`
      );
    }

    if (!responseData || typeof responseData !== 'object') {
      throw new Error(
        `Daraja STK Query returned empty or invalid JSON. Body: ${text?.slice(0, 200) ?? 'empty'}.`
      );
    }

    console.log('[Daraja] STK Push status queried successfully');
    return responseData as Record<string, unknown>;
  }

  parseCallback(callbackData: unknown): Record<string, unknown> {
    if (!callbackData || typeof callbackData !== 'object') {
      throw new Error('Invalid callback data format');
    }

    const data = callbackData as Record<string, unknown>;
    const result: Record<string, unknown> = { raw: data };

    if ('Body' in data && data.Body && typeof data.Body === 'object') {
      const body = data.Body as Record<string, unknown>;
      result.body = body;

      if ('stkCallback' in body && body.stkCallback && typeof body.stkCallback === 'object') {
        result.stkCallback = body.stkCallback;
        const stkCallback = body.stkCallback as Record<string, unknown>;

        if ('ResultCode' in stkCallback) result.resultCode = stkCallback.ResultCode;
        if ('ResultDesc' in stkCallback) result.resultDesc = stkCallback.ResultDesc;
        if ('MerchantRequestID' in stkCallback) result.merchantRequestId = stkCallback.MerchantRequestID;
        if ('CheckoutRequestID' in stkCallback) result.checkoutRequestId = stkCallback.CheckoutRequestID;

        if (
          'CallbackMetadata' in stkCallback &&
          stkCallback.CallbackMetadata &&
          typeof stkCallback.CallbackMetadata === 'object'
        ) {
          const metadata = stkCallback.CallbackMetadata as Record<string, unknown>;
          result.callbackMetadata = metadata;

          if ('Item' in metadata && Array.isArray(metadata.Item)) {
            const items = metadata.Item as unknown[];
            result.items = items;

            const extractedFields: Record<string, unknown> = {};
            items.forEach((item) => {
              if (item && typeof item === 'object') {
                const itemObj = item as Record<string, unknown>;
                const name = itemObj?.Name;
                const value = itemObj?.Value;
                if (typeof name === 'string' && value !== undefined) {
                  extractedFields[name] = value;
                }
              }
            });

            if (Object.keys(extractedFields).length > 0) {
              result.extractedFields = extractedFields;
            }
          }
        }
      }
    }

    return result;
  }
}

export const darajaService = new DarajaService();
