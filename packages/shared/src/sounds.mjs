/**
 * The notification sounds a store can choose from. Kept apart from the player so the backend
 * can check a saved choice without loading browser audio code.
 */
export const NOTIFICATION_SOUNDS = [
  { key: 'classic', label: 'Classic', description: 'The standard Scan My Order tone' },
  { key: 'chime', label: 'Chime', description: 'Two soft rising notes' },
  { key: 'bell', label: 'Bell', description: 'One clear bell that rings out' },
  { key: 'dingdong', label: 'Ding-dong', description: 'A doorbell: high, then low' },
  { key: 'beeps', label: 'Triple beep', description: 'Three short, sharp beeps' },
  { key: 'alert', label: 'Loud alert', description: 'Urgent and hard to miss, for noisy kitchens' },
  { key: 'soft', label: 'Soft', description: 'One gentle note, for quiet dining rooms' },
];

export const NOTIFICATION_SOUND_KEYS = NOTIFICATION_SOUNDS.map(s => s.key);
export const DEFAULT_NOTIFICATION_SOUND = 'classic';
export const isNotificationSound = (key) => NOTIFICATION_SOUND_KEYS.includes(key);
