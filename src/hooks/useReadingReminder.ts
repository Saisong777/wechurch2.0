import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ReminderSettings {
  enabled: boolean;
  morning: string;
  noon: string;
  evening: string;
}

const REMINDER_CHECK_INTERVAL = 60 * 1000;
const LAST_REMINDER_KEY = 'wechurch_last_reading_reminder';

function getTimeMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getLastReminderInfo(): { date: string; times: string[] } {
  try {
    const stored = localStorage.getItem(LAST_REMINDER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === getTodayKey()) {
        return parsed;
      }
    }
  } catch {}
  return { date: getTodayKey(), times: [] };
}

function markReminderSent(timeSlot: string) {
  const info = getLastReminderInfo();
  if (!info.times.includes(timeSlot)) {
    info.times.push(timeSlot);
  }
  info.date = getTodayKey();
  localStorage.setItem(LAST_REMINDER_KEY, JSON.stringify(info));
}

function sendNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'reading-reminder',
        requireInteraction: false,
      });
    } catch {}
  }
}

export function useReadingReminder() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }, []);

  const checkAndNotify = useCallback(async (settings: ReminderSettings) => {
    if (!settings.enabled || !user) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const res = await fetch('/api/user-reading-progress/today', { credentials: 'include' });
      if (!res.ok) return;
      const todayProgress = await res.json();

      const allCompleted = todayProgress.length > 0 && todayProgress.every((p: any) => p.isCompleted);
      if (allCompleted) return;

      const currentMinutes = getCurrentTimeMinutes();
      const reminderInfo = getLastReminderInfo();

      const timeSlots = [
        { key: 'morning', time: settings.morning, label: '早安' },
        { key: 'noon', time: settings.noon, label: '午安' },
        { key: 'evening', time: settings.evening, label: '晚安' },
      ];

      for (const slot of timeSlots) {
        const slotMinutes = getTimeMinutes(slot.time);
        if (
          currentMinutes >= slotMinutes &&
          currentMinutes < slotMinutes + 5 &&
          !reminderInfo.times.includes(slot.key)
        ) {
          const unread = todayProgress.filter((p: any) => !p.isCompleted).length;
          sendNotification(
            `${slot.label}！該讀經了`,
            unread > 0
              ? `你今天還有 ${unread} 個讀經進度未完成`
              : '今天的讀經計劃等著你'
          );
          markReminderSent(slot.key);
          break;
        }
      }
    } catch {}
  }, [user]);

  const startReminder = useCallback((settings: ReminderSettings) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!settings.enabled) return;

    checkAndNotify(settings);

    intervalRef.current = setInterval(() => {
      checkAndNotify(settings);
    }, REMINDER_CHECK_INTERVAL);
  }, [checkAndNotify]);

  const stopReminder = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    requestPermission,
    startReminder,
    stopReminder,
    isSupported: typeof window !== 'undefined' && 'Notification' in window,
    permission: typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied' as NotificationPermission,
  };
}
