'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  User,
  LogOut,
  Settings,
  Calendar,
  MapPin,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api/client';

interface HeaderProps {
  variant?: 'default' | 'transparent';
}

export function Header({ variant = 'default' }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = api.getToken();
        if (token) {
          const response = await api.getMe();
          if (response.success) {
            setUser(response.data);
          }
        }
      } catch (error) {
        // Not authenticated
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.logout(refreshToken);
      }
    } catch (error) {
      // Continue with logout anyway
    } finally {
      api.setToken(null);
      localStorage.removeItem('refreshToken');
      setUser(null);
      router.push('/');
    }
  };

  const navLinks = [
    { href: '/', label: 'Find Turfs' },
    { href: '/turfs', label: 'Browse All' },
  ];

  const userLinks = user
    ? [
        { href: '/dashboard', label: 'Dashboard', icon: Calendar },
        { href: '/bookings', label: 'My Bookings', icon: MapPin },
        { href: '/profile', label: 'Profile', icon: Settings },
      ]
    : [];

  const bgClass = variant === 'transparent'
    ? 'bg-transparent'
    : 'bg-gray-900/95 backdrop-blur-sm border-b border-gray-800';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 ${bgClass}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold text-white">
              Sport<span className="text-primary">Zen</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="w-8 h-8 bg-gray-800 rounded-full animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="hidden sm:block text-sm text-white">
                    {user.name?.split(' ')[0] || 'User'}
                  </span>
                </button>

                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-lg overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-800">
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email || user.phone}</p>
                        <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">
                          {user.role}
                        </span>
                      </div>

                      <div className="py-2">
                        {userLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                          >
                            <link.icon className="w-4 h-4" />
                            {link.label}
                          </Link>
                        ))}

                        {user.role === 'OWNER' && (
                          <Link
                            href="/owner"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-primary hover:bg-gray-800 transition-colors"
                          >
                            <Calendar className="w-4 h-4" />
                            Owner Panel
                          </Link>
                        )}

                        {user.role === 'SUPER_ADMIN' && (
                          <Link
                            href="/admin"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-primary hover:bg-gray-800 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                            Admin Panel
                          </Link>
                        )}
                      </div>

                      <div className="border-t border-gray-800 py-2">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2 text-sm font-medium bg-primary text-black rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-gray-900 border-t border-gray-800"
          >
            <nav className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Header;
