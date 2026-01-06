'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ArrowLeft, Zap, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api/client';

type Step = 'phone' | 'otp' | 'name';

export default function PhoneAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtpMessage, setDevOtpMessage] = useState<string | null>(null);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.requestOTP(phone);
      if (response.success) {
        setStep('otp');
        // Check if dev mode message includes OTP
        if (response.message?.includes('[DEV]')) {
          setDevOtpMessage(response.message);
        }
      }
    } catch (err: any) {
      setError(err.error?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.verifyOTP(phone, code, name || undefined);
      if (response.success) {
        api.setToken(response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);

        if (response.data.isNewUser && !name) {
          setStep('name');
        } else {
          router.push(redirect);
        }
      }
    } catch (err: any) {
      setError(err.error?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault();
    // Name already submitted during OTP verification
    router.push(redirect);
  };

  const handleResendOTP = async () => {
    setError(null);
    setOtp(['', '', '', '', '', '']);
    setIsLoading(true);

    try {
      const response = await api.requestOTP(phone);
      if (response.message?.includes('[DEV]')) {
        setDevOtpMessage(response.message);
      }
    } catch (err: any) {
      setError(err.error?.message || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <span className="text-2xl font-bold text-white">
              Sport<span className="text-primary">Zen</span>
            </span>
          </Link>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <AnimatePresence mode="wait">
            {/* Phone Input Step */}
            {step === 'phone' && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h2 className="text-xl font-bold text-white text-center mb-2">
                  Enter your phone number
                </h2>
                <p className="text-gray-400 text-center text-sm mb-6">
                  We'll send you a verification code
                </p>

                <form onSubmit={handleRequestOTP} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        +88
                      </span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="01XXXXXXXXX"
                        maxLength={11}
                        required
                        className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary text-lg tracking-wide"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || phone.length < 10}
                    className="w-full py-3 bg-primary text-black font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Sending...' : 'Send OTP'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* OTP Input Step */}
            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <button
                  onClick={() => setStep('phone')}
                  className="flex items-center gap-1 text-gray-400 hover:text-white mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <h2 className="text-xl font-bold text-white text-center mb-2">
                  Verify your phone
                </h2>
                <p className="text-gray-400 text-center text-sm mb-6">
                  Enter the 6-digit code sent to +88{phone}
                </p>

                {devOtpMessage && (
                  <div className="p-3 mb-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm text-center">
                    {devOtpMessage}
                  </div>
                )}

                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex justify-center gap-2">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="w-12 h-14 text-center text-xl font-bold bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otp.some(d => !d)}
                    className="w-full py-3 bg-primary text-black font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Verifying...' : 'Verify'}
                  </button>
                </form>

                <button
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-1 w-full mt-4 text-gray-400 hover:text-white text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Resend code
                </button>
              </motion.div>
            )}

            {/* Name Input Step (for new users) */}
            {step === 'name' && (
              <motion.div
                key="name"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h2 className="text-xl font-bold text-white text-center mb-2">
                  Welcome! What's your name?
                </h2>
                <p className="text-gray-400 text-center text-sm mb-6">
                  This helps turf owners identify you
                </p>

                <form onSubmit={handleSetName} className="space-y-4">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary"
                  />

                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className="w-full py-3 bg-primary text-black font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Continue
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-gray-400">
          Prefer email?{' '}
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in with email
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
