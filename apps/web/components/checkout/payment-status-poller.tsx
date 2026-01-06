'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api/client';

interface PaymentStatusPollerProps {
  paymentIntentId: string;
  bookingId: string;
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
  maxAttempts?: number;
  pollInterval?: number;
}

type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'LATE_SUCCESS_CONFLICT';

interface PaymentStatusResponse {
  status: PaymentStatus;
  booking?: {
    id: string;
    status: string;
    bookingNumber: string;
  };
  message?: string;
}

export function PaymentStatusPoller({
  paymentIntentId,
  bookingId,
  onSuccess,
  onFailure,
  maxAttempts = 60,
  pollInterval = 3000,
}: PaymentStatusPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>('PENDING');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [bookingNumber, setBookingNumber] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const response = await api.getPaymentStatus(paymentIntentId);
      const data = response.data as PaymentStatusResponse;

      setStatus(data.status);

      if (data.booking?.bookingNumber) {
        setBookingNumber(data.booking.bookingNumber);
      }

      if (data.status === 'SUCCESS') {
        onSuccess?.();
        // Redirect to booking details after short delay
        setTimeout(() => {
          router.push(`/bookings/${bookingId}`);
        }, 2000);
        return true; // Stop polling
      }

      if (data.status === 'FAILED' || data.status === 'EXPIRED') {
        const errorMessage = data.message || 'Payment failed';
        setError(errorMessage);
        onFailure?.(errorMessage);
        return true; // Stop polling
      }

      if (data.status === 'LATE_SUCCESS_CONFLICT') {
        setError('The slot was booked by someone else. A refund has been initiated.');
        return true; // Stop polling
      }

      return false; // Continue polling
    } catch (err: any) {
      console.error('Failed to check payment status:', err);
      // Don't stop polling on network errors
      return false;
    }
  }, [paymentIntentId, bookingId, router, onSuccess, onFailure]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('Payment verification timed out. Please check your bookings.');
        onFailure?.('Timeout');
        return;
      }

      const shouldStop = await checkStatus();
      if (!shouldStop) {
        setAttempts((prev) => prev + 1);
        timeoutId = setTimeout(poll, pollInterval);
      }
    };

    poll();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [checkStatus, attempts, maxAttempts, pollInterval, onFailure]);

  const getStatusDisplay = () => {
    switch (status) {
      case 'SUCCESS':
        return {
          icon: <CheckCircle className="w-16 h-16 text-green-500" />,
          title: 'Payment Successful!',
          message: bookingNumber
            ? `Your booking #${bookingNumber} has been confirmed.`
            : 'Your booking has been confirmed.',
          color: 'text-green-500',
        };
      case 'FAILED':
        return {
          icon: <XCircle className="w-16 h-16 text-red-500" />,
          title: 'Payment Failed',
          message: error || 'Your payment could not be processed.',
          color: 'text-red-500',
        };
      case 'EXPIRED':
        return {
          icon: <Clock className="w-16 h-16 text-yellow-500" />,
          title: 'Session Expired',
          message: 'Your booking hold has expired. Please try again.',
          color: 'text-yellow-500',
        };
      case 'LATE_SUCCESS_CONFLICT':
        return {
          icon: <AlertTriangle className="w-16 h-16 text-orange-500" />,
          title: 'Slot No Longer Available',
          message: error || 'The slot was booked by someone else. A refund has been initiated.',
          color: 'text-orange-500',
        };
      case 'PENDING':
      default:
        return {
          icon: (
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-16 h-16 text-primary" />
              </motion.div>
            </div>
          ),
          title: 'Verifying Payment',
          message: 'Please wait while we confirm your payment...',
          color: 'text-primary',
        };
    }
  };

  const display = getStatusDisplay();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          {display.icon}
        </motion.div>

        <h2 className={`text-2xl font-bold mb-2 ${display.color}`}>
          {display.title}
        </h2>

        <p className="text-gray-400 mb-6">{display.message}</p>

        {status === 'PENDING' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span>Do not close this page</span>
            </div>

            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min((attempts / maxAttempts) * 100, 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}

        {status === 'SUCCESS' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-gray-500">Redirecting to your booking...</p>
          </motion.div>
        )}

        {(status === 'FAILED' || status === 'EXPIRED' || status === 'LATE_SUCCESS_CONFLICT') && (
          <div className="space-y-3">
            <button
              onClick={() => router.push('/turfs')}
              className="w-full py-3 bg-primary text-black rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Browse Facilities
            </button>
            <button
              onClick={() => router.push('/bookings')}
              className="w-full py-3 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800 transition-colors"
            >
              View My Bookings
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
