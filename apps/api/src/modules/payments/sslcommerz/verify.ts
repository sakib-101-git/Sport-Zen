import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('SSLCommerzVerify');

/**
 * SSLCommerz Webhook Signature Verification
 *
 * SSLCommerz sends an IPN (Instant Payment Notification) with these fields:
 * - verify_sign: MD5 hash signature
 * - verify_key: Comma-separated list of keys used in signature
 *
 * The signature is computed as: MD5(key1=val1&key2=val2&...&store_passwd=MD5(store_password))
 */

export interface SSLCommerzIPNPayload {
  tran_id: string;
  val_id: string;
  amount: string;
  card_type: string;
  store_amount: string;
  card_no: string;
  bank_tran_id: string;
  status: 'VALID' | 'FAILED' | 'CANCELLED' | 'UNATTEMPTED' | 'EXPIRED';
  tran_date: string;
  currency: string;
  card_issuer: string;
  card_brand: string;
  card_issuer_country: string;
  card_issuer_country_code: string;
  currency_type: string;
  currency_amount: string;
  currency_rate: string;
  base_fair: string;
  value_a?: string; // Custom field: paymentIntentId
  value_b?: string; // Custom field: bookingId
  value_c?: string;
  value_d?: string;
  verify_sign: string;
  verify_key: string;
  risk_level: string;
  risk_title: string;
  [key: string]: string | undefined;
}

export interface VerificationResult {
  isValid: boolean;
  error?: string;
  payload?: SSLCommerzIPNPayload;
}

/**
 * Verify SSLCommerz IPN signature
 *
 * @param payload - The IPN payload from SSLCommerz
 * @param storePassword - Your SSLCommerz store password
 * @returns VerificationResult
 */
export function verifySSLCommerzSignature(
  payload: SSLCommerzIPNPayload,
  storePassword: string,
): VerificationResult {
  try {
    if (!payload.verify_sign || !payload.verify_key) {
      return {
        isValid: false,
        error: 'Missing verify_sign or verify_key',
      };
    }

    // Get the keys used for signature verification
    const verifyKeys = payload.verify_key.split(',');

    // Build the signature string
    const signatureData: string[] = [];
    for (const key of verifyKeys) {
      const trimmedKey = key.trim();
      if (payload[trimmedKey] !== undefined) {
        signatureData.push(`${trimmedKey}=${payload[trimmedKey]}`);
      }
    }

    // Add store_passwd (MD5 hashed)
    const hashedStorePassword = crypto
      .createHash('md5')
      .update(storePassword)
      .digest('hex');
    signatureData.push(`store_passwd=${hashedStorePassword}`);

    // Join with & and compute MD5
    const signatureString = signatureData.join('&');
    const computedSignature = crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex');

    const isValid = computedSignature === payload.verify_sign;

    if (!isValid) {
      logger.warn('Signature mismatch', {
        computed: computedSignature,
        received: payload.verify_sign,
        tran_id: payload.tran_id,
      });
    }

    return {
      isValid,
      error: isValid ? undefined : 'Signature verification failed',
      payload: isValid ? payload : undefined,
    };
  } catch (error) {
    logger.error('Signature verification error', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

/**
 * Validate IPN payload has required fields
 * Also aliased as validateSSLCommerzResponse for webhook handler compatibility
 */
export function validateIPNPayload(payload: any): payload is SSLCommerzIPNPayload {
  const requiredFields = ['tran_id', 'val_id', 'amount', 'status'];

  for (const field of requiredFields) {
    if (!payload[field]) {
      logger.warn(`Missing required field: ${field}`);
      return false;
    }
  }

  const validStatuses = ['VALID', 'FAILED', 'CANCELLED', 'UNATTEMPTED', 'EXPIRED'];
  if (!validStatuses.includes(payload.status)) {
    logger.warn(`Invalid status: ${payload.status}`);
    return false;
  }

  return true;
}

/**
 * Verify payment amount matches expected amount
 */
export function verifyAmount(
  receivedAmount: string,
  expectedAmount: number,
  tolerance: number = 0.01,
): boolean {
  const received = parseFloat(receivedAmount);
  const diff = Math.abs(received - expectedAmount);

  if (diff > tolerance) {
    logger.warn('Amount mismatch', {
      received,
      expected: expectedAmount,
      difference: diff,
    });
    return false;
  }

  return true;
}

/**
 * Check if this is a sandbox/test transaction
 */
export function isSandboxTransaction(payload: SSLCommerzIPNPayload): boolean {
  // SSLCommerz sandbox transactions have specific patterns
  return (
    payload.tran_id?.startsWith('TEST') ||
    payload.card_type === 'TESTCARD' ||
    payload.bank_tran_id?.includes('TEST')
  );
}

/**
 * Parse custom values from IPN payload
 */
export function parseCustomValues(payload: SSLCommerzIPNPayload): {
  paymentIntentId: string | null;
  bookingId: string | null;
  metadata: Record<string, string>;
} {
  return {
    paymentIntentId: payload.value_a || null,
    bookingId: payload.value_b || null,
    metadata: {
      value_c: payload.value_c || '',
      value_d: payload.value_d || '',
    },
  };
}

/**
 * Validate SSLCommerz webhook response
 * Returns validation result with isValid flag and optional error
 */
export function validateSSLCommerzResponse(payload: any): { isValid: boolean; error?: string } {
  if (!payload) {
    return { isValid: false, error: 'Empty payload' };
  }

  const requiredFields = ['tran_id', 'val_id', 'amount', 'status'];

  for (const field of requiredFields) {
    if (!payload[field]) {
      return { isValid: false, error: `Missing required field: ${field}` };
    }
  }

  const validStatuses = ['VALID', 'VALIDATED', 'FAILED', 'CANCELLED', 'UNATTEMPTED', 'EXPIRED'];
  if (!validStatuses.includes(payload.status)) {
    return { isValid: false, error: `Invalid status: ${payload.status}` };
  }

  return { isValid: true };
}
