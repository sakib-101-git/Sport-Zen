'use client';

import { motion } from 'framer-motion';
import { formatAmount } from '@/lib/utils/money';

interface PriceBreakdownProps {
  duration: number; // in minutes
  basePrice: number;
  isPeakTime: boolean;
  peakPrice?: number;
  advancePercentage?: number;
  sportType: string;
  showDetails?: boolean;
}

export function PriceBreakdown({
  duration,
  basePrice,
  isPeakTime,
  peakPrice,
  advancePercentage = 0.10,
  sportType,
  showDetails = true,
}: PriceBreakdownProps) {
  const totalPrice = isPeakTime && peakPrice ? peakPrice : basePrice;
  const advanceAmount = Math.ceil(totalPrice * advancePercentage);
  const remainingAmount = totalPrice - advanceAmount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-lg font-semibold text-white">Price Breakdown</h3>
        <p className="text-sm text-gray-400 mt-1">
          {sportType} - {duration} minutes
          {isPeakTime && (
            <span className="ml-2 px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
              Peak Time
            </span>
          )}
        </p>
      </div>

      {/* Price Details */}
      <div className="p-4 space-y-3">
        {showDetails && (
          <>
            {/* Duration Price */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {isPeakTime ? 'Peak Rate' : 'Base Rate'} ({duration} min)
              </span>
              <span className="text-white">{formatAmount(totalPrice)}</span>
            </div>

            {/* Discount or adjustment if any */}
            {isPeakTime && peakPrice && peakPrice > basePrice && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 line-through">
                  Regular: {formatAmount(basePrice)}
                </span>
                <span className="text-orange-400 text-xs">
                  +{formatAmount(peakPrice - basePrice)} peak surcharge
                </span>
              </div>
            )}

            <div className="border-t border-gray-800 pt-3 mt-3" />
          </>
        )}

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-gray-300 font-medium">Total Amount</span>
          <span className="text-xl font-bold text-white">{formatAmount(totalPrice)}</span>
        </div>

        <div className="border-t border-gray-800 pt-3 mt-3" />

        {/* Payment Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full" />
              <span className="text-gray-400">Advance Payment (10%)</span>
            </div>
            <span className="text-primary font-semibold">{formatAmount(advanceAmount)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-600 rounded-full" />
              <span className="text-gray-400">Pay at Venue (90%)</span>
            </div>
            <span className="text-gray-300">{formatAmount(remainingAmount)}</span>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-800">
        <p className="text-xs text-gray-500">
          Pay {formatAmount(advanceAmount)} now to confirm your booking.
          The remaining {formatAmount(remainingAmount)} will be collected at the venue.
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Compact price display for slot grid
 */
interface CompactPriceProps {
  price: number;
  isPeak?: boolean;
  duration: number;
}

export function CompactPrice({ price, isPeak, duration }: CompactPriceProps) {
  return (
    <div className="flex items-center gap-1">
      <span className={`font-semibold ${isPeak ? 'text-orange-400' : 'text-white'}`}>
        {formatAmount(price)}
      </span>
      <span className="text-xs text-gray-500">/ {duration}min</span>
      {isPeak && (
        <span className="text-xs px-1 py-0.5 bg-orange-500/20 text-orange-400 rounded">
          Peak
        </span>
      )}
    </div>
  );
}

/**
 * Summary card for checkout
 */
interface BookingSummaryProps {
  facilityName: string;
  playAreaName: string;
  sportType: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  advanceAmount: number;
  isPeakTime: boolean;
}

export function BookingSummary({
  facilityName,
  playAreaName,
  sportType,
  date,
  startTime,
  endTime,
  duration,
  totalPrice,
  advanceAmount,
  isPeakTime,
}: BookingSummaryProps) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Booking Summary</h3>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Facility</span>
          <span className="text-white">{facilityName}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Play Area</span>
          <span className="text-white">{playAreaName}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Sport</span>
          <span className="text-white">{sportType}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Date</span>
          <span className="text-white">{date}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Time</span>
          <span className="text-white">
            {startTime} - {endTime}
            {isPeakTime && (
              <span className="ml-2 text-xs text-orange-400">(Peak)</span>
            )}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Duration</span>
          <span className="text-white">{duration} minutes</span>
        </div>

        <div className="border-t border-gray-800 pt-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Total</span>
            <span className="text-white font-semibold">{formatAmount(totalPrice)}</span>
          </div>
        </div>

        <div className="bg-primary/10 rounded-lg p-3 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-primary font-medium">Pay Now</span>
            <span className="text-primary text-xl font-bold">{formatAmount(advanceAmount)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            10% advance • Remaining to be paid at venue
          </p>
        </div>
      </div>
    </div>
  );
}
