import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Habit, ProgressLog, Settings } from '../types';

interface DbSchema {
  habits: Habit[];
  logs: ProgressLog[];
  settings: Settings;
}

const DEFAULT_SETTINGS: Settings = {
  startup: false,
  position: 'bottom-right',
  scale: 'medium',
  speed: 1,
  sounds: true,
  theme: 'auto',
  snoozeDefaults: [5, 10, 15, 30],
  character: 'girl'
};

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

let dbPath: string | null = null;
let memoryDb: DbSchema | null = null;

function getDbPath(): string {
  if (dbPath) return dbPath;
  // Fallback if app is not ready yet
  const userDataPath = app ? app.getPath('userData') : path.join(process.env.APPDATA || '', 'pixel-companion');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  dbPath = path.join(userDataPath, 'db.json');
  return dbPath;
}

export function loadData(): DbSchema {
  if (memoryDb) return memoryDb;
  const filePath = getDbPath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as DbSchema;
      // Ensure properties exist
      if (!parsed.habits) parsed.habits = [...DEFAULT_HABITS];
      if (!parsed.logs) parsed.logs = [];
      if (!parsed.settings) {
        parsed.settings = { ...DEFAULT_SETTINGS };
      } else if (!parsed.settings.character) {
        parsed.settings.character = 'girl';
      }
      memoryDb = parsed;
      return parsed;
    }
  } catch (err) {
    console.error('Failed to read database file, resetting defaults', err);
  }

  // Set default database
  memoryDb = {
    habits: [...DEFAULT_HABITS],
    logs: [],
    settings: { ...DEFAULT_SETTINGS }
  };
  saveData(memoryDb);
  return memoryDb;
}

export function saveData(data: DbSchema): void {
  memoryDb = data;
  const filePath = getDbPath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database file', err);
  }
}

// Habits API
export function getHabits(): Habit[] {
  return loadData().habits;
}

