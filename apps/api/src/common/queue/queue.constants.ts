// Queue Names
export const QUEUE_HOLD_EXPIRY = 'hold-expiry';
export const QUEUE_AUTO_COMPLETE = 'auto-complete';
export const QUEUE_REMINDERS = 'reminders';
export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_INVOICES = 'invoices';

// Job Names
export const JOB_EXPIRE_HOLD = 'expire-hold';
export const JOB_AUTO_COMPLETE_BOOKING = 'auto-complete-booking';
export const JOB_SEND_REMINDER = 'send-reminder';
export const JOB_SEND_NOTIFICATION = 'send-notification';
export const JOB_GENERATE_MONTHLY_INVOICE = 'generate-monthly-invoice';
export const JOB_PROCESS_SETTLEMENTS = 'process-settlements';

// Job Delays and Intervals
export const REMINDER_BEFORE_BOOKING_MS = 60 * 60 * 1000; // 1 hour before
export const REMINDER_DAY_BEFORE_MS = 24 * 60 * 60 * 1000; // 24 hours before

// Cron Expressions (Asia/Dhaka timezone)
export const CRON_DAILY_MIDNIGHT = '0 0 * * *';
export const CRON_MONTHLY_FIRST = '0 0 1 * *';
export const CRON_EVERY_MINUTE = '* * * * *';
export const CRON_EVERY_5_MINUTES = '*/5 * * * *';

// Job Options
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
};

export const HOLD_EXPIRY_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 5, // More attempts for critical payment-related jobs
};

export const NOTIFICATION_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 2, // Fewer retries for notifications
  priority: 10, // Lower priority than core booking jobs
};
