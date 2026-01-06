'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Edit2,
  LogOut,
  ChevronRight,
  Shield,
  Bell,
  Heart,
  HelpCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { format } from 'date-fns';

export default function PlayerProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.getMe();
        if (response.success) {
          setUser(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch user');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    api.setToken(null);
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{user?.name || 'Player'}</h1>
            <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
            {user?.phone && (
              <p className="text-gray-400 text-sm">{user?.phone}</p>
            )}
            <span className="inline-block mt-2 px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
              {user?.role || 'PLAYER'}
            </span>
          </div>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <Edit2 className="w-5 h-5" />
          </button>
        </div>

        {user?.createdAt && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800 text-sm text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>Member since {format(new Date(user.createdAt), 'MMMM yyyy')}</span>
          </div>
        )}
      </motion.div>

      {/* Profile Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden"
      >
        <h2 className="text-lg font-semibold text-white p-4 border-b border-gray-800">
          Account Information
        </h2>

        <div className="divide-y divide-gray-800">
          <div className="flex items-center gap-4 p-4">
            <Mail className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-400">Email</p>
              <p className="text-white">{user?.email || 'Not set'}</p>
            </div>
            {user?.emailVerified && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                Verified
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 p-4">
            <Phone className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-400">Phone</p>
              <p className="text-white">{user?.phone || 'Not linked'}</p>
            </div>
            {user?.phone ? (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                Linked
              </span>
            ) : (
              <button className="text-sm text-primary hover:underline">
                Link Phone
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden"
      >
        <h2 className="text-lg font-semibold text-white p-4 border-b border-gray-800">
          Quick Links
        </h2>

        <div className="divide-y divide-gray-800">
          <button
            onClick={() => router.push('/favorites')}
            className="flex items-center gap-4 p-4 w-full hover:bg-gray-800/50 transition-colors"
          >
            <Heart className="w-5 h-5 text-red-400" />
            <span className="flex-1 text-left text-white">Favorite Turfs</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => router.push('/bookings')}
            className="flex items-center gap-4 p-4 w-full hover:bg-gray-800/50 transition-colors"
          >
            <Calendar className="w-5 h-5 text-blue-400" />
            <span className="flex-1 text-left text-white">Booking History</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          <button className="flex items-center gap-4 p-4 w-full hover:bg-gray-800/50 transition-colors">
            <Bell className="w-5 h-5 text-yellow-400" />
            <span className="flex-1 text-left text-white">Notifications</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          <button className="flex items-center gap-4 p-4 w-full hover:bg-gray-800/50 transition-colors">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="flex-1 text-left text-white">Privacy & Security</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          <button className="flex items-center gap-4 p-4 w-full hover:bg-gray-800/50 transition-colors">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            <span className="flex-1 text-left text-white">Help & Support</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </motion.div>

      {/* Logout Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full p-4 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </motion.div>

      {/* App Info */}
      <div className="text-center mt-8 text-gray-500 text-sm">
        <p>SportZen v1.0.0</p>
        <p className="mt-1">© 2024 SportZen. All rights reserved.</p>
      </div>
    </div>
  );
}
