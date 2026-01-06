'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gray-900 rounded-xl p-12 text-center border border-gray-800 ${className}`}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.1 }}
        className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <Icon className="w-8 h-8 text-gray-500" />
      </motion.div>

      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>

      {description && (
        <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className="px-6 py-2.5 bg-primary text-black font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-6 py-2.5 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Preset empty states for common scenarios
 */

interface PresetEmptyStateProps {
  onAction?: () => void;
}

export function NoBookingsEmptyState({ onAction }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={require('lucide-react').Calendar}
      title="No bookings yet"
      description="Start by exploring facilities near you and booking your first game!"
      action={onAction ? { label: 'Find a Turf', onClick: onAction } : undefined}
    />
  );
}

export function NoFacilitiesEmptyState({ onAction }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={require('lucide-react').Building2}
      title="No facilities found"
      description="Try adjusting your search filters or expanding your search area."
      action={onAction ? { label: 'Clear Filters', onClick: onAction } : undefined}
    />
  );
}

export function NoReviewsEmptyState() {
  return (
    <EmptyState
      icon={require('lucide-react').MessageSquare}
      title="No reviews yet"
      description="Be the first to leave a review after your booking!"
    />
  );
}

export function NoSearchResultsEmptyState({ onAction }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={require('lucide-react').Search}
      title="No results found"
      description="We couldn't find anything matching your search. Try different keywords or filters."
      action={onAction ? { label: 'Clear Search', onClick: onAction } : undefined}
    />
  );
}

export function NoNotificationsEmptyState() {
  return (
    <EmptyState
      icon={require('lucide-react').Bell}
      title="All caught up!"
      description="You have no new notifications."
    />
  );
}

export function ErrorEmptyState({ onAction }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={require('lucide-react').AlertCircle}
      title="Something went wrong"
      description="We encountered an error loading this content. Please try again."
      action={onAction ? { label: 'Retry', onClick: onAction } : undefined}
    />
  );
}
