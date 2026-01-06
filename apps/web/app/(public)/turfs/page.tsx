'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Filter, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TurfCard } from '@/components/turf/turf-card';
import { TurfCardSkeleton } from '@/components/common/skeletons';
import { api } from '@/lib/api/client';

const sportOptions = [
  { value: '', label: 'All Sports' },
  { value: 'football', label: 'Football' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'badminton', label: 'Badminton' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'basketball', label: 'Basketball' },
];

const sortOptions = [
  { value: 'distance', label: 'Nearest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
];

export default function TurfsListingPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialSport = searchParams.get('sport') || '';
  const initialAvailableNow = searchParams.get('availableNow') === 'true';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedSport, setSelectedSport] = useState(initialSport);
  const [sortBy, setSortBy] = useState('distance');
  const [availableNow, setAvailableNow] = useState(initialAvailableNow);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setLocation({ lat: 23.8103, lng: 90.4125 });
        }
      );
    } else {
      setLocation({ lat: 23.8103, lng: 90.4125 });
    }
  }, []);

  const { data: facilities, isLoading, error, refetch } = useQuery({
    queryKey: ['facilities', 'search', location, selectedSport, sortBy, availableNow, priceRange, minRating],
    queryFn: async () => {
      const params: any = {
        lat: location?.lat,
        lng: location?.lng,
        radiusKm: 50,
        limit: 50,
      };

      if (selectedSport) params.sport = selectedSport;
      if (availableNow) params.availableNow = true;
      if (priceRange[0] > 0) params.minPrice = priceRange[0];
      if (priceRange[1] < 5000) params.maxPrice = priceRange[1];
      if (minRating > 0) params.rating = minRating;

      const response = await api.searchFacilities(params);
      return response.data;
    },
    enabled: !!location,
  });

  const clearFilters = () => {
    setSelectedSport('');
    setAvailableNow(false);
    setPriceRange([0, 5000]);
    setMinRating(0);
  };

  const hasActiveFilters = selectedSport || availableNow || priceRange[0] > 0 || priceRange[1] < 5000 || minRating > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 pb-24">
        <div className="max-w-7xl mx-auto px-4">
          {/* Search Header */}
          <div className="mb-6">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search turfs..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-xl border transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-primary text-black border-primary'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedSport && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">
                    {sportOptions.find(s => s.value === selectedSport)?.label}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedSport('')} />
                  </span>
                )}
                {availableNow && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">
                    Available Now
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setAvailableNow(false)} />
                  </span>
                )}
                {minRating > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">
                    {minRating}+ Stars
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setMinRating(0)} />
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Sport</label>
                  <select
                    value={selectedSport}
                    onChange={(e) => setSelectedSport(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    {sportOptions.map((sport) => (
                      <option key={sport.value} value={sport.value}>
                        {sport.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Min Rating</label>
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    <option value={0}>Any</option>
                    <option value={3}>3+ Stars</option>
                    <option value={4}>4+ Stars</option>
                    <option value={4.5}>4.5+ Stars</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={availableNow}
                      onChange={(e) => setAvailableNow(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-700 text-primary focus:ring-primary"
                    />
                    <span className="text-white">Available Now</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {/* Results */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-gray-400">
              {isLoading ? 'Searching...' : `${facilities?.length || 0} turfs found`}
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <TurfCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">Failed to load turfs</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-primary text-black rounded-lg"
              >
                Try Again
              </button>
            </div>
          ) : facilities && facilities.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {facilities.map((facility: any) => (
                <TurfCard key={facility.id} facility={facility} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No turfs found</p>
              <p className="text-gray-500 text-sm">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
