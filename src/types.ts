export interface Habit {
  id: string;
  name: string;
  emoji: string;
  goal: number; // times per day
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  duration?: number; // Optional walk duration in minutes
  message?: string; // Custom supportive message
  sound?: string; // Optional sound identifier
  color?: string; // Cozy background color theme
  customTimes?: string[]; // Optional manual reminder times ["HH:MM", ...]
  createdAt: number;
}

export interface ProgressLog {
  id: string;
  habitId: string;
  date: string; // "YYYY-MM-DD"
  timestamp: number;
  status: 'completed' | 'snoozed' | 'skipped';
  snoozeDuration?: number; // in minutes, if status is 'snoozed'
}

export interface Settings {
  startup: boolean;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  scale: 'small' | 'medium' | 'large';
  speed: number; // animation speed multiplier
  sounds: boolean;
  theme: 'creme' | 'green' | 'pink' | 'white' | 'dark' | 'light' | 'auto';
  snoozeDefaults: number[]; // defaults like [5, 10, 15, 30]
  character: 'girl' | 'boy' | 'cat';
}

export interface Statistics {
  dailyCompletionRate: number; // overall % of completed reminders today
  weeklyCompletionRate: number; // overall % this week
  monthlyCompletionRate: number; // overall % this month
  longestStreak: number;
  currentStreak: number;
  mostSkipped: { name: string; count: number } | null;
  mostSnoozed: { name: string; count: number } | null;
  averageCompletionTime: string; // e.g. "2.5 hours after schedule"
}

export interface ElectronAPI {
  getHabits: () => Promise<Habit[]>;
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => Promise<Habit>;
  updateHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  getProgress: (date: string) => Promise<ProgressLog[]>;
  logProgress: (habitId: string, status: 'completed' | 'snoozed' | 'skipped', snoozeDuration?: number) => Promise<void>;
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  getStats: () => Promise<any>;
  startWalkTimer: (habitId: string, durationMinutes: number) => Promise<void>;
  cancelWalkTimer: (habitId: string) => Promise<void>;
  closePopup: () => Promise<void>;
  minimizePopup: () => Promise<void>;
  openDashboard: () => Promise<void>;
  
  // Event listeners (IPC Renderer)
  onShowReminder: (callback: (data: { habitId: string; progress: number; goal: number; title: string; message: string }) => void) => () => void;
  onTimerUpdate: (callback: (data: { habitId: string; timeLeft: number; totalDuration: number; isFinished: boolean }) => void) => () => void;
  onDbUpdated?: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
