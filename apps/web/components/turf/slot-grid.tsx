'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { cn } from '@/lib/utils/cn';
import { formatAmount } from '@/lib/utils/money';

export interface SlotData {
  startAt: string;
  endAt: string;
  status: 'available' | 'booked' | 'blocked' | 'disabled' | 'buffer';
  isPeak: boolean;
  price: number | null;
}

export interface SlotGridProps {
  date: Date;
  slots: Record<number, SlotData[]>; // keyed by duration
  allowedDurations: number[];
  selectedSlot: { startAt: string; duration: number } | null;
  onSelectSlot: (slot: { startAt: string; endAt: string; duration: number; price: number; isPeak: boolean }) => void;
  isLoading?: boolean;
}

const STATUS_COLORS = {
  available: 'bg-turf-available hover:bg-turf-available/80 cursor-pointer',
  booked: 'bg-turf-booked cursor-not-allowed',
  blocked: 'bg-turf-blocked cursor-not-allowed',
  disabled: 'bg-gray-800 cursor-not-allowed opacity-50',
  buffer: 'bg-gray-700 cursor-not-allowed',
  selected: 'bg-turf-partial ring-2 ring-white',
} as const;

export function SlotGrid({
  date,
  slots,
  allowedDurations,
  selectedSlot,
  onSelectSlot,
  isLoading = false,
}: SlotGridProps) {
  const [selectedDuration, setSelectedDuration] = useState<number>(
    allowedDurations[0] ?? 60
  );

  const currentSlots = useMemo(() => {
    return slots[selectedDuration] ?? [];
  }, [slots, selectedDuration]);

  const handleSlotClick = (slot: SlotData) => {
    if (slot.status !== 'available' || slot.price === null) return;

    onSelectSlot({
      startAt: slot.startAt,
      endAt: slot.endAt,
      duration: selectedDuration,
      price: slot.price,
      isPeak: slot.isPeak,
    });
  };

  if (isLoading) {
    return <SlotGridSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Date Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {format(date, 'EEEE, MMMM d')}
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-turf-available" />
            Available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-turf-booked" />
            Booked
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-turf-partial" />
            Selected
          </span>
        </div>
      </div>

      {/* Duration Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {allowedDurations.map((duration) => (
          <motion.button
            key={duration}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedDuration(duration)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              selectedDuration === duration
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            )}
          >
            {duration} mins
          </motion.button>
        ))}
      </div>

      {/* Slot Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        <AnimatePresence mode="popLayout">
          {currentSlots.map((slot) => {
            const isSelected =
              selectedSlot?.startAt === slot.startAt &&
              selectedSlot?.duration === selectedDuration;
            const startTime = new Date(slot.startAt);

            return (
              <motion.button
                key={slot.startAt}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={slot.status === 'available' ? { scale: 1.05 } : undefined}
                whileTap={slot.status === 'available' ? { scale: 0.95 } : undefined}
                onClick={() => handleSlotClick(slot)}
                disabled={slot.status !== 'available'}
                className={cn(
                  'relative p-2 rounded-lg text-center transition-all',
                  isSelected ? STATUS_COLORS.selected : STATUS_COLORS[slot.status]
                )}
              >
                <div className="text-sm font-medium text-white">
                  {format(startTime, 'h:mm')}
                </div>
                <div className="text-xs text-gray-200">
                  {format(startTime, 'a')}
                </div>
                {slot.status === 'available' && slot.price !== null && (
                  <div className="text-xs mt-1 font-semibold text-white/90">
                    {formatAmount(slot.price)}
                  </div>
                )}
                {slot.isPeak && slot.status === 'available' && (
                  <span className="absolute -top-1 -right-1 bg-yellow-500 text-[10px] px-1 rounded text-black font-bold">
                    PEAK
                  </span>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {currentSlots.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No slots available for this duration
        </div>
      )}
    </div>
  );
}

function SlotGridSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-gray-800 rounded w-48" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-20 bg-gray-800 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
