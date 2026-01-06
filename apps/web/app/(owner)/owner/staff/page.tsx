'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Users,
  Plus,
  Mail,
  User,
  Shield,
  Trash2,
  Edit2,
} from 'lucide-react';
import { api } from '@/lib/api/client';

const roleLabels: Record<string, string> = {
  OWNER_STAFF: 'Staff',
  OWNER: 'Owner',
};

export default function OwnerStaffPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [newStaff, setNewStaff] = useState({
    email: '',
    name: '',
    role: 'OWNER_STAFF',
  });

  const { data: staff, isLoading } = useQuery({
    queryKey: ['owner-staff'],
    queryFn: async () => {
      const response = await api.getOwnerStaff();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { email: string; name: string; role: string }) =>
      api.createStaff(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-staff'] });
      setShowAddModal(false);
      setNewStaff({ email: '', name: '', role: 'OWNER_STAFF' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.updateStaffRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-staff'] });
      setShowEditModal(false);
      setSelectedStaff(null);
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Staff Management</h1>
          <p className="text-gray-400 mt-1">Manage your facility staff members</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Staff
        </button>
      </div>

      {/* Staff List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : staff && staff.length > 0 ? (
        <div className="space-y-4">
          {staff.map((member: any) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{member.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {member.email}
                      </div>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                        member.role === 'OWNER'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {roleLabels[member.role] || member.role}
                      </span>
                    </div>
                    {member.createdAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Added: {format(new Date(member.createdAt), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.role !== 'OWNER' && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedStaff(member);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No staff members</p>
          <p className="text-gray-500 text-sm mt-1">
            Add staff members to help manage your facilities
          </p>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Add Staff Member</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-primary focus:outline-none"
                  placeholder="Staff member name"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-primary focus:outline-none"
                  placeholder="staff@example.com"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                >
                  <option value="OWNER_STAFF">Staff</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewStaff({ email: '', name: '', role: 'OWNER_STAFF' });
                }}
                className="flex-1 py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate(newStaff)}
                disabled={!newStaff.email || !newStaff.name || createMutation.isPending}
                className="flex-1 py-2 px-4 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Staff'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Edit Staff Role
            </h3>
            <p className="text-gray-400 mb-4">{selectedStaff.name}</p>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Role</label>
              <select
                defaultValue={selectedStaff.role}
                onChange={(e) => setSelectedStaff({ ...selectedStaff, newRole: e.target.value })}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
              >
                <option value="OWNER_STAFF">Staff</option>
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedStaff(null);
                }}
                className="flex-1 py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateRoleMutation.mutate({
                    id: selectedStaff.id,
                    role: selectedStaff.newRole || selectedStaff.role,
                  });
                }}
                disabled={updateRoleMutation.isPending}
                className="flex-1 py-2 px-4 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {updateRoleMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
