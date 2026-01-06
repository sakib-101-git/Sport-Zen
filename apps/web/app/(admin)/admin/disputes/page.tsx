'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Search,
  MessageSquare,
  User,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';

const statusColors: Record<string, string> = {
  OPEN: 'bg-yellow-500/20 text-yellow-400',
  IN_REVIEW: 'bg-blue-500/20 text-blue-400',
  RESOLVED: 'bg-green-500/20 text-green-400',
  ESCALATED: 'bg-red-500/20 text-red-400',
};

export default function AdminDisputesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: disputes, isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const response = await api.getAdminDisputes();
      return response.data;
    },
  });

  const filteredDisputes = disputes?.filter((d: any) => {
    const matchesSearch =
      d.booking?.bookingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.booking?.playerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Disputes</h1>
        <p className="text-gray-400 mt-1">Review and resolve booking disputes</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search disputes..."
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
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="ESCALATED">Escalated</option>
        </select>
      </div>

      {/* Disputes List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredDisputes && filteredDisputes.length > 0 ? (
        <div className="space-y-4">
          {filteredDisputes.map((dispute: any) => (
            <motion.div
              key={dispute.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      Dispute #{dispute.id.slice(0, 8)}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[dispute.status] || statusColors.OPEN}`}>
                      {dispute.status || 'OPEN'}
                    </span>
                  </div>

                  <p className="text-gray-400 mb-3">
                    Booking: #{dispute.booking?.bookingNumber}
                  </p>

                  <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-300">{dispute.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <User className="w-4 h-4" />
                      <span>Player: {dispute.booking?.playerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(dispute.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>

                <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors ml-4">
                  <MessageSquare className="w-4 h-4" />
                  View Details
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No disputes found</p>
          <p className="text-gray-500 text-sm mt-1">All disputes have been resolved</p>
        </div>
      )}
    </div>
  );
}
