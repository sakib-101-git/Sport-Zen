'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  CreditCard,
  Check,
  Clock,
  AlertTriangle,
  Search,
  ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';

const statusColors: Record<string, string> = {
  REQUESTED: 'bg-yellow-500/20 text-yellow-400',
  APPROVED: 'bg-blue-500/20 text-blue-400',
  PROCESSING: 'bg-purple-500/20 text-purple-400',
  REFUNDED: 'bg-green-500/20 text-green-400',
  FAILED: 'bg-red-500/20 text-red-400',
  MANUAL_REQUIRED: 'bg-orange-500/20 text-orange-400',
};

export default function AdminRefundsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [referenceId, setReferenceId] = useState('');

  const { data: refunds, isLoading } = useQuery({
    queryKey: ['admin-refunds'],
    queryFn: async () => {
      const response = await api.getAdminRefunds();
      return response.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveRefund(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-refunds'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, referenceId }: { id: string; referenceId: string }) =>
      api.markRefundComplete(id, referenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-refunds'] });
      setShowCompleteModal(false);
      setReferenceId('');
      setSelectedRefund(null);
    },
  });

  const filteredRefunds = refunds?.filter((r: any) => {
    const matchesSearch =
      r.booking?.bookingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.booking?.playerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Refunds Management</h1>
        <p className="text-gray-400 mt-1">Process and track refund requests</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by booking number or player..."
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
          <option value="REQUESTED">Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="PROCESSING">Processing</option>
          <option value="MANUAL_REQUIRED">Manual Required</option>
          <option value="REFUNDED">Refunded</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {/* Refunds List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredRefunds && filteredRefunds.length > 0 ? (
        <div className="space-y-4">
          {filteredRefunds.map((refund: any) => (
            <motion.div
              key={refund.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      {formatAmount(refund.refundAmount)}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[refund.status]}`}>
                      {refund.status}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm mb-2">
                    Booking: #{refund.booking?.bookingNumber} • {refund.booking?.playerName}
                  </p>

                  <p className="text-gray-500 text-sm">
                    Reason: {refund.reason}
                  </p>

                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                    <span>Tier: {refund.refundTier}</span>
                    <span>•</span>
                    <span>Original: {formatAmount(refund.originalAdvance)}</span>
                    <span>•</span>
                    <span>Fee: {formatAmount(refund.platformFeeRetained)}</span>
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Created: {format(new Date(refund.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {refund.status === 'REQUESTED' && (
                    <button
                      onClick={() => approveMutation.mutate(refund.id)}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                  )}
                  {(refund.status === 'APPROVED' || refund.status === 'MANUAL_REQUIRED') && (
                    <button
                      onClick={() => {
                        setSelectedRefund(refund);
                        setShowCompleteModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No refunds found</p>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && selectedRefund && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Mark Refund Complete
            </h3>
            <p className="text-gray-400 mb-4">
              Amount: {formatAmount(selectedRefund.refundAmount)}
            </p>
            <input
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="Transaction Reference ID"
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowCompleteModal(false);
                  setReferenceId('');
                }}
                className="flex-1 py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  completeMutation.mutate({
                    id: selectedRefund.id,
                    referenceId,
                  });
                }}
                disabled={!referenceId.trim() || completeMutation.isPending}
                className="flex-1 py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {completeMutation.isPending ? 'Processing...' : 'Complete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
