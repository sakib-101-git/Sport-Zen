'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Star,
  ThumbsUp,
  Flag,
  ChevronDown,
  User,
  MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';

interface ReviewsProps {
  facilityId: string;
  avgRating?: number;
  totalReviews?: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  player: {
    id: string;
    name: string;
  };
  booking?: {
    sportProfile?: {
      sportType?: {
        name: string;
      };
    };
  };
}

export function Reviews({ facilityId, avgRating, totalReviews = 0 }: ReviewsProps) {
  const queryClient = useQueryClient();
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');

  const { data: reviews, isLoading } = useQuery({
    queryKey: queryKeys.facilities.reviews(facilityId),
    queryFn: async () => {
      const response = await api.getFacilityReviews(facilityId);
      return response.data as Review[];
    },
  });

  const reportMutation = useMutation({
    mutationFn: ({ reviewId, reason }: { reviewId: string; reason: string }) =>
      api.reportReview(reviewId, reason),
    onSuccess: () => {
      setShowReportModal(false);
      setSelectedReviewId(null);
      setReportReason('');
    },
  });

  const handleReport = (reviewId: string) => {
    setSelectedReviewId(reviewId);
    setShowReportModal(true);
  };

  const submitReport = () => {
    if (selectedReviewId && reportReason) {
      reportMutation.mutate({ reviewId: selectedReviewId, reason: reportReason });
    }
  };

  // Calculate rating distribution
  const ratingDistribution = reviews?.reduce((acc, review) => {
    acc[review.rating] = (acc[review.rating] || 0) + 1;
    return acc;
  }, {} as Record<number, number>) || {};

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Average Rating */}
          <div className="text-center">
            <div className="text-5xl font-bold text-white">
              {avgRating?.toFixed(1) || 'N/A'}
            </div>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= (avgRating || 0)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-600'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = ratingDistribution[rating] || 0;
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 w-3">{rating}</span>
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, delay: 0.1 * (5 - rating) }}
                      className="h-full bg-yellow-400"
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Reviews
        </h3>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-800 rounded-full" />
                  <div>
                    <div className="h-4 bg-gray-800 rounded w-24 mb-2" />
                    <div className="h-3 bg-gray-800 rounded w-16" />
                  </div>
                </div>
                <div className="h-4 bg-gray-800 rounded w-full mb-2" />
                <div className="h-4 bg-gray-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : reviews && reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{review.player.name}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= review.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">
                          {format(new Date(review.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleReport(review.id)}
                    className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Report review"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>

                {review.booking?.sportProfile?.sportType?.name && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">
                    {review.booking.sportProfile.sportType.name}
                  </span>
                )}

                <p className="mt-3 text-gray-300 text-sm leading-relaxed">
                  {review.comment}
                </p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No reviews yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Be the first to leave a review after your booking!
            </p>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Report Review</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-primary focus:outline-none"
                >
                  <option value="">Select a reason</option>
                  <option value="SPAM">Spam or irrelevant</option>
                  <option value="INAPPROPRIATE">Inappropriate content</option>
                  <option value="FAKE">Fake review</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                }}
                className="flex-1 py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                disabled={!reportReason || reportMutation.isPending}
                className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {reportMutation.isPending ? 'Reporting...' : 'Report'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
