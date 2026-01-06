'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Users,
  Search,
  Building2,
  Mail,
  Phone,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { api } from '@/lib/api/client';

const statusColors: Record<string, string> = {
  TRIAL: 'bg-blue-500/20 text-blue-400',
  ACTIVE: 'bg-green-500/20 text-green-400',
  PAST_DUE: 'bg-yellow-500/20 text-yellow-400',
  SUSPENDED: 'bg-red-500/20 text-red-400',
  CANCELED: 'bg-gray-500/20 text-gray-400',
};

export default function AdminSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const response = await api.getAdminSubscriptions();
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ ownerId, status }: { ownerId: string; status: string }) =>
      api.updateSubscriptionStatus(ownerId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSelectedSubscription(null);
      setNewStatus('');
    },
  });

  const filteredSubscriptions = subscriptions?.filter((s: any) => {
    const matchesSearch =
      s.owner?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Subscription Management</h1>
        <p className="text-gray-400 mt-1">Manage owner subscriptions and billing</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by owner name or email..."
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
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="PAST_DUE">Past Due</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CANCELED">Canceled</option>
        </select>
      </div>

      {/* Subscriptions List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredSubscriptions && filteredSubscriptions.length > 0 ? (
        <div className="space-y-4">
          {filteredSubscriptions.map((sub: any) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      {sub.owner?.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[sub.status]}`}>
                      {sub.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {sub.owner?.email}
                    </span>
                    {sub.owner?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {sub.owner?.phone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <Building2 className="w-4 h-4" />
                    {sub.facilitiesCount || 0} Facilities
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <p className="text-gray-500">Plan</p>
                      <p className="text-white">{sub.plan?.name || 'Standard'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Current Period</p>
                      <p className="text-white">
                        {sub.currentPeriodStart && sub.currentPeriodEnd
                          ? `${format(new Date(sub.currentPeriodStart), 'MMM d')} - ${format(new Date(sub.currentPeriodEnd), 'MMM d, yyyy')}`
                          : 'N/A'}
                      </p>
                    </div>
                    {sub.trialEndsAt && (
                      <div>
                        <p className="text-gray-500">Trial Ends</p>
                        <p className="text-white">{format(new Date(sub.trialEndsAt), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-4">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedSubscription(sub);
                        setNewStatus(e.target.value);
                      }
                    }}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">Change Status</option>
                    <option value="TRIAL">Set to Trial</option>
                    <option value="ACTIVE">Activate</option>
                    <option value="SUSPENDED">Suspend</option>
                    <option value="CANCELED">Cancel</option>
                  </select>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No subscriptions found</p>
        </div>
      )}

      {/* Confirm Status Change Modal */}
      {selectedSubscription && newStatus && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Confirm Status Change
            </h3>
            <p className="text-gray-400 mb-2">
              Change subscription for <strong>{selectedSubscription.owner?.name}</strong>
            </p>
            <p className="text-gray-400">
              From <span className={`px-2 py-0.5 rounded ${statusColors[selectedSubscription.status]}`}>{selectedSubscription.status}</span>
              {' → '}
              <span className={`px-2 py-0.5 rounded ${statusColors[newStatus]}`}>{newStatus}</span>
            </p>

            {(newStatus === 'SUSPENDED' || newStatus === 'CANCELED') && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">This will prevent new bookings for their facilities</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setSelectedSubscription(null);
                  setNewStatus('');
                }}
                className="flex-1 py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateMutation.mutate({
                    ownerId: selectedSubscription.ownerId,
                    status: newStatus,
                  });
                }}
                disabled={updateMutation.isPending}
                className="flex-1 py-2 px-4 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
