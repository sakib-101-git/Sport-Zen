'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Building2,
  MapPin,
  Phone,
  Clock,
  Star,
  ChevronRight,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { api } from '@/lib/api/client';

export default function OwnerFacilitiesPage() {
  const { data: facilities, isLoading } = useQuery({
    queryKey: ['owner-facilities'],
    queryFn: async () => {
      const response = await api.getOwnerFacilities();
      return response.data;
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Facilities</h1>
        <p className="text-gray-400 mt-1">Manage your turf facilities</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : facilities && facilities.length > 0 ? (
        <div className="space-y-4">
          {facilities.map((facility: any) => (
            <motion.div
              key={facility.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">{facility.name}</h3>
                      {facility.isApproved ? (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
                          <Check className="w-3 h-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                          <Clock className="w-3 h-3" />
                          Pending Approval
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {facility.address}, {facility.area}
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {facility.contactPhone}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {facility.openingTime} - {facility.closingTime}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/owner/facilities/${facility.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-800">
                  <div>
                    <p className="text-sm text-gray-400">Play Areas</p>
                    <p className="text-lg font-semibold text-white">
                      {facility.playAreas?.length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Rating</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-lg font-semibold text-white">
                        {facility.avgRating?.toFixed(1) || 'N/A'}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({facility.reviewCount || 0} reviews)
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Sport Types</p>
                    <p className="text-lg font-semibold text-white">
                      {facility.sportTypes?.length || facility.playAreas?.reduce((acc: any, pa: any) =>
                        acc + (pa.sportProfiles?.length || 0), 0) || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Amenities</p>
                    <p className="text-lg font-semibold text-white">
                      {facility.amenities?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Play Areas */}
                {facility.playAreas && facility.playAreas.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-sm text-gray-400 mb-2">Play Areas:</p>
                    <div className="flex flex-wrap gap-2">
                      {facility.playAreas.map((pa: any) => (
                        <span
                          key={pa.id}
                          className="px-3 py-1 bg-gray-800 text-gray-300 text-sm rounded-lg"
                        >
                          {pa.name}
                          {pa.isIndoor && ' (Indoor)'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No facilities found</p>
          <p className="text-gray-500 text-sm mt-1">
            Contact support to register a new facility
          </p>
        </div>
      )}
    </div>
  );
}
