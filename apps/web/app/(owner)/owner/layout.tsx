'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  List,
  Lock,
  Building2,
  Users,
  Wallet,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api/client';

const sidebarLinks = [
  { href: '/owner', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/owner/calendar', label: 'Calendar', icon: Calendar },
  { href: '/owner/bookings', label: 'Bookings', icon: List },
  { href: '/owner/blocks', label: 'Blocks', icon: Lock },
  { href: '/owner/facilities', label: 'Facilities', icon: Building2 },
  { href: '/owner/staff', label: 'Staff', icon: Users },
  { href: '/owner/settlements', label: 'Settlements', icon: Wallet },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getToken();
      if (!token) {
        router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }

      try {
        const response = await api.getMe();
        if (response.success) {
          const userData = response.data;
          // Check if user is owner or owner_staff
          if (!['OWNER', 'OWNER_STAFF'].includes(userData.role)) {
            router.push('/dashboard');
            return;
          }
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        api.setToken(null);
        router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname));
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    api.setToken(null);
    router.push('/auth/login');
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900 border-b border-gray-800 z-50 flex items-center justify-between px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-gray-400 hover:text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="text-primary font-bold text-lg">SportZen Owner</span>
        <div className="w-10" />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-50
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <span className="text-primary font-bold text-xl">SportZen</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-800">
          <p className="text-white font-medium truncate">{user?.name}</p>
          <p className="text-gray-400 text-sm truncate">{user?.email}</p>
          <span className="inline-block mt-2 px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
            {user?.role}
          </span>
        </div>

        <nav className="p-4 space-y-1">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href ||
              (link.href !== '/owner' && pathname.startsWith(link.href));
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                  ${isActive
                    ? 'bg-primary/20 text-primary'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{link.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
