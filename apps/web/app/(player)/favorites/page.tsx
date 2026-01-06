'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MapPin,
  Star,
  Trash2,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';
import { TurfCardSkeleton } from '@/components/common/skeletons';

interface FavoriteFacility {
  id: string;
  facility: {
    id: string;
    name: string;
    address: string;
    area: string;
    photos: { url: string; isPrimary: boolean }[];
    avgRating: number | null;
    reviewCount: number;
    minPrice: number;
    sportTypes: string[];
  };
  createdAt: string;
}

export default function FavoritesPage() {
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Fetch favorites
  const { data: favorites, isLoading, error } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const response = await api.getFavorites();
      return response.data as FavoriteFacility[];
    },
  });

  // Remove favorite mutation
  const removeMutation = useMutation({
    mutationFn: async (facilityId: string) => {
      return api.removeFavorite(facilityId);
    },
    onMutate: async (facilityId) => {
      setRemovingId(facilityId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
    onSettled: () => {
      setRemovingId(null);
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">My Favorites</h1>
        {favorites && favorites.length > 0 && (
          <span className="text-sm text-gray-400">
            {favorites.length} {favorites.length === 1 ? 'venue' : 'venues'}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <TurfCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">Failed to load favorites</p>
        </div>
      ) : favorites && favorites.length > 0 ? (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: { staggerChildren: 0.05 },
            },
          }}
        >
          <AnimatePresence>
            {favorites.map((fav) => (
              <motion.div
                key={fav.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative group"
              >
                <Link href={`/turfs/${fav.facility.id}`}>
                  <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors">
                    {/* Image */}
                    <div className="relative h-40">
                      {fav.facility.photos?.[0]?.url ? (
                        <img
                          src={fav.facility.photos[0].url}
                          alt={fav.facility.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <MapPin className="w-12 h-12 text-gray-600" />
                        </div>
                      )}
                      {/* Rating Badge */}
                      {fav.facility.avgRating && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/70 backdrop-blur px-2 py-1 rounded-full">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs font-medium text-white">
                            {fav.facility.avgRating.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-medium text-white mb-1 line-clamp-1">
                        {fav.facility.name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-gray-400 mb-2">
                        <MapPin className="w-3 h-3" />
                        <span className="line-clamp-1">{fav.facility.area}</span>
                      </div>

                      {/* Sports Tags */}
                      {fav.facility.sportTypes && fav.facility.sportTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {fav.facility.sportTypes.slice(0, 3).map((sport) => (
                            <span
                              key={sport}
                              className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400"
                            >
                              {sport}
                            </span>
                          ))}
                          {fav.facility.sportTypes.length > 3 && (
                            <span className="px-2 py-0.5 text-xs text-gray-500">
                              +{fav.facility.sportTypes.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Price */}
                      <div className="flex items-center justify-between">
                        <span className="text-primary font-semibold">
                          From {formatAmount(fav.facility.minPrice)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {fav.facility.reviewCount} reviews
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    removeMutation.mutate(fav.facility.id);
                  }}
                  disabled={removingId === fav.facility.id}
                  className="absolute top-3 left-3 p-2 bg-black/70 backdrop-blur rounded-full text-white hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100"
                >
                  {removingId === fav.facility.id ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="text-center py-16 bg-gray-900 rounded-xl border border-gray-800">
          <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No favorites yet</h2>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            Start exploring turfs and tap the heart icon to save your favorite venues for quick access
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-lg hover:bg-primary/90"
          >
            <Search className="w-4 h-4" />
            Explore Turfs
          </Link>
        </div>
      )}
    </div>
  );
}
