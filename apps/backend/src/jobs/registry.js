const { runStaleOrdersJob } = require('./tasks/stale-orders');
const { runTableReconciliationJob } = require('./tasks/table-reconciliation');
const { runLowStockAlertJob } = require('./tasks/low-stock-alert');
const { runDailySalesDigestJob } = require('./tasks/daily-sales-digest');
const { runPromoArchivalJob } = require('./tasks/promo-archival');
const { runRetentionCleanupJob } = require('./tasks/retention-cleanup');

const JOB_REGISTRY = {
  STALE_ORDERS_EXPIRATION: {
    key: 'STALE_ORDERS_EXPIRATION',
    title: 'Stale Order Auto-Cancellation',
    category: 'Data Hygiene',
    icon: 'clock',
    description: 'Cancels unfulfilled guest or POS orders lingering in draft or unverified state beyond the specified timeout.',
    defaultSchedule: '*/30 * * * *',
    defaultScheduleLabel: 'Every 30 minutes',
    scheduleOptions: [
      { label: 'Every 15 minutes', value: '*/15 * * * *' },
      { label: 'Every 30 minutes', value: '*/30 * * * *' },
      { label: 'Every 1 hour', value: '0 * * * *' },
      { label: 'Every 2 hours', value: '0 */2 * * *' }
    ],
    defaultParams: {
      staleHours: 2
    },
    paramSchema: [
      {
        key: 'staleHours',
        label: 'Order Inactivity Threshold (Hours)',
        type: 'number',
        default: 2,
        min: 1,
        max: 24,
        helper: 'Orders in DRAFT / PENDING_VERIFICATION older than this will be auto-cancelled.'
      }
    ],
    isDestructive: false,
    runner: runStaleOrdersJob
  },

  TABLE_SESSION_RECONCILIATION: {
    key: 'TABLE_SESSION_RECONCILIATION',
    title: 'Table Turnover & No-Show Sync',
    category: 'Tables & Floor',
    icon: 'table',
    description: 'Frees up tables whose diners have settled and left, and updates overdue reservations past their grace period to No-Show.',
    defaultSchedule: '*/15 * * * *',
    defaultScheduleLabel: 'Every 15 minutes',
    scheduleOptions: [
      { label: 'Every 10 minutes', value: '*/10 * * * *' },
      { label: 'Every 15 minutes', value: '*/15 * * * *' },
      { label: 'Every 30 minutes', value: '*/30 * * * *' },
      { label: 'Every 1 hour', value: '0 * * * *' }
    ],
    defaultParams: {
      idleMinutes: 45,
      reservationGraceMinutes: 45
    },
    paramSchema: [
      {
        key: 'idleMinutes',
        label: 'Auto-Free Table Settled (Minutes)',
        type: 'number',
        default: 45,
        min: 15,
        max: 180,
        helper: 'Frees up the table once all orders are settled and idle for this many minutes.'
      },
      {
        key: 'reservationGraceMinutes',
        label: 'Reservation No-Show Grace (Minutes)',
        type: 'number',
        default: 45,
        min: 15,
        max: 120,
        helper: 'Marks confirmed bookings as No-Show if guest arrival is overdue by this threshold.'
      }
    ],
    isDestructive: false,
    runner: runTableReconciliationJob
  },

  LOW_STOCK_ALERT: {
    key: 'LOW_STOCK_ALERT',
    title: 'Raw Ingredient Low-Stock Alert',
    category: 'Inventory',
    icon: 'package',
    description: 'Scans raw materials and ingredients against minimum reorder thresholds and emails an alert digest before meal rushes.',
    defaultSchedule: '0 9,16 * * *',
    defaultScheduleLabel: 'Twice daily at 9:00 AM & 4:00 PM',
    scheduleOptions: [
      { label: 'Once daily at 9:00 AM', value: '0 9 * * *' },
      { label: 'Twice daily (9:00 AM & 4:00 PM)', value: '0 9,16 * * *' },
      { label: 'Closing shift at 10:00 PM', value: '0 22 * * *' },
      { label: 'Every 4 hours', value: '0 */4 * * *' }
    ],
    defaultParams: {
      recipientEmails: ''
    },
    paramSchema: [
      {
        key: 'recipientEmails',
        label: 'Additional Alert Email Recipients',
        type: 'string',
        default: '',
        placeholder: 'chef@restaurant.com, manager@store.com',
        helper: 'Comma-separated emails to receive the low-stock alert table. Store manager and store contact email are included automatically.'
      }
    ],
    isDestructive: false,
    runner: runLowStockAlertJob
  },

  DAILY_SALES_DIGEST: {
    key: 'DAILY_SALES_DIGEST',
    title: 'End-of-Day Sales & Operations Digest',
    category: 'Finance & Sales',
    icon: 'chart',
    description: 'Generates a financial summary of settled orders, taxes, discounts, cash vs online breakdown, and top 5 bestsellers.',
    defaultSchedule: '55 23 * * *',
    defaultScheduleLabel: 'Daily at 11:55 PM',
    scheduleOptions: [
      { label: 'Daily at 10:00 PM', value: '0 22 * * *' },
      { label: 'Daily at 11:00 PM', value: '0 23 * * *' },
      { label: 'Daily at 11:55 PM', value: '55 23 * * *' },
      { label: 'Daily at Midnight (12:00 AM)', value: '0 0 * * *' }
    ],
    defaultParams: {
      recipientEmails: ''
    },
    paramSchema: [
      {
        key: 'recipientEmails',
        label: 'Additional Digest Email Recipients',
        type: 'string',
        default: '',
        placeholder: 'owner@brand.com, finance@brand.com',
        helper: 'Comma-separated emails to receive the end-of-day summary. Store manager and store contact email are included automatically.'
      }
    ],
    isDestructive: false,
    runner: runDailySalesDigestJob
  },

  EXPIRED_PROMO_ARCHIVAL: {
    key: 'EXPIRED_PROMO_ARCHIVAL',
    title: 'Expired Promo & Offer Deactivation',
    category: 'Marketing',
    icon: 'tag',
    description: 'Finds discount coupon codes past their expiration date and sets them to inactive so they cannot be applied in POS or digital menus.',
    defaultSchedule: '0 0 * * *',
    defaultScheduleLabel: 'Daily at Midnight',
    scheduleOptions: [
      { label: 'Daily at Midnight', value: '0 0 * * *' },
      { label: 'Twice daily (12:00 AM & 12:00 PM)', value: '0 0,12 * * *' },
      { label: 'Every 6 hours', value: '0 */6 * * *' }
    ],
    defaultParams: {},
    paramSchema: [],
    isDestructive: false,
    runner: runPromoArchivalJob
  },

  RETENTION_CLEANUP: {
    key: 'RETENTION_CLEANUP',
    title: 'Old Cancelled Orders Storage Pruner',
    category: 'Data Hygiene',
    icon: 'trash',
    description: 'Permanently deletes cancelled orders older than the retention threshold to keep the database optimized and lightweight.',
    defaultSchedule: '0 3 * * 0',
    defaultScheduleLabel: 'Weekly on Sunday at 3:00 AM',
    scheduleOptions: [
      { label: 'Daily at 3:00 AM', value: '0 3 * * *' },
      { label: 'Weekly (Sunday at 3:00 AM)', value: '0 3 * * 0' },
      { label: 'Monthly (1st at 3:00 AM)', value: '0 3 1 * *' }
    ],
    defaultParams: {
      retentionDays: 30
    },
    paramSchema: [
      {
        key: 'retentionDays',
        label: 'Data Retention Window (Days)',
        type: 'number',
        default: 30,
        min: 7,
        max: 365,
        helper: 'Cancelled orders older than this number of days will be permanently purged from the database.'
      }
    ],
    isDestructive: true,
    runner: runRetentionCleanupJob
  }
};

module.exports = {
  JOB_REGISTRY
};
