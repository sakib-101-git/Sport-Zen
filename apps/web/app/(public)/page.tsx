'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, MapPin, Filter, Zap, Star, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TurfCard } from '@/components/turf/turf-card';
import { TurfCardSkeleton } from '@/components/common/skeletons';
import { api } from '@/lib/api/client';

const sportFilters = [
  { id: 'all', label: 'All Sports' },
  { id: 'football', label: 'Football' },
  { id: 'cricket', label: 'Cricket' },
  { id: 'badminton', label: 'Badminton' },
  { id: 'tennis', label: 'Tennis' },
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setLocationError('Unable to get location. Showing all facilities.');
          // Default to Dhaka center
          setLocation({ lat: 23.8103, lng: 90.4125 });
        }
      );
    } else {
      setLocation({ lat: 23.8103, lng: 90.4125 });
    }
  }, []);

  // Fetch nearby facilities
  const { data: facilities, isLoading, error } = useQuery({
    queryKey: ['facilities', 'nearby', location?.lat, location?.lng, selectedSport],
    queryFn: async () => {
      const params: any = {
        lat: location?.lat,
        lng: location?.lng,
        radiusKm: 20,
        limit: 12,
      };

      if (selectedSport !== 'all') {
        params.sport = selectedSport;
      }

      const response = await api.searchFacilities(params);
      return response.data;
    },
    enabled: !!location,
  });

  // Fetch available now facilities
  const { data: availableNow } = useQuery({
    queryKey: ['facilities', 'availableNow', location?.lat, location?.lng],
    queryFn: async () => {
      const response = await api.searchFacilities({
        lat: location?.lat,
        lng: location?.lng,
        radiusKm: 10,
        availableNow: true,
        limit: 6,
      });
      return response.data;
    },
    enabled: !!location,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/turfs?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header variant="transparent" />

      {/* Hero Section */}
      <section className="relative pt-16 pb-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />

        <div className="relative max-w-7xl mx-auto px-4 pt-12 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Book Your Perfect
              <span className="text-primary"> Turf</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              Find and book the best sports turfs near you. Play football, cricket, badminton and more.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search turfs, locations, sports..."
                    className="w-full pl-12 pr-4 py-4 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                >
                  <Filter className="w-5 h-5 text-gray-400" />
                </button>
                <button
                  type="submit"
                  className="px-8 py-4 bg-primary text-black font-semibold rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Location Status */}
            {locationError ? (
              <p className="mt-4 text-sm text-yellow-500">{locationError}</p>
            ) : location ? (
              <p className="mt-4 text-sm text-gray-500 flex items-center justify-center gap-1">
                <MapPin className="w-4 h-4" />
                Showing turfs near your location
              </p>
            ) : null}
          </motion.div>

          {/* Sport Filters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex gap-2 overflow-x-auto py-6 scrollbar-hide"
          >
            {sportFilters.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setSelectedSport(sport.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedSport === sport.id
                    ? 'bg-primary text-black'
                    : 'bg-gray-900 text-gray-400 hover:text-white'
                }`}
              >
                {sport.label}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Available Now Section */}
      {availableNow && availableNow.length > 0 && (
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-white">Available Now</h2>
              </div>
              <button
                onClick={() => router.push('/turfs?availableNow=true')}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableNow.slice(0, 3).map((facility: any) => (
                <TurfCard key={facility.id} facility={{ ...facility, isAvailableNow: true }} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Turfs Section */}
      <section className="py-8 pb-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Nearby Turfs</h2>
            <button
              onClick={() => router.push('/turfs')}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <TurfCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400">Failed to load turfs. Please try again.</p>
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
              <p className="text-gray-400">No turfs found nearby.</p>
              <button
                onClick={() => router.push('/turfs')}
                className="mt-4 px-6 py-2 bg-primary text-black rounded-lg hover:bg-primary/90"
              >
                Browse All Turfs
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Why Choose SportZen?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Instant Booking</h3>
              <p className="text-gray-400">
                Book your slot in seconds with real-time availability and instant confirmation.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Best Venues</h3>
              <p className="text-gray-400">
                Curated selection of top-rated sports venues in your city with verified reviews.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                <Star className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Easy Payments</h3>
              <p className="text-gray-400">
                Pay just 10% advance online. Complete payment at the venue when you play.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
