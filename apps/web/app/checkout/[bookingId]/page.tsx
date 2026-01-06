'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  MapPin,
  Clock,
  CreditCard,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { SSLCommerzPostForm } from '@/components/checkout/sslcommerz-post-form';
import { formatAmount } from '@/lib/utils/money';

interface BookingDetails {
  id: string;
  bookingNumber: string;
  playArea: {
    name: string;
    facility: {
      name: string;
      address: string;
    };
  };
  sportProfile: {
    sportType: {
      name: string;
    };
  };
  startAt: string;
  endAt: string;
  durationMinutes: number;
  totalAmount: number;
  advanceAmount: number;
  isPeakPricing: boolean;
  status: string;
  holdExpiresAt: string;
}

interface PaymentInitResponse {
  gatewayUrl: string;
  sessionKey: string;
  tranId: string;
  formFields: Record<string, string>;
}

export default function CheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId as string;

  const [step, setStep] = useState<'summary' | 'payment' | 'redirecting'>('summary');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch booking details
  const { data: booking, isLoading, error } = useQuery<BookingDetails>({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/bookings/${bookingId}`);
      if (!res.ok) throw new Error('Failed to fetch booking');
      return res.json();
    },
    refetchInterval: (data) => {
      // Stop refetching if hold expired or not in HOLD status
      if (!data || data.status !== 'HOLD') return false;
      return 5000; // Refetch every 5 seconds
    },
  });

  // Initialize payment mutation
  const initPaymentMutation = useMutation({
    mutationFn: async (): Promise<PaymentInitResponse> => {
      const res = await fetch('/api/v1/payments/sslcommerz/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          customerInfo,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to initialize payment');
      }
      return res.json();
    },
    onSuccess: () => {
      setStep('redirecting');
    },
  });

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!customerInfo.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!customerInfo.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (!/^01[3-9]\d{8}$/.test(customerInfo.phone)) {
      newErrors.phone = 'Enter a valid Bangladeshi phone number';
    }
    if (customerInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProceedToPayment = () => {
    if (!validateForm()) return;
    initPaymentMutation.mutate();
  };

  // Check for hold expiry
  const holdExpiresAt = booking?.holdExpiresAt ? new Date(booking.holdExpiresAt) : null;
  const isHoldExpired = holdExpiresAt ? holdExpiresAt < new Date() : false;
  const timeRemaining = holdExpiresAt
    ? Math.max(0, Math.floor((holdExpiresAt.getTime() - Date.now()) / 1000))
    : 0;

  // Loading state
  if (isLoading) {
    return <CheckoutSkeleton />;
  }

  // Error state
  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Booking Not Found</h1>
          <p className="text-gray-400">This booking doesn't exist or has expired.</p>
        </div>
      </div>
    );
  }

  // Hold expired state
  if (isHoldExpired || booking.status !== 'HOLD') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Session Expired</h1>
          <p className="text-gray-400 mb-6">
            Your booking hold has expired. Please start a new booking.
          </p>
          <a
            href={`/turfs/${booking.playArea.facility.name}`}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Book Again
          </a>
        </div>
      </div>
    );
  }

  // Redirecting state
  if (step === 'redirecting' && initPaymentMutation.data) {
    return (
      <SSLCommerzPostForm
        gatewayUrl={initPaymentMutation.data.gatewayUrl}
        formFields={initPaymentMutation.data.formFields}
        autoSubmit={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Complete Your Booking</h1>
          <p className="text-gray-400 mt-1">
            Pay {formatAmount(booking.advanceAmount)} to confirm
          </p>
        </div>

        {/* Timer Warning */}
        {timeRemaining > 0 && timeRemaining < 300 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <span className="text-yellow-500 font-medium">
                Hurry! Your hold expires in {Math.floor(timeRemaining / 60)}:
                {(timeRemaining % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </motion.div>
        )}

        {/* Booking Summary */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Booking Summary</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-white font-medium">
                  {booking.playArea.facility.name}
                </div>
                <div className="text-sm text-gray-400">
                  {booking.playArea.name} | {booking.sportProfile.sportType.name}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div className="text-white">
                {format(new Date(booking.startAt), 'EEEE, MMMM d, yyyy')}
                <br />
                <span className="text-gray-400">
                  {format(new Date(booking.startAt), 'h:mm a')} -{' '}
                  {format(new Date(booking.endAt), 'h:mm a')}
                  ({booking.durationMinutes} mins)
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-gray-400">
              <span>Booking Total</span>
              <span>{formatAmount(booking.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-white font-semibold text-lg">
              <span>Pay Now (10% Advance)</span>
              <span className="text-primary">{formatAmount(booking.advanceAmount)}</span>
            </div>
            <div className="flex justify-between text-gray-400 text-sm">
              <span>Remaining (Pay at Venue)</span>
              <span>{formatAmount(booking.totalAmount - booking.advanceAmount)}</span>
            </div>
          </div>

          {booking.isPeakPricing && (
            <div className="mt-4 bg-yellow-500/10 rounded-lg p-3 flex items-center gap-2">
              <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">
                PEAK
              </span>
              <span className="text-sm text-yellow-500">
                Peak hour pricing applied
              </span>
            </div>
          )}
        </div>

        {/* Customer Info Form */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Your Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder="Enter your name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.phone ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder="01XXXXXXXXX"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Email (Optional)
              </label>
              <input
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder="your@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Payment Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleProceedToPayment}
          disabled={initPaymentMutation.isPending}
          className="w-full py-4 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initPaymentMutation.isPending ? (
            <>
              <span className="animate-spin">...</span>
              Initializing Payment...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pay {formatAmount(booking.advanceAmount)}
            </>
          )}
        </motion.button>

        {initPaymentMutation.error && (
          <p className="mt-4 text-center text-red-500">
            {initPaymentMutation.error.message}
          </p>
        )}

        {/* Terms */}
        <p className="mt-4 text-center text-xs text-gray-500">
          By proceeding, you agree to our{' '}
          <a href="/legal/terms" className="text-primary hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/legal/privacy" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="min-h-screen bg-background py-8 animate-pulse">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        <div className="h-8 bg-gray-800 rounded w-64 mx-auto" />
        <div className="bg-gray-900 rounded-xl p-6 space-y-4">
          <div className="h-6 bg-gray-800 rounded w-40" />
          <div className="h-20 bg-gray-800 rounded" />
        </div>
        <div className="bg-gray-900 rounded-xl p-6 space-y-4">
          <div className="h-6 bg-gray-800 rounded w-32" />
          <div className="h-12 bg-gray-800 rounded" />
          <div className="h-12 bg-gray-800 rounded" />
        </div>
        <div className="h-14 bg-gray-800 rounded-xl" />
      </div>
    </div>
  );
}
