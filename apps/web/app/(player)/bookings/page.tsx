'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  QrCode,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';
import { getDateLabel, formatTimeRange } from '@/lib/utils/dates';
import { BookingCardSkeleton } from '@/components/common/skeletons';

const statusFilters = [
  { value: '', label: 'All Bookings' },
  { value: 'CONFIRMED', label: 'Upcoming' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELED', label: 'Cancelled' },
  { value: 'EXPIRED', label: 'Expired' },
];

const statusColors: Record<string, string> = {
  HOLD: 'bg-yellow-500/20 text-yellow-500',
  CONFIRMED: 'bg-primary/20 text-primary',
  COMPLETED: 'bg-green-500/20 text-green-500',
  CANCELED: 'bg-red-500/20 text-red-500',
  EXPIRED: 'bg-gray-500/20 text-gray-400',
};

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['my-bookings', statusFilter, page],
    queryFn: async () => {
      const response = await api.getMyBookings(statusFilter || undefined, page, 20);
      return response.data;
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">My Bookings</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-6">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => {
              setStatusFilter(filter.value);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === filter.value
                ? 'bg-primary text-black'
                : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <BookingCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">Failed to load bookings</p>
        </div>
      ) : bookings && bookings.length > 0 ? (
        <div className="space-y-4">
          {bookings.map((booking: any, index: number) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link href={`/bookings/${booking.id}`}>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500">
                          #{booking.bookingNumber}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[booking.status] || statusColors.EXPIRED}`}>
                          {booking.status}
                        </span>
                      </div>
                      <h3 className="font-medium text-white">
                        {booking.playArea?.facility?.name || 'Unknown Facility'}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {booking.playArea?.name} • {booking.sportProfile?.sportType?.name}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {getDateLabel(booking.startAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatTimeRange(booking.startAt, booking.endAt)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                    <div>
                      <span className="text-primary font-semibold">
                        {formatAmount(booking.totalAmount)}
                      </span>
                      {booking.paymentStage === 'ADVANCE_PAID' && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({formatAmount(booking.advanceAmount)} paid)
                        </span>
                      )}
                    </div>

                    {booking.status === 'CONFIRMED' && (
                      <div className="flex items-center gap-1 text-sm text-primary">
                        <QrCode className="w-4 h-4" />
                        Show QR
                      </div>
                    )}

                    {booking.status === 'COMPLETED' && booking.checkinStatus === 'VERIFIED' && !booking.hasReview && (
                      <span className="text-xs text-yellow-500">Leave review</span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-900 rounded-xl border border-gray-800">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No bookings found</p>
          <p className="text-gray-500 text-sm mb-4">
            {statusFilter ? 'Try a different filter' : 'Start by booking your first turf!'}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-primary text-black rounded-lg hover:bg-primary/90"
          >
            Find Turfs
          </Link>
        </div>
      )}

      {/* Pagination */}
      {bookings && bookings.length >= 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-900 text-gray-400 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-gray-900 text-gray-400 rounded-lg"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
