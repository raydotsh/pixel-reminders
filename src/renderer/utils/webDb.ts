import { Habit, ProgressLog, Settings } from '../../types';

// Default JRPG templates
const DEFAULT_HABITS: Habit[] = [
  {
    id: 'water-default',
    name: 'Drink Water',
    emoji: '💧',
    goal: 8,
    startTime: '09:00',
    endTime: '21:00',
    color: '#3b82f6',
    message: 'Hydration time! Let\'s drink a glass of water.',
    createdAt: Date.now()
  },
  {
    id: 'stand-default',
    name: 'Stand Up',
    emoji: '🪑',
    goal: 5,
    startTime: '09:00',
    endTime: '19:00',
    color: '#eab308',
    message: 'You\'ve been sitting for a while. Let\'s stretch those legs!',
    createdAt: Date.now()
  },
  {
    id: 'walk-default',
    name: 'Walk',
    emoji: '🚶',
    goal: 3,
    startTime: '09:00',
    endTime: '21:00',
    duration: 15,
    color: '#22c55e',
    message: 'Fresh air time! Let\'s go for a walk.',
    createdAt: Date.now()
  }
];

const DEFAULT_SETTINGS: Settings = {
  startup: false,
  position: 'bottom-right',
  scale: 'medium',
  speed: 1,
  sounds: true,
  theme: 'light',
  snoozeDefaults: [5, 10, 15, 30],
  character: 'girl'
};

// LocalStorage helpers
function getStorageItem<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Memory listeners
const reminderCallbacks: Array<(data: any) => void> = [];
const timerCallbacks: Array<(data: any) => void> = [];

