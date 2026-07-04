import { contextBridge, ipcRenderer } from 'electron';
import { Habit, Settings } from '../types';

contextBridge.exposeInMainWorld('electronAPI', {
  getHabits: () => ipcRenderer.invoke('db:get-habits'),
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => ipcRenderer.invoke('db:add-habit', habit),
  updateHabit: (habit: Habit) => ipcRenderer.invoke('db:update-habit', habit),
  deleteHabit: (id: string) => ipcRenderer.invoke('db:delete-habit', id),
  
  getProgress: (date: string) => ipcRenderer.invoke('db:get-progress', date),
  logProgress: (habitId: string, status: 'completed' | 'snoozed' | 'skipped', snoozeDuration?: number) => 
    ipcRenderer.invoke('db:log-progress', habitId, status, snoozeDuration),
  
  getSettings: () => ipcRenderer.invoke('db:get-settings'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('db:save-settings', settings),
  getStats: () => ipcRenderer.invoke('db:get-stats'),

  startWalkTimer: (habitId: string, durationMinutes: number) => ipcRenderer.invoke('timer:start-walk', habitId, durationMinutes),
  cancelWalkTimer: () => ipcRenderer.invoke('timer:cancel-walk'),
  
  closePopup: () => ipcRenderer.invoke('win:close-popup'),
  minimizePopup: () => ipcRenderer.invoke('win:minimize-popup'),
  openDashboard: () => ipcRenderer.invoke('win:open-dashboard'),

  // Listeners
  onShowReminder: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('scheduler:trigger-reminder', subscription);
    return () => {
      ipcRenderer.removeListener('scheduler:trigger-reminder', subscription);
    };
  },
  
  onTimerUpdate: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('timer:tick', subscription);
    return () => {
      ipcRenderer.removeListener('timer:tick', subscription);
    };
  }
});
