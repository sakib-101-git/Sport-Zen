'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Building2,
  CreditCard,
  Users,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';

export default function AdminDashboardPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const response = await api.getAdminDashboard();
      return response.data;
    },
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ['facility-approvals'],
    queryFn: async () => {
      const response = await api.getFacilityApprovals();
      return response.data;
    },
  });

  const { data: pendingRefunds } = useQuery({
    queryKey: ['admin-refunds'],
    queryFn: async () => {
      const response = await api.getAdminRefunds();
      return response.data;
    },
  });

  const stats = dashboard?.stats || {
    totalFacilities: 0,
    pendingApprovals: 0,
    activeSubscriptions: 0,
    pendingRefunds: 0,
    totalRevenue: 0,
    totalBookings: 0,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800"
        >
          <Building2 className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-white">{stats.totalFacilities}</p>
          <p className="text-sm text-gray-400">Total Facilities</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gray-900 rounded-xl p-4 border border-yellow-500/30"
        >
          <Clock className="w-5 h-5 text-yellow-500 mb-2" />
          <p className="text-2xl font-bold text-white">{stats.pendingApprovals}</p>
          <p className="text-sm text-gray-400">Pending Approvals</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800"
        >
          <Users className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-white">{stats.activeSubscriptions}</p>
          <p className="text-sm text-gray-400">Active Subscriptions</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-gray-900 rounded-xl p-4 border border-red-500/30"
        >
          <CreditCard className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-2xl font-bold text-white">{stats.pendingRefunds}</p>
          <p className="text-sm text-gray-400">Pending Refunds</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800"
        >
          <DollarSign className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold text-white">{formatAmount(stats.totalRevenue)}</p>
          <p className="text-sm text-gray-400">Total Revenue</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800"
        >
          <TrendingUp className="w-5 h-5 text-purple-500 mb-2" />
          <p className="text-2xl font-bold text-white">{stats.totalBookings}</p>
          <p className="text-sm text-gray-400">Total Bookings</p>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending Facility Approvals */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
            <Link
              href="/admin/facility-approvals"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : pendingApprovals && pendingApprovals.length > 0 ? (
              <div className="space-y-3">
                {pendingApprovals.slice(0, 5).map((facility: any) => (
                  <div
                    key={facility.id}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-white">{facility.name}</p>
                      <p className="text-sm text-gray-400">
                        {facility.owner?.name} • {format(new Date(facility.createdAt), 'MMM d')}
                      </p>
                    </div>
                    <Link
                      href={`/admin/facility-approvals?id=${facility.id}`}
                      className="px-3 py-1.5 bg-primary/20 text-primary text-sm rounded-lg hover:bg-primary/30"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="text-gray-400">No pending approvals</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Refunds */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Pending Refunds</h2>
            <Link
              href="/admin/refunds"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : pendingRefunds && pendingRefunds.length > 0 ? (
              <div className="space-y-3">
                {pendingRefunds.slice(0, 5).map((refund: any) => (
                  <div
                    key={refund.id}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {formatAmount(refund.amount)}
                      </p>
                      <p className="text-sm text-gray-400">
                        #{refund.booking?.bookingNumber} • {refund.reason}
                      </p>
                    </div>
                    <span className={`
                      px-2 py-1 text-xs rounded-full
                      ${refund.status === 'REQUESTED' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                      ${refund.status === 'APPROVED' ? 'bg-blue-500/20 text-blue-400' : ''}
                    `}>
                      {refund.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="text-gray-400">No pending refunds</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
        <Link href="/admin/facility-approvals">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors text-center">
            <Building2 className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Approvals</p>
          </div>
        </Link>

        <Link href="/admin/refunds">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors text-center">
            <CreditCard className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Refunds</p>
          </div>
        </Link>

        <Link href="/admin/subscriptions">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Subscriptions</p>
          </div>
        </Link>

        <Link href="/admin/disputes">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors text-center">
            <AlertTriangle className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Disputes</p>
          </div>
        </Link>

        <Link href="/admin/reviews">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-primary/50 transition-colors text-center">
            <MessageSquare className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Reviews</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
