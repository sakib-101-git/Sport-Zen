'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/api/client';

export default function OwnerFacilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const facilityId = params.facilityId as string;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  const { data: facility, isLoading } = useQuery({
    queryKey: ['owner-facility', facilityId],
    queryFn: async () => {
      const response = await api.getOwnerFacilityDetail(facilityId);
      return response.data;
    },
    enabled: !!facilityId,
  });

  // Initialize form data when facility loads
  if (facility && !formData) {
    setFormData({
      name: facility.name || '',
      description: facility.description || '',
      address: facility.address || '',
      area: facility.area || '',
      contactPhone: facility.contactPhone || '',
      contactEmail: facility.contactEmail || '',
      openingTime: facility.openingTime || '06:00',
      closingTime: facility.closingTime || '23:00',
    });
  }

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateFacility(facilityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-facility', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['owner-facilities'] });
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    if (formData) {
      updateMutation.mutate(formData);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-800 rounded w-48 animate-pulse" />
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Facility not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{facility.name}</h1>
            <p className="text-gray-400 mt-1">Manage facility details</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    name: facility.name || '',
                    description: facility.description || '',
                    address: facility.address || '',
                    area: facility.area || '',
                    contactPhone: facility.contactPhone || '',
                    contactEmail: facility.contactEmail || '',
                    openingTime: facility.openingTime || '06:00',
                    closingTime: facility.closingTime || '23:00',
                  });
                }}
                className="px-4 py-2 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
            >
              Edit Details
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Facility Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData?.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-white">{facility.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                {isEditing ? (
                  <textarea
                    value={formData?.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none resize-none"
                  />
                ) : (
                  <p className="text-gray-300">{facility.description || 'No description'}</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Location */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Location
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Address</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData?.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-white">{facility.address}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Area</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData?.area || ''}
                    onChange={(e) => handleInputChange('area', e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-white">{facility.area}</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Contact Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Phone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData?.contactPhone || ''}
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-white">{facility.contactPhone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData?.contactEmail || ''}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-white">{facility.contactEmail || 'Not provided'}</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Operating Hours */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Operating Hours
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Opening Time</label>
                {isEditing ? (
                  <input
                    type="time"
                    value={formData?.openingTime || ''}
                    onChange={(e) => handleInputChange('openingTime', e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-white">{facility.openingTime}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Closing Time</label>
                {isEditing ? (
                  <input
                    type="time"
                    value={formData?.closingTime || ''}
                    onChange={(e) => handleInputChange('closingTime', e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-white">{facility.closingTime}</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Approval</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  facility.isApproved
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {facility.isApproved ? 'Approved' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Play Areas</span>
                <span className="text-white">{facility.playAreas?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Bookings</span>
                <span className="text-white">{facility._count?.bookings || 0}</span>
              </div>
            </div>
          </motion.div>

          {/* Play Areas */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Play Areas</h3>
            {facility.playAreas && facility.playAreas.length > 0 ? (
              <div className="space-y-3">
                {facility.playAreas.map((pa: any) => (
                  <div
                    key={pa.id}
                    className="p-3 bg-gray-800 rounded-lg"
                  >
                    <p className="text-white font-medium">{pa.name}</p>
                    <p className="text-sm text-gray-400">
                      {pa.isIndoor ? 'Indoor' : 'Outdoor'}
                      {pa.sportProfiles?.length > 0 && (
                        <> • {pa.sportProfiles.length} sport(s)</>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No play areas configured</p>
            )}
          </motion.div>

          {/* Photos */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Photos</h3>
              <button className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg transition-colors">
                <Upload className="w-4 h-4" />
              </button>
            </div>
            {facility.photos && facility.photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {facility.photos.slice(0, 4).map((photo: any) => (
                  <div
                    key={photo.id}
                    className="aspect-square bg-gray-800 rounded-lg overflow-hidden"
                  >
                    <img
                      src={photo.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <ImageIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No photos uploaded</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
