'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export interface SSLCommerzFormProps {
  gatewayUrl: string;
  formFields?: Record<string, string>;
  autoSubmit?: boolean;
  onSubmitting?: () => void;
}

/**
 * SSLCommerz POST Form Component
 * Creates an auto-submitting hidden form for SSLCommerz redirect
 * This is required because SSLCommerz uses POST-based redirects
 */
export function SSLCommerzPostForm({
  gatewayUrl,
  formFields = {},
  autoSubmit = true,
  onSubmitting,
}: SSLCommerzFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoSubmit && formRef.current && gatewayUrl) {
      // Small delay to ensure form is fully rendered
      const timer = setTimeout(() => {
        try {
          setIsSubmitting(true);
          onSubmitting?.();
          formRef.current?.submit();
        } catch (err) {
          setError('Failed to redirect to payment gateway');
          setIsSubmitting(false);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [autoSubmit, gatewayUrl, onSubmitting]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="text-red-500 text-lg mb-4">{error}</div>
        <button
          onClick={() => formRef.current?.submit()}
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Retry Payment
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px]">
      {/* Loading State */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 mx-auto mb-6"
        >
          <Loader2 className="w-16 h-16 text-primary" />
        </motion.div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Redirecting to Payment Gateway
        </h3>
        <p className="text-gray-400">
          Please wait while we connect you to SSLCommerz...
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Do not close this window or press back
        </p>
      </motion.div>

      {/* Hidden POST Form */}
      <form
        ref={formRef}
        method="POST"
        action={gatewayUrl}
        className="hidden"
        data-testid="sslcommerz-form"
      >
        {Object.entries(formFields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      </form>

      {/* Manual Submit Button (fallback) */}
      {!isSubmitting && (
        <button
          onClick={() => {
            setIsSubmitting(true);
            formRef.current?.submit();
          }}
          className="mt-8 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Proceed to Payment
        </button>
      )}
    </div>
  );
}

/**
 * Payment Status Pending Component
 * Shown on return from SSLCommerz while waiting for webhook confirmation
 */
export function PaymentPendingStatus({
  bookingId,
  paymentIntentId,
}: {
  bookingId: string;
  paymentIntentId: string;
}) {
  const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/payments/${paymentIntentId}/status`);
        const data = await response.json();

        if (data.status === 'SUCCESS' || data.bookingStatus === 'CONFIRMED') {
          setStatus('success');
          // Redirect to success page
          window.location.href = `/checkout/success?bookingId=${bookingId}`;
          return;
        }

        if (data.status === 'FAILED' || data.status === 'EXPIRED') {
          setStatus('failed');
          window.location.href = `/checkout/failed?bookingId=${bookingId}`;
          return;
        }

        // Still pending, continue polling
        setAttempts((prev) => prev + 1);
        if (attempts < maxAttempts) {
          setTimeout(pollStatus, 2000);
        } else {
          // Max attempts reached, still show pending but stop polling
          setStatus('pending');
        }
      } catch (error) {
        console.error('Failed to poll payment status', error);
        setAttempts((prev) => prev + 1);
        if (attempts < maxAttempts) {
          setTimeout(pollStatus, 2000);
        }
      }
    };

    pollStatus();
  }, [bookingId, paymentIntentId, attempts]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-20 h-20 mx-auto mb-6"
      >
        <svg
          className="w-20 h-20 text-primary"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </motion.div>

      <h2 className="text-2xl font-bold text-white mb-2">
        Confirming Your Payment
      </h2>
      <p className="text-gray-400 max-w-md">
        We're verifying your payment with the bank. This usually takes just a few seconds.
      </p>

      {attempts > 10 && (
        <p className="text-sm text-yellow-500 mt-4">
          Taking longer than expected. Please don't close this window.
        </p>
      )}

      <div className="mt-8 text-sm text-gray-500">
        Attempt {attempts} of {maxAttempts}
      </div>
    </div>
  );
}
