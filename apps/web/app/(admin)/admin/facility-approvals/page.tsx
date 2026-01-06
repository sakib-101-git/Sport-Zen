'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Check,
  X,
  Eye,
  ChevronRight,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api/client';

export default function FacilityApprovalsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data: facilities, isLoading } = useQuery({
    queryKey: ['facility-approvals'],
    queryFn: async () => {
      const response = await api.getFacilityApprovals();
      return response.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveFacility(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSelectedFacility(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.rejectFacility(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSelectedFacility(null);
      setShowRejectModal(false);
      setRejectReason('');
    },
  });

  const filteredFacilities = facilities?.filter((f: any) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.owner?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Facility Approvals</h1>
        <p className="text-gray-400 mt-1">Review and approve new facility registrations</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search facilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Facilities List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredFacilities && filteredFacilities.length > 0 ? (
        <div className="space-y-4">
          {filteredFacilities.map((facility: any) => (
            <motion.div
              key={facility.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{facility.name}</h3>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {facility.address}, {facility.area}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(facility.createdAt), 'MMM d, yyyy')}
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400 mb-1">Owner</p>
                    <p className="font-medium text-white">{facility.owner?.name}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {facility.owner?.email}
                      </span>
                      {facility.owner?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {facility.owner?.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => approveMutation.mutate(facility.id)}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFacility(facility);
                      setShowRejectModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No pending facility approvals</p>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedFacility && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Reject {selectedFacility.name}?
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={4}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:outline-none resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="flex-1 py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  rejectMutation.mutate({
                    id: selectedFacility.id,
                    reason: rejectReason,
                  });
                }}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
