'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  QrCode,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';
import { formatDate, formatTimeRange, getDateLabel } from '@/lib/utils/dates';
import { BookingCardSkeleton, DashboardStatsSkeleton } from '@/components/common/skeletons';

export default function PlayerDashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.getMe();
        if (response.success) {
          setUser(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch user');
      }
    };
    fetchUser();
  }, []);

  const { data: upcomingBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings', 'upcoming'],
    queryFn: async () => {
      const response = await api.getMyBookings('CONFIRMED', 1, 5);
      return response.data;
    },
  });

  const { data: recentBookings } = useQuery({
    queryKey: ['my-bookings', 'recent'],
    queryFn: async () => {
      const response = await api.getMyBookings(undefined, 1, 10);
      return response.data;
    },
  });

  const stats = {
    upcoming: upcomingBookings?.filter((b: any) => b.status === 'CONFIRMED').length || 0,
    completed: recentBookings?.filter((b: any) => b.status === 'COMPLETED').length || 0,
    cancelled: recentBookings?.filter((b: any) => b.status === 'CANCELED').length || 0,
    total: recentBookings?.length || 0,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.name?.split(' ')[0] || 'Player'}!
        </h1>
        <p className="text-gray-400 mt-1">Here's your booking overview</p>
      </motion.div>

      {/* Stats */}
      {bookingsLoading ? (
        <DashboardStatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900 rounded-xl p-4 border border-gray-800"
          >
            <p className="text-gray-400 text-sm">Upcoming</p>
            <p className="text-2xl font-bold text-primary mt-1">{stats.upcoming}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gray-900 rounded-xl p-4 border border-gray-800"
          >
            <p className="text-gray-400 text-sm">Completed</p>
            <p className="text-2xl font-bold text-green-500 mt-1">{stats.completed}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900 rounded-xl p-4 border border-gray-800"
          >
            <p className="text-gray-400 text-sm">Cancelled</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{stats.cancelled}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-gray-900 rounded-xl p-4 border border-gray-800"
          >
            <p className="text-gray-400 text-sm">Total Bookings</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
          </motion.div>
        </div>
      )}

      {/* Upcoming Bookings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Upcoming Bookings</h2>
          <Link
            href="/bookings"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {bookingsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <BookingCardSkeleton key={i} />
            ))}
          </div>
        ) : upcomingBookings && upcomingBookings.length > 0 ? (
          <div className="space-y-4">
            {upcomingBookings.map((booking: any) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Link href={`/bookings/${booking.id}`}>
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-white">
                          {booking.playArea?.facility?.name}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {booking.playArea?.name} • {booking.sportProfile?.sportType?.name}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
                        {booking.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {getDateLabel(booking.startAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTimeRange(booking.startAt, booking.endAt)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
                      <span className="text-primary font-medium">
                        {formatAmount(booking.totalAmount)}
                      </span>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <QrCode className="w-4 h-4" />
                        View QR
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl p-8 text-center border border-gray-800">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No upcoming bookings</p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-primary text-black rounded-lg hover:bg-primary/90"
            >
              Book a Turf
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors">
            <MapPin className="w-6 h-6 text-primary mb-2" />
            <p className="font-medium text-white">Find Turfs</p>
            <p className="text-sm text-gray-400">Search nearby venues</p>
          </div>
        </Link>

        <Link href="/bookings">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors">
            <Calendar className="w-6 h-6 text-primary mb-2" />
            <p className="font-medium text-white">My Bookings</p>
            <p className="text-sm text-gray-400">View all bookings</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
