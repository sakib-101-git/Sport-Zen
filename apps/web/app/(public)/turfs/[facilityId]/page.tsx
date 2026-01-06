'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays } from 'date-fns';
import {
  MapPin,
  Phone,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Car,
  Droplets,
  Users,
} from 'lucide-react';
import { SlotGrid } from '@/components/turf/slot-grid';
import { PriceBreakdown } from '@/components/turf/price-breakdown';
import { TurfGallery } from '@/components/turf/turf-gallery';
import { cn } from '@/lib/utils/cn';
import { formatAmount } from '@/lib/utils/money';

interface SelectedSlot {
  startAt: string;
  endAt: string;
  duration: number;
  price: number;
  isPeak: boolean;
}

export default function TurfDetailPage() {
  const params = useParams();
  const facilityId = params.facilityId as string;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPlayArea, setSelectedPlayArea] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  // Fetch facility details
  const { data: facility, isLoading: facilityLoading } = useQuery({
    queryKey: ['facility', facilityId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/facilities/${facilityId}`);
      if (!res.ok) throw new Error('Failed to fetch facility');
      return res.json();
    },
  });

  // Fetch play areas
  const { data: playAreas } = useQuery({
    queryKey: ['playAreas', facilityId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/facilities/${facilityId}/play-areas`);
      if (!res.ok) throw new Error('Failed to fetch play areas');
      return res.json();
    },
    enabled: !!facilityId,
  });

  // Fetch availability for selected play area and date
  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: ['availability', selectedPlayArea, selectedDate.toISOString()],
    queryFn: async () => {
      if (!selectedPlayArea) return null;
      const res = await fetch(
        `/api/v1/availability?conflictGroupId=${selectedPlayArea}&date=${format(selectedDate, 'yyyy-MM-dd')}`
      );
      if (!res.ok) throw new Error('Failed to fetch availability');
      return res.json();
    },
    enabled: !!selectedPlayArea,
  });

  // Set default play area when loaded
  if (playAreas?.length > 0 && !selectedPlayArea) {
    setSelectedPlayArea(playAreas[0].conflictGroupId);
  }

  // Date navigation
  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  const handleBookNow = () => {
    if (!selectedSlot || !selectedPlayArea) return;

    // Navigate to checkout with booking details
    const params = new URLSearchParams({
      playAreaId: playAreas?.find((p: any) => p.conflictGroupId === selectedPlayArea)?.id,
      sportProfileId: availability?.sportProfileId,
      startAt: selectedSlot.startAt,
      duration: selectedSlot.duration.toString(),
    });

    window.location.href = `/checkout/new?${params.toString()}`;
  };

  if (facilityLoading) {
    return <TurfDetailSkeleton />;
  }

  if (!facility) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Facility Not Found</h1>
          <p className="text-gray-400">The turf you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Gallery */}
      <TurfGallery photos={facility.photos || []} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                {facility.name}
              </h1>
              <div className="flex items-center gap-2 text-gray-400 mt-1">
                <MapPin className="w-4 h-4" />
                <span>{facility.address}, {facility.area}</span>
              </div>
            </div>
            {facility.avgRating && (
              <div className="flex items-center gap-1 bg-primary/20 px-3 py-1 rounded-full">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <span className="font-semibold text-primary">
                  {facility.avgRating.toFixed(1)}
                </span>
                <span className="text-gray-400 text-sm">
                  ({facility.reviewCount})
                </span>
              </div>
            )}
          </div>

          {/* Quick Info */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1 text-gray-300">
              <Clock className="w-4 h-4" />
              {facility.openingTime} - {facility.closingTime}
            </div>
            <div className="flex items-center gap-1 text-gray-300">
              <Phone className="w-4 h-4" />
              {facility.contactPhone}
            </div>
          </div>
        </div>

        {/* Amenities */}
        {facility.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {facility.amenities.map((amenity: string) => (
              <span
                key={amenity}
                className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300"
              >
                {amenity}
              </span>
            ))}
          </div>
        )}

        {/* Play Area Selector */}
        {playAreas && playAreas.length > 1 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Select Play Area</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {playAreas.map((area: any) => (
                <button
                  key={area.id}
                  onClick={() => {
                    setSelectedPlayArea(area.conflictGroupId);
                    setSelectedSlot(null);
                  }}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    selectedPlayArea === area.conflictGroupId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  )}
                >
                  {area.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date Selector */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">Select Date</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dates.map((date) => {
              const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedSlot(null);
                  }}
                  className={cn(
                    'flex flex-col items-center px-4 py-2 rounded-lg min-w-[70px] transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  )}
                >
                  <span className="text-xs uppercase">
                    {isToday ? 'Today' : format(date, 'EEE')}
                  </span>
                  <span className="text-lg font-semibold">
                    {format(date, 'd')}
                  </span>
                  <span className="text-xs">
                    {format(date, 'MMM')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot Grid */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">Select Time</h3>
          {availability ? (
            <SlotGrid
              date={selectedDate}
              slots={availability.slots}
              allowedDurations={availability.allowedDurations}
              selectedSlot={selectedSlot ? { startAt: selectedSlot.startAt, duration: selectedSlot.duration } : null}
              onSelectSlot={setSelectedSlot}
              isLoading={availabilityLoading}
            />
          ) : (
            <div className="text-center py-8 text-gray-400">
              Select a play area to view availability
            </div>
          )}
        </div>

        {/* Description */}
        {facility.description && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">About</h3>
            <p className="text-gray-400">{facility.description}</p>
          </div>
        )}
      </div>

      {/* Sticky Book Now Footer */}
      <AnimatePresence>
        {selectedSlot && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 z-50"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">
                  {format(new Date(selectedSlot.startAt), 'EEE, MMM d')} | {selectedSlot.duration} mins
                </div>
                <div className="text-xl font-bold text-white">
                  {formatAmount(selectedSlot.price)}
                  {selectedSlot.isPeak && (
                    <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">
                      PEAK
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  Pay {formatAmount(Math.ceil(selectedSlot.price * 0.1))} advance
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBookNow}
                className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-lg"
              >
                Book Now
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TurfDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <div className="h-64 bg-gray-800" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          <div className="h-8 bg-gray-800 rounded w-64" />
          <div className="h-4 bg-gray-800 rounded w-48" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-20 bg-gray-800 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
