'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  QrCode,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';
import { formatTimeRange, getDateLabel } from '@/lib/utils/dates';

export default function OwnerDashboardPage() {
  const [currentMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: async () => {
      const response = await api.getOwnerDashboard();
      return response.data;
    },
  });

  const { data: todayBookings } = useQuery({
    queryKey: ['owner-bookings', 'today'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await api.getOwnerBookings({
        dateFrom: today,
        dateTo: today,
        status: 'CONFIRMED',
      });
      return response.data;
    },
  });

  const stats = dashboard?.stats || {
    totalBookingsToday: 0,
    totalRevenueToday: 0,
    upcomingBookings: 0,
    pendingCheckIns: 0,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Owner Dashboard</h1>
        <p className="text-gray-400 mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800"
        >
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="text-xs text-gray-500">Today</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalBookingsToday}</p>
          <p className="text-sm text-gray-400">Bookings</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800"
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <span className="text-xs text-gray-500">Today</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatAmount(stats.totalRevenueToday)}
          </p>
          <p className="text-sm text-gray-400">Revenue</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <span className="text-xs text-gray-500">Upcoming</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.upcomingBookings}</p>
          <p className="text-sm text-gray-400">Scheduled</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800"
        >
          <div className="flex items-center justify-between mb-2">
            <QrCode className="w-5 h-5 text-yellow-500" />
            <span className="text-xs text-gray-500">Pending</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.pendingCheckIns}</p>
          <p className="text-sm text-gray-400">Check-ins</p>
        </motion.div>
      </div>

      {/* Today's Bookings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Today's Bookings</h2>
          <Link
            href="/owner/bookings"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : todayBookings && todayBookings.length > 0 ? (
          <div className="space-y-3">
            {todayBookings.map((booking: any) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white">{booking.playerName}</h3>
                      <span className={`
                        px-2 py-0.5 text-xs rounded-full
                        ${booking.checkinStatus === 'VERIFIED'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                        }
                      `}>
                        {booking.checkinStatus === 'VERIFIED' ? 'Checked In' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {booking.playArea?.name} • {formatTimeRange(booking.startAt, booking.endAt)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      📞 {booking.playerPhone}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-primary font-medium">{formatAmount(booking.totalAmount)}</p>
                    <p className="text-xs text-gray-500">
                      Advance: {formatAmount(booking.advanceAmount)}
                    </p>
                  </div>
                </div>

                {booking.checkinStatus !== 'VERIFIED' && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <Link
                      href={`/owner/bookings?scan=${booking.id}`}
                      className="flex items-center justify-center gap-2 w-full py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                    >
                      <QrCode className="w-4 h-4" />
                      Scan QR to Check In
                    </Link>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl p-8 text-center border border-gray-800">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No bookings for today</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/owner/calendar">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors text-center">
            <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Calendar</p>
          </div>
        </Link>

        <Link href="/owner/blocks">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors text-center">
            <AlertCircle className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Manage Blocks</p>
          </div>
        </Link>

        <Link href="/owner/facilities">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors text-center">
            <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Facilities</p>
          </div>
        </Link>

        <Link href="/owner/settlements">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors text-center">
            <DollarSign className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Settlements</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
