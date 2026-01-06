'use client';

import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { XCircle, RefreshCw, Home, HelpCircle } from 'lucide-react';

export default function CheckoutFailedPage() {
  const searchParams = useSearchParams();
  const intentId = searchParams.get('intentId');
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    'Payment cancelled': 'You cancelled the payment. Your booking hold may have expired.',
    'Payment failed': 'The payment could not be processed. Please try again or use a different payment method.',
    'Card declined': 'Your card was declined. Please try a different card or payment method.',
    'Insufficient funds': 'Insufficient funds in your account. Please try a different payment method.',
    'Session expired': 'Your payment session expired. Please start a new booking.',
  };

  const displayError = error
    ? errorMessages[decodeURIComponent(error)] || decodeURIComponent(error)
    : 'Your payment could not be processed. Please try again.';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          {/* Error Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-20 h-20 mx-auto mb-6 bg-red-500 rounded-full flex items-center justify-center"
          >
            <XCircle className="w-12 h-12 text-white" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white mb-2">Payment Failed</h1>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">
            {displayError}
          </p>

          {/* Possible reasons */}
          <div className="bg-gray-900 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-gray-400" />
              Common reasons for payment failure
            </h3>
            <ul className="text-sm text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                Insufficient balance in your account
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                Card details entered incorrectly
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                Transaction blocked by your bank
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                Payment session timed out
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {intentId && (
              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href="/"
                className="flex-1 py-3 px-4 bg-primary text-white rounded-lg text-center hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </motion.a>
            )}
            <motion.a
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href="/"
              className="flex-1 py-3 px-4 bg-gray-800 text-white rounded-lg text-center hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go Home
            </motion.a>
          </div>

          {/* Support info */}
          <p className="mt-8 text-sm text-gray-500">
            Need help?{' '}
            <a href="/support" className="text-primary hover:underline">
              Contact Support
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
