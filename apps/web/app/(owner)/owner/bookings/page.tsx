'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  List,
  Search,
  Calendar,
  Clock,
  User,
  Phone,
  QrCode,
  DollarSign,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';
import { formatTimeRange } from '@/lib/utils/dates';

const statusColors: Record<string, string> = {
  HOLD: 'bg-yellow-500/20 text-yellow-400',
  CONFIRMED: 'bg-green-500/20 text-green-400',
  COMPLETED: 'bg-blue-500/20 text-blue-400',
  CANCELED: 'bg-red-500/20 text-red-400',
  EXPIRED: 'bg-gray-500/20 text-gray-400',
};

const paymentStageLabels: Record<string, string> = {
  NOT_PAID: 'Unpaid',
  ADVANCE_PAID: 'Advance Paid',
  PARTIAL_OFFLINE: 'Partial',
  FULL_PAID_OFFLINE: 'Fully Paid',
};

export default function OwnerBookingsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: '',
  });
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [offlineAmount, setOfflineAmount] = useState('');
  const [offlineMethod, setOfflineMethod] = useState('CASH');

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['owner-bookings', statusFilter, dateRange],
    queryFn: async () => {
      const params: any = { page: 1, limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateRange.from) params.dateFrom = dateRange.from;
      if (dateRange.to) params.dateTo = dateRange.to;
      const response = await api.getOwnerBookings(params);
      return response.data;
    },
  });

  const offlinePaymentMutation = useMutation({
    mutationFn: ({ bookingId, data }: { bookingId: string; data: any }) =>
      api.updateOfflinePayment(bookingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      setShowOfflineModal(false);
      setOfflineAmount('');
      setSelectedBooking(null);
    },
  });

  const checkInMutation = useMutation({
    mutationFn: ({ bookingId, qrToken }: { bookingId: string; qrToken: string }) =>
      api.verifyCheckIn(bookingId, qrToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
    },
  });

  const filteredBookings = bookings?.filter((b: any) =>
    b.playerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.bookingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.playerPhone?.includes(searchQuery)
  );

  const handleRecordOfflinePayment = () => {
    if (!selectedBooking || !offlineAmount) return;
    offlinePaymentMutation.mutate({
      bookingId: selectedBooking.id,
      data: {
        offlineAmountCollected: parseInt(offlineAmount),
        offlinePaymentMethod: offlineMethod,
      },
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <p className="text-gray-400 mt-1">Manage all facility bookings</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-primary focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:border-primary focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="HOLD">On Hold</option>
          <option value="CANCELED">Canceled</option>
        </select>

        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
          className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:border-primary focus:outline-none"
        />

        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
          className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:border-primary focus:outline-none"
          placeholder="To date"
        />
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredBookings && filteredBookings.length > 0 ? (
        <div className="space-y-4">
          {filteredBookings.map((booking: any) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      #{booking.bookingNumber}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[booking.status]}`}>
                      {booking.status}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      booking.checkinStatus === 'VERIFIED'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {booking.checkinStatus === 'VERIFIED' ? 'Checked In' : 'Not Checked In'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {booking.playerName}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {booking.playerPhone}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(booking.startAt), 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {formatTimeRange(booking.startAt, booking.endAt)}
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      {formatAmount(booking.totalAmount)}
                      <span className="text-xs">
                        (Adv: {formatAmount(booking.advanceAmount)})
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-400">Play Area:</span>
                    <span className="text-white">{booking.playArea?.name}</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400">{booking.sportProfile?.sportType?.name}</span>
                  </div>

                  {/* Payment Stage */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-400">Payment:</span>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      booking.paymentStage === 'FULL_PAID_OFFLINE'
                        ? 'bg-green-500/20 text-green-400'
                        : booking.paymentStage === 'ADVANCE_PAID'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {paymentStageLabels[booking.paymentStage] || booking.paymentStage}
                    </span>
                    {booking.offlineAmountCollected > 0 && (
                      <span className="text-xs text-gray-500">
                        (Offline: {formatAmount(booking.offlineAmountCollected)})
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {booking.status === 'CONFIRMED' && booking.checkinStatus !== 'VERIFIED' && (
                    <button
                      onClick={() => {
                        const qrToken = prompt('Enter QR Token:');
                        if (qrToken) {
                          checkInMutation.mutate({ bookingId: booking.id, qrToken });
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors text-sm"
                    >
                      <QrCode className="w-4 h-4" />
                      Check In
                    </button>
                  )}

                  {(booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') &&
                    booking.paymentStage !== 'FULL_PAID_OFFLINE' && (
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setOfflineAmount(String(booking.totalAmount - booking.advanceAmount - (booking.offlineAmountCollected || 0)));
                        setShowOfflineModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                    >
                      <DollarSign className="w-4 h-4" />
                      Record Payment
                    </button>
                  )}

                  <a
                    href={`tel:${booking.playerPhone}`}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <List className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No bookings found</p>
        </div>
      )}

      {/* Offline Payment Modal */}
      {showOfflineModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Record Offline Payment
            </h3>
            <p className="text-gray-400 mb-4">
              Booking: #{selectedBooking.bookingNumber}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (BDT)</label>
                <input
                  type="number"
                  value={offlineAmount}
                  onChange={(e) => setOfflineAmount(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Payment Method</label>
                <select
                  value={offlineMethod}
                  onChange={(e) => setOfflineMethod(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                >
                  <option value="CASH">Cash</option>
                  <option value="BKASH">bKash</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowOfflineModal(false);
                  setOfflineAmount('');
                  setSelectedBooking(null);
                }}
                className="flex-1 py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordOfflinePayment}
                disabled={!offlineAmount || offlinePaymentMutation.isPending}
                className="flex-1 py-2 px-4 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {offlinePaymentMutation.isPending ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
