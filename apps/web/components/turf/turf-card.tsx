'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { MapPin, Star, Clock, Zap } from 'lucide-react';
import { formatAmount } from '@/lib/utils/money';

interface TurfCardProps {
  facility: {
    id: string;
    name: string;
    address: string;
    coverPhotoUrl?: string;
    photos?: { url: string }[];
    rating?: number;
    reviewCount?: number;
    distance?: number;
    minPrice?: number;
    maxPrice?: number;
    sportTypes?: string[];
    isAvailableNow?: boolean;
  };
}

export function TurfCard({ facility }: TurfCardProps) {
  const imageUrl = facility.coverPhotoUrl || facility.photos?.[0]?.url || '/images/turf-placeholder.jpg';

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Link href={`/turfs/${facility.id}`}>
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors">
          {/* Image */}
          <div className="relative h-48 overflow-hidden">
            <Image
              src={imageUrl}
              alt={facility.name}
              fill
              className="object-cover transition-transform hover:scale-105"
            />

            {/* Available Now Badge */}
            {facility.isAvailableNow && (
              <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-primary text-black text-xs font-bold rounded-full">
                <Zap className="w-3 h-3" />
                Available Now
              </div>
            )}

            {/* Rating Badge */}
            {facility.rating && (
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/70 text-white text-xs rounded-full">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                {facility.rating.toFixed(1)}
                {facility.reviewCount && (
                  <span className="text-gray-400">({facility.reviewCount})</span>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="text-lg font-semibold text-white line-clamp-1">
              {facility.name}
            </h3>

            <div className="flex items-center gap-1 mt-1 text-sm text-gray-400">
              <MapPin className="w-4 h-4" />
              <span className="line-clamp-1">{facility.address}</span>
            </div>

            {/* Sport Types */}
            {facility.sportTypes && facility.sportTypes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {facility.sportTypes.slice(0, 3).map((sport) => (
                  <span
                    key={sport}
                    className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded"
                  >
                    {sport}
                  </span>
                ))}
                {facility.sportTypes.length > 3 && (
                  <span className="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded">
                    +{facility.sportTypes.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Price & Distance */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
              <div>
                {facility.minPrice && (
                  <div className="text-primary font-semibold">
                    {formatAmount(facility.minPrice)}
                    {facility.maxPrice && facility.maxPrice !== facility.minPrice && (
                      <span className="text-gray-400 text-sm font-normal">
                        {' '}- {formatAmount(facility.maxPrice)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {facility.distance !== undefined && (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  {facility.distance < 1
                    ? `${Math.round(facility.distance * 1000)}m`
                    : `${facility.distance.toFixed(1)}km`}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default TurfCard;
