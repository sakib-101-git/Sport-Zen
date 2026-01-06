'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StickyFooterProps {
  children: ReactNode;
  show?: boolean;
  className?: string;
}

export function StickyFooter({ children, show = true, className = '' }: StickyFooterProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`fixed bottom-0 left-0 right-0 z-40 ${className}`}
        >
          {/* Gradient overlay for smooth transition */}
          <div className="absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />

          {/* Footer content */}
          <div className="bg-gray-950 border-t border-gray-800 px-4 py-3 safe-area-bottom">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Book Now Footer
 * Used on turf detail page
 */
interface BookNowFooterProps {
  price: string;
  priceLabel?: string;
  onBook: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function BookNowFooter({
  price,
  priceLabel = 'Starting from',
  onBook,
  disabled = false,
  loading = false,
}: BookNowFooterProps) {
  return (
    <StickyFooter>
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        <div>
          <p className="text-xs text-gray-400">{priceLabel}</p>
          <p className="text-xl font-bold text-white">{price}</p>
        </div>
        <button
          onClick={onBook}
          disabled={disabled || loading}
          className="px-8 py-3 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
              />
              Processing...
            </>
          ) : (
            'Book Now'
          )}
        </button>
      </div>
    </StickyFooter>
  );
}

/**
 * Confirm Booking Footer
 * Used during slot selection
 */
interface ConfirmBookingFooterProps {
  selectedSlot?: {
    time: string;
    duration: string;
    price: string;
  };
  onConfirm: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export function ConfirmBookingFooter({
  selectedSlot,
  onConfirm,
  onClear,
  disabled = false,
}: ConfirmBookingFooterProps) {
  return (
    <StickyFooter show={!!selectedSlot}>
      {selectedSlot && (
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white font-medium">{selectedSlot.time}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">{selectedSlot.duration}</span>
            </div>
            <p className="text-lg font-bold text-primary">{selectedSlot.price}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="px-4 py-2.5 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onConfirm}
              disabled={disabled}
              className="px-6 py-2.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </StickyFooter>
  );
}

/**
 * Payment Footer
 * Used on checkout page
 */
interface PaymentFooterProps {
  advanceAmount: string;
  onPay: () => void;
  disabled?: boolean;
  loading?: boolean;
  timeRemaining?: string;
}

export function PaymentFooter({
  advanceAmount,
  onPay,
  disabled = false,
  loading = false,
  timeRemaining,
}: PaymentFooterProps) {
  return (
    <StickyFooter>
      <div className="max-w-screen-xl mx-auto">
        {timeRemaining && (
          <div className="flex items-center justify-center gap-2 mb-2 text-sm text-yellow-400">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 bg-yellow-400 rounded-full"
            />
            <span>Hold expires in {timeRemaining}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Pay Advance</p>
            <p className="text-2xl font-bold text-primary">{advanceAmount}</p>
          </div>
          <button
            onClick={onPay}
            disabled={disabled || loading}
            className="px-10 py-3.5 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 text-lg"
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
                />
                Processing...
              </>
            ) : (
              'Pay Now'
            )}
          </button>
        </div>
      </div>
    </StickyFooter>
  );
}
