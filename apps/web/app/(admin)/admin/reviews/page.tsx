'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  MessageSquare,
  Search,
  Star,
  Eye,
  EyeOff,
  AlertTriangle,
  Flag,
  User,
  Building2,
} from 'lucide-react';
import { api } from '@/lib/api/client';

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => {
      const response = await api.getAdminReviews();
      return response.data;
    },
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'hide' | 'restore' }) =>
      api.moderateReview(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
  });

  const filteredReviews = reviews?.filter((r: any) => {
    const matchesSearch =
      r.comment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.facility?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterType === 'reported') return r.reports?.length > 0;
    if (filterType === 'hidden') return !r.isVisible;
    if (filterType === 'visible') return r.isVisible;
    return matchesSearch;
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
      />
    ));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Review Moderation</h1>
        <p className="text-gray-400 mt-1">Manage and moderate user reviews</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:border-primary focus:outline-none"
        >
          <option value="all">All Reviews</option>
          <option value="reported">Reported</option>
          <option value="hidden">Hidden</option>
          <option value="visible">Visible</option>
        </select>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredReviews && filteredReviews.length > 0 ? (
        <div className="space-y-4">
          {filteredReviews.map((review: any) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-gray-900 rounded-xl p-6 border ${
                review.reports?.length > 0
                  ? 'border-red-500/30'
                  : !review.isVisible
                  ? 'border-gray-700'
                  : 'border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex">{renderStars(review.rating)}</div>
                    {!review.isVisible && (
                      <span className="px-2 py-1 text-xs bg-gray-700 text-gray-400 rounded-full">
                        Hidden
                      </span>
                    )}
                    {review.reports?.length > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full">
                        <Flag className="w-3 h-3" />
                        {review.reports.length} Reports
                      </span>
                    )}
                  </div>

                  {review.title && (
                    <h3 className="font-medium text-white mb-1">{review.title}</h3>
                  )}

                  <p className="text-gray-400 mb-3">{review.comment}</p>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {review.user?.name}
                    </div>
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {review.facility?.name}
                    </div>
                    <span>{format(new Date(review.createdAt), 'MMM d, yyyy')}</span>
                  </div>

                  {review.reports?.length > 0 && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-sm text-red-400 font-medium mb-1">
                        Report Reasons:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {review.reports.map((report: any, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded"
                          >
                            {report.reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {review.isVisible ? (
                    <button
                      onClick={() => moderateMutation.mutate({ id: review.id, action: 'hide' })}
                      disabled={moderateMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <EyeOff className="w-4 h-4" />
                      Hide
                    </button>
                  ) : (
                    <button
                      onClick={() => moderateMutation.mutate({ id: review.id, action: 'restore' })}
                      disabled={moderateMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4" />
                      Restore
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No reviews found</p>
        </div>
      )}
    </div>
  );
}
