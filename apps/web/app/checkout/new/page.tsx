'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api/client';

/**
 * Checkout New Page
 *
 * This page receives booking parameters from the turf detail page,
 * creates a booking hold, and redirects to the checkout page.
 *
 * Query params:
 * - playAreaId: UUID
 * - sportProfileId: UUID
 * - startAt: ISO date string
 * - duration: number (minutes)
 */
export default function CheckoutNewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const createHold = async () => {
      try {
        // Get params from URL
        const playAreaId = searchParams.get('playAreaId');
        const sportProfileId = searchParams.get('sportProfileId');
        const startAt = searchParams.get('startAt');
        const duration = searchParams.get('duration');

        // Validate params
        if (!playAreaId || !sportProfileId || !startAt || !duration) {
          setErrorMessage('Missing booking parameters. Please try again from the turf page.');
          setStatus('error');
          return;
        }

        // Check if user is logged in
        const token = api.getToken();
        if (!token) {
          // Save booking intent to session storage for post-login redirect
          sessionStorage.setItem('pendingBooking', JSON.stringify({
            playAreaId,
            sportProfileId,
            startAt,
            duration,
          }));
          // Redirect to login
          router.push(`/auth/login?redirect=${encodeURIComponent(window.location.href)}`);
          return;
        }

        // Get user info for the hold
        const meResponse = await api.getMe();
        const user = meResponse.data;

        // Create the hold
        const response = await api.createHold({
          playAreaId,
          sportProfileId,
          startAt,
          durationMinutes: parseInt(duration, 10),
          playerName: user.name || 'Guest',
          playerPhone: user.phone || '',
          playerEmail: user.email,
        });

        if (response.success && response.data) {
          // Redirect to checkout page with booking ID
          router.replace(`/checkout/${response.data.bookingId}`);
        } else {
          throw new Error('Failed to create booking hold');
        }
      } catch (error: any) {
        console.error('Failed to create hold:', error);

        // Handle specific error codes
        if (error.error?.code === 'CONFLICT' || error.message?.includes('no longer available')) {
          setErrorMessage('This time slot is no longer available. Please select another time.');
        } else if (error.error?.code === 'UNAUTHORIZED' || error.status === 401) {
          // Token expired, redirect to login
          sessionStorage.setItem('pendingBooking', JSON.stringify({
            playAreaId: searchParams.get('playAreaId'),
            sportProfileId: searchParams.get('sportProfileId'),
            startAt: searchParams.get('startAt'),
            duration: searchParams.get('duration'),
          }));
          router.push(`/auth/login?redirect=${encodeURIComponent(window.location.href)}`);
          return;
        } else if (error.error?.code === 'RATE_LIMIT') {
          setErrorMessage('Too many booking attempts. Please wait a moment and try again.');
        } else {
          setErrorMessage(error.error?.message || error.message || 'Failed to create booking. Please try again.');
        }

        setStatus('error');
      }
    };

    createHold();
  }, [searchParams, router]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Booking Failed
          </h1>
          <p className="text-gray-400 mb-6">
            {errorMessage}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go Back
            </button>
            <a
              href="/"
              className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Browse Turfs
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center"
      >
        <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
        <h2 className="text-xl font-semibold text-white mb-2">
          Securing Your Slot
        </h2>
        <p className="text-gray-400">
          Please wait while we hold this time for you...
        </p>
      </motion.div>
    </div>
  );
}