export const webDbAPI = {
  getHabits: async (): Promise<Habit[]> => {
    return getStorageItem<Habit[]>('pixel_habits', DEFAULT_HABITS);
  },
  addHabit: async (habitData: Omit<Habit, 'id' | 'createdAt'>): Promise<Habit> => {
    const habits = getStorageItem<Habit[]>('pixel_habits', DEFAULT_HABITS);
    const newHabit: Habit = {
      ...habitData,
      id: `habit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };
    habits.push(newHabit);
    setStorageItem('pixel_habits', habits);
    return newHabit;
  },
  updateHabit: async (updated: Habit): Promise<void> => {
    const habits = getStorageItem<Habit[]>('pixel_habits', DEFAULT_HABITS);
    const updatedList = habits.map(h => h.id === updated.id ? updated : h);
    setStorageItem('pixel_habits', updatedList);
  },
  deleteHabit: async (id: string): Promise<void> => {
    const habits = getStorageItem<Habit[]>('pixel_habits', DEFAULT_HABITS);
    setStorageItem('pixel_habits', habits.filter(h => h.id !== id));
  },
  getProgress: async (date: string): Promise<ProgressLog[]> => {
    const logs = getStorageItem<ProgressLog[]>('pixel_logs', []);
    return logs.filter(l => l.date === date);
  },
  logProgress: async (habitId: string, status: 'completed' | 'snoozed' | 'skipped', snoozeDuration?: number): Promise<void> => {
    const logs = getStorageItem<ProgressLog[]>('pixel_logs', []);
    const dateStr = new Date().toISOString().split('T')[0];
    const newLog: ProgressLog = {
      id: `log-${Date.now()}`,
      habitId,
      date: dateStr,
      timestamp: Date.now(),
      status,
      snoozeDuration
    };
    logs.push(newLog);
    setStorageItem('pixel_logs', logs);
  },
  getSettings: async (): Promise<Settings> => {
    return getStorageItem<Settings>('pixel_settings', DEFAULT_SETTINGS);
  },
  saveSettings: async (settings: Settings): Promise<void> => {
    setStorageItem('pixel_settings', settings);
  },
  getStats: async (): Promise<any> => {
    const habits = getStorageItem<Habit[]>('pixel_habits', DEFAULT_HABITS);
    const logs = getStorageItem<ProgressLog[]>('pixel_logs', []);
    
    if (habits.length === 0) {
      return {
        dailyCompletionRate: 0,
        weeklyCompletionRate: 0,
        monthlyCompletionRate: 0,
        longestStreak: 0,
        currentStreak: 0,
        mostSkipped: null,
        mostSnoozed: null
      };
    }

    const logsByDate: Record<string, ProgressLog[]> = {};
    logs.forEach(log => {
      if (!logsByDate[log.date]) logsByDate[log.date] = [];
      logsByDate[log.date].push(log);
    });

    const todayStr = new Date().toISOString().split('T')[0];

    const getCompletionRateForDate = (dateStr: string): number => {
      const dayLogs = logsByDate[dateStr] || [];
      const completedCount = dayLogs.filter(l => l.status === 'completed').length;
      const totalGoals = habits.reduce((acc, h) => acc + h.goal, 0);
      if (totalGoals === 0) return 0;
      return Math.min(100, Math.round((completedCount / totalGoals) * 100));
    };

    const dailyCompletionRate = getCompletionRateForDate(todayStr);

    let weeklySum = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weeklySum += getCompletionRateForDate(d.toISOString().split('T')[0]);
    }
    const weeklyCompletionRate = Math.round(weeklySum / 7);

    let monthlySum = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      monthlySum += getCompletionRateForDate(d.toISOString().split('T')[0]);
    }
    const monthlyCompletionRate = Math.round(monthlySum / 30);

    // Streaks
    const completedDates = new Set<string>();
    logs.forEach(log => {
      if (log.status === 'completed') {
        completedDates.add(log.date);
      }
    });

    const sortedDates = Array.from(completedDates).sort();
    let currentStreak = 0;
    let longestStreak = 0;

    if (sortedDates.length > 0) {
      let checkDate = new Date();
      let todayStrCheck = checkDate.toISOString().split('T')[0];
      
      if (completedDates.has(todayStrCheck)) {
        currentStreak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
        while (completedDates.has(checkDate.toISOString().split('T')[0])) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      } else {
        checkDate.setDate(checkDate.getDate() - 1);
        if (completedDates.has(checkDate.toISOString().split('T')[0])) {
          currentStreak = 1;
          checkDate.setDate(checkDate.getDate() - 1);
          while (completedDates.has(checkDate.toISOString().split('T')[0])) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          }
        }
      }

      let tempStreak = 0;
      const firstDate = new Date(sortedDates[0]);
      const lastDate = new Date();
      let iterDate = new Date(firstDate);
      
      while (iterDate <= lastDate) {
        const iterStr = iterDate.toISOString().split('T')[0];
        if (completedDates.has(iterStr)) {
          tempStreak++;
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
        } else {
          tempStreak = 0;
        }
        iterDate.setDate(iterDate.getDate() + 1);
      }
    }

    return {
      dailyCompletionRate,
      weeklyCompletionRate,
      monthlyCompletionRate,
      longestStreak,
      currentStreak,
      mostSkipped: null,
      mostSnoozed: null
    };
  },
  
  // Walk Timers Web handlers
  startWalkTimer: async (habitId: string, durationMinutes: number): Promise<void> => {
    // In browser, run a local countdown
    let secondsLeft = durationMinutes * 60;
    const startTimestamp = Date.now();
    const interval = setInterval(() => {
      secondsLeft--;
      const isFinished = secondsLeft <= 0;
      
      timerCallbacks.forEach(cb => cb({
        habitId,
        timeLeft: secondsLeft,
        totalDuration: durationMinutes * 60,
        isFinished
      }));
      
      if (isFinished) {
        clearInterval(interval);
        // Log logProgress directly
        webDbAPI.logProgress(habitId, 'completed');
      }
    }, 1000);
  },
  cancelWalkTimer: async (habitId: string): Promise<void> => {
    // Mock
  },

  // Window methods (mocks)
  closePopup: async (): Promise<void> => {
    window.location.hash = '#/dashboard';
  },
  minimizePopup: async (): Promise<void> => {},
  openDashboard: async (): Promise<void> => {},

  // Listeners
  onShowReminder: (callback: (data: any) => void) => {
    reminderCallbacks.push(callback);
    return () => {
      const idx = reminderCallbacks.indexOf(callback);
      if (idx !== -1) reminderCallbacks.splice(idx, 1);
    };
  },
  onTimerUpdate: (callback: (data: any) => void) => {
    timerCallbacks.push(callback);
    return () => {
      const idx = timerCallbacks.indexOf(callback);
      if (idx !== -1) timerCallbacks.splice(idx, 1);
    };
  },
  onDbUpdated: (callback: () => void) => {
    return () => {};
  },

  // Internal trigger (Web fallback scheduling)
  triggerWebReminder: (habit: Habit, completedToday: number) => {
    reminderCallbacks.forEach(cb => cb({
      habitId: habit.id,
      progress: completedToday,
      goal: habit.goal,
      title: habit.emoji + ' ' + habit.name,
      message: habit.message || `Time to ${habit.name.toLowerCase()}!`
    }));
  }
};