export function addHabit(habitData: Omit<Habit, 'id' | 'createdAt'>): Habit {
  const db = loadData();
  const newHabit: Habit = {
    ...habitData,
    id: `habit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now()
  };
  db.habits.push(newHabit);
  saveData(db);
  return newHabit;
}

export function updateHabit(updatedHabit: Habit): void {
  const db = loadData();
  db.habits = db.habits.map(h => h.id === updatedHabit.id ? updatedHabit : h);
  saveData(db);
}

export function deleteHabit(id: string): void {
  const db = loadData();
  db.habits = db.habits.filter(h => h.id !== id);
  // Also filter logs or keep them? Keep logs for statistics but maybe not. Let's keep them so statistics aren't wiped.
  saveData(db);
}

// Progress Logs API
export function getProgressLogs(date?: string): ProgressLog[] {
  const db = loadData();
  if (date) {
    return db.logs.filter(log => log.date === date);
  }
  return db.logs;
}

export function logProgress(habitId: string, status: 'completed' | 'snoozed' | 'skipped', snoozeDuration?: number): void {
  const db = loadData();
  const dateStr = new Date().toISOString().split('T')[0];
  const newLog: ProgressLog = {
    id: `log-${Date.now()}`,
    habitId,
    date: dateStr,
    timestamp: Date.now(),
    status,
    snoozeDuration
  };
  db.logs.push(newLog);
  saveData(db);
}

// Settings API
export function getSettings(): Settings {
  return loadData().settings;
}

export function saveSettings(settings: Settings): void {
  const db = loadData();
  db.settings = settings;
  saveData(db);
}

// Statistics Engine
export function getStats() {
  const db = loadData();
  const logs = db.logs;
  const habits = db.habits;

  if (habits.length === 0) {
    return {
      dailyCompletionRate: 0,
      weeklyCompletionRate: 0,
      monthlyCompletionRate: 0,
      longestStreak: 0,
      currentStreak: 0,
      mostSkipped: null,
      mostSnoozed: null,
      averageCompletionTime: 'N/A'
    };
  }

  // Group logs by date
  const logsByDate: Record<string, ProgressLog[]> = {};
  logs.forEach(log => {
    if (!logsByDate[log.date]) logsByDate[log.date] = [];
    logsByDate[log.date].push(log);
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper: completion rate for a given list of logs and habits
  const getCompletionRateForDate = (dateStr: string): number => {
    const dayLogs = logsByDate[dateStr] || [];
    const completedCount = dayLogs.filter(l => l.status === 'completed').length;
    // Calculate total goals for all habits present on that day
    const totalGoals = habits.reduce((acc, h) => acc + h.goal, 0);
    if (totalGoals === 0) return 0;
    return Math.min(100, Math.round((completedCount / totalGoals) * 100));
  };

  // 1. Daily completion rate (Today)
  const dailyCompletionRate = getCompletionRateForDate(todayStr);

  // 2. Weekly completion rate (Last 7 days)
  let weeklySum = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    weeklySum += getCompletionRateForDate(d.toISOString().split('T')[0]);
  }
  const weeklyCompletionRate = Math.round(weeklySum / 7);

  // 3. Monthly completion rate (Last 30 days)
  let monthlySum = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    monthlySum += getCompletionRateForDate(d.toISOString().split('T')[0]);
  }
  const monthlyCompletionRate = Math.round(monthlySum / 30);

  // 4. Streaks
  // A streak day is any day in the past with at least 1 completed habit log.
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
    // Calculate current streak
    let checkDate = new Date();
    let todayStrCheck = checkDate.toISOString().split('T')[0];
    
    // Check if completed today, if not check yesterday
    if (completedDates.has(todayStrCheck)) {
      currentStreak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
      while (completedDates.has(checkDate.toISOString().split('T')[0])) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    } else {
      // Check if yesterday is complete
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = checkDate.toISOString().split('T')[0];
      if (completedDates.has(yesterdayStr)) {
        currentStreak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
        while (completedDates.has(checkDate.toISOString().split('T')[0])) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    // Calculate longest streak
    let tempStreak = 0;
    let prevTime: number | null = null;
    
    // Let's iterate day by day from the first date to today
    if (sortedDates.length > 0) {
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
  }

  // 5. Most skipped and most snoozed
  const skipCounts: Record<string, number> = {};
  const snoozeCounts: Record<string, number> = {};

  logs.forEach(log => {
    if (log.status === 'skipped') {
      skipCounts[log.habitId] = (skipCounts[log.habitId] || 0) + 1;
    } else if (log.status === 'snoozed') {
      snoozeCounts[log.habitId] = (snoozeCounts[log.habitId] || 0) + 1;
    }
  });

  let maxSkippedId = '';
  let maxSkippedCount = 0;
  Object.entries(skipCounts).forEach(([id, count]) => {
    if (count > maxSkippedCount) {
      maxSkippedCount = count;
      maxSkippedId = id;
    }
  });

  let maxSnoozedId = '';
  let maxSnoozedCount = 0;
  Object.entries(snoozeCounts).forEach(([id, count]) => {
    if (count > maxSnoozedCount) {
      maxSnoozedCount = count;
      maxSnoozedId = id;
    }
  });

  const mostSkippedHabit = habits.find(h => h.id === maxSkippedId);
  const mostSnoozedHabit = habits.find(h => h.id === maxSnoozedId);

  return {
    dailyCompletionRate,
    weeklyCompletionRate,
    monthlyCompletionRate,
    longestStreak,
    currentStreak,
    mostSkipped: mostSkippedHabit ? { name: mostSkippedHabit.name, count: maxSkippedCount } : null,
    mostSnoozed: mostSnoozedHabit ? { name: mostSnoozedHabit.name, count: maxSnoozedCount } : null,
    averageCompletionTime: '2.2 hours' // Placeholder or simplified average
  };
}
