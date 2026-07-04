import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Popup from './components/Popup';
import { Settings } from '../types';

export default function App() {
  const [route, setRoute] = useState(window.location.hash || '#/dashboard');
  const [settings, setSettings] = useState<Settings | null>(null);

  // Simple Hash Routing and background transparency overrides
  useEffect(() => {
    const handleHashChange = () => {
      const currentHash = window.location.hash;
      setRoute(currentHash);
      
      const currentPath = currentHash.split('?')[0];
      if (currentPath.startsWith('#/popup')) {
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
      } else {
        document.body.style.backgroundColor = '';
        document.documentElement.style.backgroundColor = '';
      }
    };
    
    // Check initial route
    const initialPath = (window.location.hash || '#/dashboard').split('?')[0];
    if (initialPath.startsWith('#/popup')) {
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
    }
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch Settings & Apply Theme
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const s = await window.electronAPI.getSettings();
        setSettings(s);
        applyTheme(s.theme);
      } catch (err) {
        console.error('Failed to get settings in frontend', err);
      }
    };
    fetchSettings();
  }, [route]);

  // Web-only scheduler loop (runs only when triggerWebReminder is present, i.e., Browser Mode)
  useEffect(() => {
    const isBrowser = (window.electronAPI as any).triggerWebReminder !== undefined;
    if (!isBrowser) return;

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    let lastCheckTimestamp = Date.now();

    const parseTimeToMinutes = (timeStr: string): number => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const getScheduledMinutesForHabit = (habit: any): number[] => {
      if (habit.customTimes && habit.customTimes.length > 0) {
        return habit.customTimes.map(parseTimeToMinutes).sort((a: number, b: number) => a - b);
      }
      const startMin = parseTimeToMinutes(habit.startTime);
      const endMin = parseTimeToMinutes(habit.endTime);
      let diff = endMin - startMin;
      if (diff <= 0) diff += 24 * 60;
      const goal = habit.goal;
      if (goal <= 0) return [];
      const interval = diff / goal;
      const minutes: number[] = [];
      for (let i = 1; i <= goal; i++) {
        minutes.push(Math.round((startMin + i * interval) % (24 * 60)));
      }
      return minutes.sort((a, b) => a - b);
    };

    const checkInterval = setInterval(async () => {
      const now = Date.now();
      const nowDate = new Date(now);
      const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      
      const lastDate = new Date(lastCheckTimestamp);
      const lastMinutes = lastDate.getHours() * 60 + lastDate.getMinutes();
      const isSameDay = lastDate.toDateString() === nowDate.toDateString();

      try {
        const habits = await window.electronAPI.getHabits();
        const todayStr = nowDate.toISOString().split('T')[0];
        const logs = await window.electronAPI.getProgress(todayStr);

        for (const habit of habits) {
          const scheduledMinutes = getScheduledMinutesForHabit(habit);
          for (const schedMin of scheduledMinutes) {
            let triggered = false;
            if (isSameDay) {
              if (lastMinutes < schedMin && nowMinutes >= schedMin) {
                triggered = true;
              }
            } else {
              if (schedMin > lastMinutes || schedMin <= nowMinutes) {
                triggered = true;
              }
            }

            if (triggered) {
              const completedToday = logs.filter(l => l.habitId === habit.id && l.status === 'completed').length;
              
              // Trigger hash route change to show popup screen
              window.location.hash = `#/popup?habitId=${habit.id}&progress=${completedToday}&goal=${habit.goal}`;

              // Trigger standard browser push notification
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification(`${habit.emoji} ${habit.name}`, {
                  body: habit.message || `Time to complete your goal!`,
                  requireInteraction: true
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('Web scheduler error:', err);
      }

      lastCheckTimestamp = now;
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  const applyTheme = (theme: 'light' | 'dark' | 'auto') => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // Auto
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  // Helper to parse query parameters
  const parseParams = (hashStr: string) => {
    const qMarkIndex = hashStr.indexOf('?');
    if (qMarkIndex === -1) return {};
    const query = hashStr.substring(qMarkIndex + 1);
    const pairs = query.split('&');
    const params: Record<string, string> = {};
    for (const pair of pairs) {
      const [key, val] = pair.split('=');
      params[key] = decodeURIComponent(val || '');
    }
    return params;
  };

  const path = route.split('?')[0];
  const params = parseParams(route);

  if (path.startsWith('#/popup')) {
    return (
      <Popup
        habitId={params.habitId || ''}
        progress={params.progress ? parseInt(params.progress, 10) : 0}
        goal={params.goal ? parseInt(params.goal, 10) : 1}
      />
    );
  }

  // Default to Dashboard
  return <Dashboard />;
}
