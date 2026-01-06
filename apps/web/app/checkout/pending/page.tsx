'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

type PaymentStatus = 'pending' | 'success' | 'failed' | 'expired' | 'conflict';

interface PaymentStatusResponse {
  success: boolean;
  data: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    booking: {
      id: string;
      bookingNumber: string;
      status: string;
      startAt: string;
      endAt: string;
    };
    lastTransaction: {
      status: string;
    } | null;
  };
}

export default function PaymentPendingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const intentId = searchParams.get('intentId');

  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [attempts, setAttempts] = useState(0);
  const [bookingNumber, setBookingNumber] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
  const pollInterval = 2000; // 2 seconds

  const pollStatus = useCallback(async () => {
    if (!intentId) {
      setErrorMessage('Missing payment reference');
      setStatus('failed');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/payments/${intentId}/status`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch payment status');
      }

      const data: PaymentStatusResponse = await response.json();

      if (data.data.booking) {
        setBookingNumber(data.data.booking.bookingNumber);
        setBookingId(data.data.booking.id);
      }

      // Check payment intent status
      const intentStatus = data.data.status;
      const bookingStatus = data.data.booking?.status;

      if (intentStatus === 'SUCCESS' || bookingStatus === 'CONFIRMED') {
        setStatus('success');
        // Redirect to success page after short delay
        setTimeout(() => {
          router.push(`/checkout/success?bookingId=${data.data.booking?.id}`);
        }, 1500);
        return;
      }

      if (intentStatus === 'FAILED') {
        setStatus('failed');
        return;
      }

      if (intentStatus === 'EXPIRED') {
        setStatus('expired');
        return;
      }

      if (intentStatus === 'LATE_SUCCESS_CONFLICT') {
        setStatus('conflict');
        setErrorMessage('Your payment was received but the slot is no longer available. A refund will be processed.');
        return;
      }

      // Still pending, continue polling
      setAttempts((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to poll payment status', error);
      setAttempts((prev) => prev + 1);
    }
  }, [intentId, router]);

  useEffect(() => {
    if (status === 'pending' && attempts < maxAttempts) {
      const timer = setTimeout(pollStatus, attempts === 0 ? 0 : pollInterval);
      return () => clearTimeout(timer);
    }
  }, [status, attempts, pollStatus, maxAttempts]);

  if (!intentId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Request</h1>
          <p className="text-gray-400 mb-6">No payment reference found.</p>
          <a
            href="/"
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {status === 'pending' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            {/* Animated loader */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-20 h-20 mx-auto mb-6"
            >
              <svg className="w-20 h-20 text-primary" fill="none" viewBox="0 0 24 24">
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
            <p className="text-gray-400 max-w-sm mx-auto">
              We're verifying your payment with the bank. This usually takes just a few seconds.
            </p>

            {attempts > 15 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-yellow-500 mt-6"
              >
                Taking longer than expected. Please don't close this window.
              </motion.p>
            )}

            {attempts > 30 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 p-4 bg-gray-900 rounded-lg"
              >
                <p className="text-sm text-gray-400">
                  If this takes too long, you can check your booking status in{' '}
                  <a href="/bookings" className="text-primary hover:underline">
                    My Bookings
                  </a>
                </p>
              </motion.div>
            )}

            <div className="mt-8 text-sm text-gray-500">
              Checking... ({attempts}/{maxAttempts})
            </div>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 mx-auto mb-6 bg-green-500 rounded-full flex items-center justify-center"
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>

            <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-400">
              Your booking has been confirmed.
              {bookingNumber && (
                <span className="block mt-2 text-primary font-mono">
                  Booking #{bookingNumber}
                </span>
              )}
            </p>

            <p className="text-sm text-gray-500 mt-4">Redirecting to confirmation...</p>
          </motion.div>
        )}

        {status === 'failed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 bg-red-500 rounded-full flex items-center justify-center">
              <XCircle className="w-12 h-12 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Payment Failed</h2>
            <p className="text-gray-400 mb-6">
              {errorMessage || 'Your payment could not be processed. Please try again.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {bookingId && (
                <a
                  href={`/checkout/${bookingId}`}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </a>
              )}
              <a
                href="/"
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Go Home
              </a>
            </div>
          </motion.div>
        )}

        {status === 'expired' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 bg-yellow-500 rounded-full flex items-center justify-center">
              <Clock className="w-12 h-12 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Session Expired</h2>
            <p className="text-gray-400 mb-6">
              Your payment window has expired. Please start a new booking.
            </p>

            <a
              href="/"
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Book Again
            </a>
          </motion.div>
        )}

        {status === 'conflict' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 bg-orange-500 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-12 h-12 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Slot No Longer Available</h2>
            <p className="text-gray-400 mb-6">
              {errorMessage || 'Your payment was received but the slot was booked by someone else. A refund will be processed automatically.'}
            </p>

            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-400">
                Refunds are typically processed within 5-7 business days. You will receive an email confirmation.
              </p>
            </div>

            <a
              href="/"
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Book Another Slot
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}
