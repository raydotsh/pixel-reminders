import { Habit } from '../types';
import * as storage from './storage';

export interface SnoozeItem {
  habitId: string;
  triggerTimestamp: number;
}

export interface WalkTimer {
  habitId: string;
  startTimestamp: number;
  durationMs: number;
  timeLeftMs: number;
}

let lastCheckTimestamp = Date.now();
let activeSnoozes: SnoozeItem[] = [];
let activeWalkTimer: WalkTimer | null = null;
let walkTimerInterval: NodeJS.Timeout | null = null;

// Helpers
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function getScheduledMinutesForHabit(habit: Habit): number[] {
  if (habit.customTimes && habit.customTimes.length > 0) {
    return habit.customTimes.map(parseTimeToMinutes).sort((a, b) => a - b);
  }

  const startMin = parseTimeToMinutes(habit.startTime);
  const endMin = parseTimeToMinutes(habit.endTime);
  let diff = endMin - startMin;
  
  if (diff <= 0) {
    diff += 24 * 60; // Handle overnight windows
  }
  
  const goal = habit.goal;
  if (goal <= 0) return [];
  
  const interval = diff / goal;
  const minutes: number[] = [];
  
  for (let i = 1; i <= goal; i++) {
    const time = (startMin + i * interval) % (24 * 60);
    minutes.push(Math.round(time));
  }
  
  return minutes.sort((a, b) => a - b);
}

export function getScheduledTimesForHabit(habit: Habit): string[] {
  return getScheduledMinutesForHabit(habit).map(formatMinutesToTime);
}

// Calculate the next upcoming reminder time for a habit (for display)
export function getNextReminderTime(habit: Habit, now: Date = new Date()): string {
  const scheduledMinutes = getScheduledMinutesForHabit(habit);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Find the first scheduled time after current time today
  const nextMin = scheduledMinutes.find(m => m > currentMinutes);
  if (nextMin !== undefined) {
    return formatMinutesToTime(nextMin);
  }
  
  // If none remaining today, return first scheduled time tomorrow
  if (scheduledMinutes.length > 0) {
    return formatMinutesToTime(scheduledMinutes[0]);
  }
  
  return 'N/A';
}

// Core Scheduling Checker
// Returns a list of habit IDs that have triggered
export function checkReminders(
  onTriggerReminder: (habit: Habit) => void,
  onWalkTimerTick: (timer: WalkTimer, isFinished: boolean) => void
): void {
  const now = Date.now();
  const nowDate = new Date(now);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  
  const lastDate = new Date(lastCheckTimestamp);
  const lastMinutes = lastDate.getHours() * 60 + lastDate.getMinutes();
  const isSameDay = lastDate.toDateString() === nowDate.toDateString();

  const habits = storage.getHabits();

  // 1. Check Scheduled Habits
  habits.forEach(habit => {
    const scheduledMinutes = getScheduledMinutesForHabit(habit);
    
    scheduledMinutes.forEach(schedMin => {
      let triggered = false;
      
      if (isSameDay) {
        // Crossed this scheduled minute in this run
        if (lastMinutes < schedMin && nowMinutes >= schedMin) {
          triggered = true;
        }
      } else {
        // Crossed midnight, check if schedMin was after lastCheck on previous day or before now on current day
        if (schedMin > lastMinutes || schedMin <= nowMinutes) {
          triggered = true;
        }
      }
      
      if (triggered) {
        // Verify we haven't already completed today's count? No, trigger it at this exact slot
        onTriggerReminder(habit);
      }
    });
  });

  // 2. Check Snoozes
  const remainingSnoozes: SnoozeItem[] = [];
  activeSnoozes.forEach(snooze => {
    if (now >= snooze.triggerTimestamp) {
      const habit = habits.find(h => h.id === snooze.habitId);
      if (habit) {
        onTriggerReminder(habit);
      }
    } else {
      remainingSnoozes.push(snooze);
    }
  });
  activeSnoozes = remainingSnoozes;

  lastCheckTimestamp = now;
}

// Snooze Management
export function addSnooze(habitId: string, durationMinutes: number): void {
  const triggerTimestamp = Date.now() + durationMinutes * 60 * 1000;
  // Remove existing snoozes for this habit to prevent double triggers
  activeSnoozes = activeSnoozes.filter(s => s.habitId !== habitId);
  activeSnoozes.push({ habitId, triggerTimestamp });
}

export function clearSnoozesForHabit(habitId: string): void {
  activeSnoozes = activeSnoozes.filter(s => s.habitId !== habitId);
}

// Walk Timer Management
export function startWalkTimer(
  habitId: string,
  durationMinutes: number,
  onTick: (timer: WalkTimer, isFinished: boolean) => void
): void {
  if (walkTimerInterval) {
    clearInterval(walkTimerInterval);
  }

  const durationMs = durationMinutes * 60 * 1000;
  const startTimestamp = Date.now();

  activeWalkTimer = {
    habitId,
    startTimestamp,
    durationMs,
    timeLeftMs: durationMs
  };

  walkTimerInterval = setInterval(() => {
    if (!activeWalkTimer) return;

    const elapsed = Date.now() - activeWalkTimer.startTimestamp;
    const timeLeft = Math.max(0, activeWalkTimer.durationMs - elapsed);
    activeWalkTimer.timeLeftMs = timeLeft;

    const isFinished = timeLeft <= 0;
    
    if (isFinished) {
      if (walkTimerInterval) {
        clearInterval(walkTimerInterval);
        walkTimerInterval = null;
      }
      activeWalkTimer = null;
      
      // Log progress automatically
      storage.logProgress(habitId, 'completed');
    }

    onTick(
      {
        habitId,
        startTimestamp,
        durationMs,
        timeLeftMs: timeLeft
      },
      isFinished
    );
  }, 1000);
}

export function cancelWalkTimer(): void {
  if (walkTimerInterval) {
    clearInterval(walkTimerInterval);
    walkTimerInterval = null;
  }
  activeWalkTimer = null;
}

export function getActiveWalkTimer(): WalkTimer | null {
  return activeWalkTimer;
}
