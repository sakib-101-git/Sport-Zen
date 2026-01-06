'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  CheckCircle,
  MapPin,
  Clock,
  Calendar,
  Download,
  Share2,
  QrCode,
} from 'lucide-react';
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
  status: string;
  qrToken: string;
}

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');

  const { data: booking, isLoading, error } = useQuery<{ success: boolean; data: BookingDetails }>({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/bookings/${bookingId}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch booking');
      return res.json();
    },
    enabled: !!bookingId,
  });

  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Request</h1>
          <p className="text-gray-400 mb-6">No booking reference found.</p>
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-gray-800 rounded-full mx-auto mb-4" />
          <div className="h-6 bg-gray-800 rounded w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (error || !booking?.data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Booking Not Found</h1>
          <p className="text-gray-400 mb-6">We couldn't find your booking details.</p>
          <a
            href="/bookings"
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            View My Bookings
          </a>
        </div>
      </div>
    );
  }

  const { data: bookingData } = booking;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-lg mx-auto px-4">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-6 bg-green-500 rounded-full flex items-center justify-center"
          >
            <CheckCircle className="w-12 h-12 text-white" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h1>
          <p className="text-gray-400">
            Your slot has been successfully booked
          </p>
        </motion.div>

        {/* Booking Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900 rounded-xl overflow-hidden mb-6"
        >
          {/* Header with booking number */}
          <div className="bg-primary/20 p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Booking Number</p>
                <p className="text-lg font-mono font-bold text-primary">
                  {bookingData.bookingNumber}
                </p>
              </div>
              <div className="px-3 py-1 bg-green-500/20 rounded-full">
                <span className="text-sm font-medium text-green-500">CONFIRMED</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-white font-medium">
                  {bookingData.playArea.facility.name}
                </div>
                <div className="text-sm text-gray-400">
                  {bookingData.playArea.name} | {bookingData.sportProfile.sportType.name}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {bookingData.playArea.facility.address}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div className="text-white">
                {format(new Date(bookingData.startAt), 'EEEE, MMMM d, yyyy')}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div className="text-white">
                {format(new Date(bookingData.startAt), 'h:mm a')} -{' '}
                {format(new Date(bookingData.endAt), 'h:mm a')}
                <span className="text-gray-400 ml-2">
                  ({bookingData.durationMinutes} mins)
                </span>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="border-t border-gray-800 pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-gray-400">
                <span>Advance Paid</span>
                <span className="text-green-500">{formatAmount(bookingData.advanceAmount)}</span>
              </div>
              <div className="flex justify-between text-white font-medium">
                <span>Due at Venue</span>
                <span>{formatAmount(bookingData.totalAmount - bookingData.advanceAmount)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* QR Code Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900 rounded-xl p-6 mb-6 text-center"
        >
          <QrCode className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Check-in QR Code</h3>
          <p className="text-sm text-gray-400 mb-4">
            Show this at the venue to verify your booking
          </p>
          <a
            href={`/bookings/${bookingData.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <QrCode className="w-4 h-4" />
            View QR Code
          </a>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <a
            href="/bookings"
            className="flex-1 py-3 px-4 bg-gray-800 text-white rounded-lg text-center hover:bg-gray-700 transition-colors"
          >
            View My Bookings
          </a>
          <a
            href="/"
            className="flex-1 py-3 px-4 bg-primary text-white rounded-lg text-center hover:bg-primary/90 transition-colors"
          >
            Book Another
          </a>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 p-4 bg-gray-900/50 rounded-lg"
        >
          <h4 className="font-medium text-white mb-2">What's Next?</h4>
          <ul className="text-sm text-gray-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Arrive 10-15 minutes before your slot time
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Show your QR code at the venue for check-in
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Pay the remaining balance ({formatAmount(bookingData.totalAmount - bookingData.advanceAmount)}) at the venue
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
