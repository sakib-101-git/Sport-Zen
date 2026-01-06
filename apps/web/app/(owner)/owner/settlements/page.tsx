'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format, subMonths } from 'date-fns';
import {
  Wallet,
  Download,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { formatAmount } from '@/lib/utils/money';

export default function OwnerSettlementsPage() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [downloading, setDownloading] = useState<string | null>(null);

  // Generate last 12 months for dropdown
  const months = Array.from({ length: 12 }).map((_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    };
  });

  const { data: settlements, isLoading } = useQuery({
    queryKey: ['owner-settlements', selectedMonth],
    queryFn: async () => {
      const response = await api.getOwnerSettlements(selectedMonth);
      return response.data;
    },
  });

  const handleDownload = async (type: 'pdf' | 'xlsx') => {
    try {
      setDownloading(type);
      const blob = type === 'pdf'
        ? await api.exportSettlementsPDF(selectedMonth)
        : await api.exportSettlementsXLSX(selectedMonth);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement-${selectedMonth}.${type}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Settlements</h1>
          <p className="text-gray-400 mt-1">View your earnings and settlement history</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:border-primary focus:outline-none"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => handleDownload('pdf')}
            disabled={downloading === 'pdf'}
            className="flex items-center gap-2 px-4 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {downloading === 'pdf' ? 'Exporting...' : 'PDF'}
          </button>

          <button
            onClick={() => handleDownload('xlsx')}
            disabled={downloading === 'xlsx'}
            className="flex items-center gap-2 px-4 py-3 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading === 'xlsx' ? 'Exporting...' : 'Excel'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : settlements ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-white">{settlements.totalBookings || 0}</p>
              <p className="text-sm text-gray-400">Total Bookings</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-3xl font-bold text-white">
                {formatAmount(settlements.totalBookingValue || 0)}
              </p>
              <p className="text-sm text-gray-400">Total Booking Value</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary">
                {formatAmount(settlements.ownerCredit || 0)}
              </p>
              <p className="text-sm text-gray-400">Your Earnings</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-2">
                <Wallet className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-3xl font-bold text-white">
                {formatAmount(settlements.netPayout || 0)}
              </p>
              <p className="text-sm text-gray-400">Net Payout</p>
            </motion.div>
          </div>

          {/* Breakdown */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Settlement Breakdown</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">Total Booking Value</span>
                <span className="text-white font-medium">
                  {formatAmount(settlements.totalBookingValue || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">Advance Collected (10%)</span>
                <span className="text-white font-medium">
                  {formatAmount(settlements.totalAdvanceCollected || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">Platform Commission (5%)</span>
                <span className="text-red-400">
                  -{formatAmount(settlements.platformCommission || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">Your Credit from Advances</span>
                <span className="text-green-400">
                  +{formatAmount(settlements.ownerCredit || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">Refunds Processed</span>
                <span className="text-red-400">
                  -{formatAmount(settlements.refundsProcessed || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 bg-primary/10 rounded-lg px-4">
                <span className="text-white font-medium">Net Payout</span>
                <span className="text-primary text-xl font-bold">
                  {formatAmount(settlements.netPayout || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Ledger Entries */}
          {settlements.entries && settlements.entries.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">Ledger Entries</h2>
              </div>

              <div className="divide-y divide-gray-800">
                {settlements.entries.map((entry: any) => (
                  <div key={entry.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {entry.entryType === 'BOOKING_CREDIT' ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : entry.entryType === 'REFUND_DEBIT' ? (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        ) : (
                          <Wallet className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="text-white font-medium">{entry.entryType}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{entry.description}</p>
                      {entry.booking && (
                        <p className="text-xs text-gray-500">
                          Booking: #{entry.booking.bookingNumber}
                        </p>
                      )}
                    </div>
                    <span className={`font-medium ${
                      entry.amount >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {entry.amount >= 0 ? '+' : ''}{formatAmount(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
          <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No settlement data for this month</p>
        </div>
      )}
    </div>
  );
}
