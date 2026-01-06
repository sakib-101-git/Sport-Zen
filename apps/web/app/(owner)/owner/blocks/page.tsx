'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format, addDays } from 'date-fns';
import {
  Lock,
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatTimeRange } from '@/lib/utils/dates';

const blockTypeLabels: Record<string, string> = {
  MAINTENANCE: 'Maintenance',
  PRIVATE_EVENT: 'Private Event',
  WEATHER: 'Weather',
  OTHER: 'Other',
};

const blockTypeColors: Record<string, string> = {
  MAINTENANCE: 'bg-orange-500/20 text-orange-400',
  PRIVATE_EVENT: 'bg-purple-500/20 text-purple-400',
  WEATHER: 'bg-blue-500/20 text-blue-400',
  OTHER: 'bg-gray-500/20 text-gray-400',
};

export default function OwnerBlocksPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBlock, setNewBlock] = useState({
    playAreaId: '',
    startAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endAt: format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
    blockType: 'MAINTENANCE',
    reason: '',
  });

  const { data: blocks, isLoading } = useQuery({
    queryKey: ['owner-blocks'],
    queryFn: async () => {
      const response = await api.getOwnerBlocks();
      return response.data;
    },
  });

  const { data: facilities } = useQuery({
    queryKey: ['owner-facilities'],
    queryFn: async () => {
      const response = await api.getOwnerFacilities();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createBlock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-blocks'] });
      setShowCreateModal(false);
      setNewBlock({
        playAreaId: '',
        startAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        endAt: format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
        blockType: 'MAINTENANCE',
        reason: '',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-blocks'] });
    },
  });

  // Flatten play areas from all facilities
  const playAreas = facilities?.flatMap((f: any) =>
    f.playAreas?.map((pa: any) => ({
      ...pa,
      facilityName: f.name,
    })) || []
  ) || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Booking Blocks</h1>
          <p className="text-gray-400 mt-1">Manage time blocks for maintenance or events</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Block
        </button>
      </div>

      {/* Blocks List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : blocks && blocks.length > 0 ? (
        <div className="space-y-4">
          {blocks.map((block: any) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${blockTypeColors[block.blockType]}`}>
                      {blockTypeLabels[block.blockType] || block.blockType}
                    </span>
                    {new Date(block.endAt) < new Date() && (
                      <span className="px-2 py-1 text-xs bg-gray-700 text-gray-400 rounded-full">
                        Expired
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {block.playArea?.name || 'All Play Areas'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(block.startAt), 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatTimeRange(block.startAt, block.endAt)}
                    </div>
                  </div>

                  {block.reason && (
                    <p className="text-gray-500 mt-2 text-sm">
                      Reason: {block.reason}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this block?')) {
                      deleteMutation.mutate(block.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <Lock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No active blocks</p>
          <p className="text-gray-500 text-sm mt-1">
            Create blocks to prevent bookings during maintenance or special events
          </p>
        </div>
      )}

      {/* Create Block Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Create Block</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Play Area</label>
                <select
                  value={newBlock.playAreaId}
                  onChange={(e) => setNewBlock({ ...newBlock, playAreaId: e.target.value })}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                >
                  <option value="">All Play Areas</option>
                  {playAreas.map((pa: any) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.facilityName} - {pa.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Block Type</label>
                <select
                  value={newBlock.blockType}
                  onChange={(e) => setNewBlock({ ...newBlock, blockType: e.target.value })}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                >
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="PRIVATE_EVENT">Private Event</option>
                  <option value="WEATHER">Weather</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={newBlock.startAt}
                  onChange={(e) => setNewBlock({ ...newBlock, startAt: e.target.value })}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={newBlock.endAt}
                  onChange={(e) => setNewBlock({ ...newBlock, endAt: e.target.value })}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Reason (optional)</label>
                <textarea
                  value={newBlock.reason}
                  onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                  rows={2}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-primary focus:outline-none resize-none"
                  placeholder="Why is this time blocked?"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate(newBlock)}
                disabled={createMutation.isPending}
                className="flex-1 py-2 px-4 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Block'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
