'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import QRCode from 'react-qr-code';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Calendar,
  Phone,
  QrCode,
  AlertCircle,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Star,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';
import { formatTimeRange, getDateLabel, getCancellationTier, isCheckInWindowOpen } from '@/lib/utils/dates';

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  HOLD: { color: 'bg-yellow-500/20 text-yellow-500', label: 'Pending Payment', icon: Clock },
  CONFIRMED: { color: 'bg-primary/20 text-primary', label: 'Confirmed', icon: CheckCircle },
  COMPLETED: { color: 'bg-green-500/20 text-green-500', label: 'Completed', icon: CheckCircle },
  CANCELED: { color: 'bg-red-500/20 text-red-500', label: 'Cancelled', icon: XCircle },
  EXPIRED: { color: 'bg-gray-500/20 text-gray-400', label: 'Expired', icon: AlertCircle },
};

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const bookingId = params.bookingId as string;

  const [showQR, setShowQR] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch booking details
  const { data, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const response = await api.getBooking(bookingId);
      return response.data;
    },
  });

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      return api.cancelBooking(bookingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      setShowCancelModal(false);
    },
  });

  const booking = data;

  // Copy booking number
  const handleCopyBookingNumber = async () => {
    if (booking?.bookingNumber) {
      await navigator.clipboard.writeText(booking.bookingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Get cancellation info
  const cancellationTier = booking?.startAt ? getCancellationTier(booking.startAt) : 'none';
  const canCancel = booking?.status === 'CONFIRMED' && cancellationTier !== 'none';
  const checkInOpen = booking ? isCheckInWindowOpen(booking.startAt, booking.endAt) : false;

  // Loading state
  if (isLoading) {
    return <BookingDetailSkeleton />;
  }

  // Error state
  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Booking Not Found</h1>
          <p className="text-gray-400 mb-6">This booking doesn't exist or you don't have access.</p>
          <Link
            href="/bookings"
            className="px-6 py-3 bg-primary text-black rounded-lg hover:bg-primary/90"
          >
            View My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[booking.status]?.icon || AlertCircle;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">Booking Details</h1>
            <p className="text-sm text-gray-400">#{booking.bookingNumber}</p>
          </div>
          <button
            onClick={handleCopyBookingNumber}
            className="p-2 text-gray-400 hover:text-white"
          >
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Status Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 p-4 rounded-xl ${statusConfig[booking.status]?.color || 'bg-gray-800'}`}
        >
          <StatusIcon className="w-6 h-6" />
          <div>
            <p className="font-semibold">{statusConfig[booking.status]?.label || booking.status}</p>
            {booking.status === 'CONFIRMED' && (
              <p className="text-sm opacity-80">
                {checkInOpen ? 'Check-in window is open' : `Check-in opens 30 mins before start`}
              </p>
            )}
          </div>
        </motion.div>

        {/* QR Code Section (for confirmed bookings) */}
        {booking.status === 'CONFIRMED' && booking.qrToken && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-white">Check-in QR Code</h2>
              </div>
              <button
                onClick={() => setShowQR(!showQR)}
                className="text-sm text-primary hover:underline"
              >
                {showQR ? 'Hide' : 'Show'}
              </button>
            </div>

            <AnimatePresence>
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-4 rounded-xl">
                      <QRCode
                        value={booking.qrToken}
                        size={200}
                        level="H"
                      />
                    </div>
                    <p className="text-sm text-gray-400 mt-4 text-center">
                      Show this QR code at the venue for check-in
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showQR && (
              <p className="text-sm text-gray-400">
                Tap "Show" to reveal your check-in QR code
              </p>
            )}
          </motion.div>
        )}

        {/* Venue Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Venue</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-white">
                  {booking.playArea?.facility?.name || 'Unknown Facility'}
                </p>
                <p className="text-sm text-gray-400">
                  {booking.playArea?.name} • {booking.sportProfile?.sportType?.name}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {booking.playArea?.facility?.address}
                </p>
              </div>
            </div>

            {booking.playArea?.facility?.contactPhone && (
              <a
                href={`tel:${booking.playArea.facility.contactPhone}`}
                className="flex items-center gap-3 text-primary hover:underline"
              >
                <Phone className="w-5 h-5" />
                <span>{booking.playArea.facility.contactPhone}</span>
              </a>
            )}
          </div>
        </motion.div>

        {/* Date & Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Schedule</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-white">{getDateLabel(booking.startAt)}</p>
                <p className="text-sm text-gray-400">
                  {format(new Date(booking.startAt), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-white">{formatTimeRange(booking.startAt, booking.endAt)}</p>
                <p className="text-sm text-gray-400">{booking.durationMinutes} minutes</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Payment Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Payment</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Booking Total</span>
              <span className="text-white">{formatAmount(booking.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Advance Paid</span>
              <span className="text-green-500">{formatAmount(booking.advanceAmount)}</span>
            </div>
            <div className="border-t border-gray-800 pt-3 flex justify-between">
              <span className="text-gray-400">
                {booking.paymentStage === 'FULL_PAID_OFFLINE' ? 'Remaining' : 'Due at Venue'}
              </span>
              <span className="font-semibold text-white">
                {booking.paymentStage === 'FULL_PAID_OFFLINE'
                  ? formatAmount(0)
                  : formatAmount(booking.totalAmount - booking.advanceAmount)
                }
              </span>
            </div>
            {booking.isPeakPricing && (
              <div className="bg-yellow-500/10 rounded-lg p-3 flex items-center gap-2 mt-2">
                <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">PEAK</span>
                <span className="text-sm text-yellow-500">Peak pricing applied</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Check-in Status (for completed bookings) */}
        {booking.status === 'COMPLETED' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Check-in Status</h2>
            <div className="flex items-center gap-3">
              {booking.checkinStatus === 'VERIFIED' ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium text-green-500">Verified</p>
                    <p className="text-sm text-gray-400">
                      Check-in verified at venue
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-400">Not Checked In</p>
                    <p className="text-sm text-gray-500">
                      QR was not scanned at venue
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Review Prompt (for completed + verified bookings without review) */}
        {booking.status === 'COMPLETED' &&
         booking.checkinStatus === 'VERIFIED' &&
         !booking.hasReview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-primary/10 border border-primary/30 rounded-xl p-6"
          >
            <div className="flex items-start gap-4">
              <Star className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">Rate Your Experience</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Help other players by sharing your experience at this venue
                </p>
                <Link
                  href={`/bookings/${bookingId}/review`}
                  className="inline-block px-4 py-2 bg-primary text-black rounded-lg font-medium hover:bg-primary/90"
                >
                  Write Review
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full py-3 border border-red-500/50 text-red-500 rounded-xl hover:bg-red-500/10 transition-colors"
            >
              Cancel Booking
            </button>
            <p className="text-sm text-gray-500 text-center mt-2">
              {cancellationTier === 'full'
                ? 'Full refund available (>24h before start)'
                : 'Partial refund (50%) available (6-24h before start)'
              }
            </p>
          </motion.div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Cancel Booking?</h3>
              <p className="text-gray-400 mb-4">
                Are you sure you want to cancel this booking? This action cannot be undone.
              </p>

              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Advance Paid</span>
                  <span className="text-white">{formatAmount(booking.advanceAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Refund Amount</span>
                  <span className="text-green-500">
                    {cancellationTier === 'full'
                      ? formatAmount(booking.advanceAmount)
                      : formatAmount(Math.floor(booking.advanceAmount * 0.5))
                    }
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  * Processing fees may apply
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700"
                >
                  Keep Booking
                </button>
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>

              {cancelMutation.error && (
                <p className="text-red-500 text-sm text-center mt-4">
                  Failed to cancel booking. Please try again.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BookingDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="h-12 bg-gray-800 rounded-xl" />
        <div className="h-40 bg-gray-800 rounded-xl" />
        <div className="h-32 bg-gray-800 rounded-xl" />
        <div className="h-32 bg-gray-800 rounded-xl" />
        <div className="h-32 bg-gray-800 rounded-xl" />
      </div>
    </div>
  );
}
