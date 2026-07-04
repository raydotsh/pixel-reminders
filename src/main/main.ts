import { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } from 'electron';
import path from 'path';
import * as storage from './storage';
import * as scheduler from './scheduler';
import { Habit, Settings } from '../types';

let dashboardWindow: BrowserWindow | null = null;
let popupWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let schedulerInterval: NodeJS.Timeout | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const VITE_DEV_SERVER_URL = 'http://localhost:5173';

// Base64 red pixel-art heart icon for the system tray (16x16)
const TRAY_ICON_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAp0lEQVQ4T2NkoDJgpJD5z0AEYGSA0s1Qcchg5IDRDRjRABcDhg/wMjCwMTAwMPynwGB8gImB4T8Dkg2EGcAPGBkY/mITxKcAZgCxBmAziFAYwDWAZANwxjF+A8g1AGcAuwFkA3DG8X4DiDWA3QCyATjjeL8BxBrAbgDZAJxx/MYB1gB2A4g1AGccd3CApwEw/0NisQZgMwhnHMOP/yAxdECcAUwMAACh12b18h5GqgAAAABJRU5ErkJggg==';

function getWindowPosition(width: number, height: number, positionSetting: string) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  let posX = x + screenWidth - width - 20;
  let posY = y + screenHeight - height - 20;

  if (positionSetting === 'bottom-left') {
    posX = x + 20;
    posY = y + screenHeight - height - 20;
  } else if (positionSetting === 'top-right') {
    posX = x + screenWidth - width - 20;
    posY = y + 20;
  } else if (positionSetting === 'top-left') {
    posX = x + 20;
    posY = y + 20;
  }

  return { x: posX, y: posY };
}

function createDashboardWindow() {
  if (dashboardWindow) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    title: 'Pixel Companion - Dashboard',
    icon: nativeImage.createFromDataURL(TRAY_ICON_BASE64),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load URL
  if (isDev) {
    dashboardWindow.loadURL(`${VITE_DEV_SERVER_URL}/#/dashboard`);
    dashboardWindow.webContents.openDevTools();
  } else {
    dashboardWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/dashboard' });
  }

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow?.focus();
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

function createPopupWindow() {
  if (popupWindow) {
    return popupWindow;
  }

  const settings = storage.getSettings();
  const width = 420;
  const height = 260;
  const { x, y } = getWindowPosition(width, height, settings.position);

  popupWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  popupWindow.setAlwaysOnTop(true, 'screen-saver');

  popupWindow.on('closed', () => {
    popupWindow = null;
  });

  return popupWindow;
}

function showReminderPopup(habit: Habit) {
  const win = createPopupWindow();
  
  // Calculate logs/progress for today
  const todayStr = new Date().toISOString().split('T')[0];
  const logs = storage.getProgressLogs(todayStr);
  const completedToday = logs.filter(l => l.habitId === habit.id && l.status === 'completed').length;

  const url = isDev 
    ? `${VITE_DEV_SERVER_URL}/#/popup?habitId=${habit.id}&progress=${completedToday}&goal=${habit.goal}`
    : `file://${path.join(__dirname, '../dist/index.html')}#/popup?habitId=${habit.id}&progress=${completedToday}&goal=${habit.goal}`;

  // Make sure to load URL
  if (isDev) {
    win.loadURL(`${VITE_DEV_SERVER_URL}/#/popup?habitId=${habit.id}&progress=${completedToday}&goal=${habit.goal}`);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { 
      hash: `/popup?habitId=${habit.id}&progress=${completedToday}&goal=${habit.goal}` 
    });
  }

  // Adjust size back to default popup size in case it was minimized by a walk timer
  const settings = storage.getSettings();
  const width = 420;
  const height = 260;
  const { x, y } = getWindowPosition(width, height, settings.position);
  win.setSize(width, height);
  win.setPosition(x, y);

  win.once('ready-to-show', () => {
    win.show();
    // Send event to confirm
    win.webContents.send('scheduler:trigger-reminder', {
      habitId: habit.id,
      progress: completedToday,
      goal: habit.goal,
      title: habit.emoji + ' ' + habit.name,
      message: habit.message || `Time for ${habit.name}!`
    });
  });
}

function createTray() {
  if (tray) return;

  const trayIcon = nativeImage.createFromDataURL(TRAY_ICON_BASE64);
  tray = new Tray(trayIcon);
  tray.setToolTip('Pixel Companion');

  const contextMenu = Menu.buildFromTemplate([
    { label: '📊 Today\'s Progress', click: () => createDashboardWindow() },
    { label: '🧪 Test Reminder', click: () => {
      const habits = storage.getHabits();
      if (habits.length > 0) {
        showReminderPopup(habits[0]);
      }
    }},
    { type: 'separator' },
    {
      label: '⏳ Pause Reminders',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        if (menuItem.checked) {
          stopScheduler();
        } else {
          startScheduler();
        }
      }
    },
    { label: '⚙️ Settings', click: () => createDashboardWindow() },
    { type: 'separator' },
    { label: '❌ Exit', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    createDashboardWindow();
  });
}

function startScheduler() {
  if (schedulerInterval) return;

  // Run scheduler check every 10 seconds
  schedulerInterval = setInterval(() => {
    scheduler.checkReminders(
      (habit) => {
        showReminderPopup(habit);
      },
      (timer, isFinished) => {
        if (popupWindow && !popupWindow.isDestroyed()) {
          popupWindow.webContents.send('timer:tick', {
            habitId: timer.habitId,
            timeLeft: Math.round(timer.timeLeftMs / 1000),
            totalDuration: Math.round(timer.durationMs / 1000),
            isFinished
          });
        }
        
        if (isFinished) {
          // Play complete sound or trigger notification
          if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('db:updated');
          }
        }
      }
    );
  }, 10000);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

// IPC Registration
function registerIpcHandlers() {
  // DB Habits
  ipcMain.handle('db:get-habits', () => storage.getHabits());
  ipcMain.handle('db:add-habit', (_, habit) => storage.addHabit(habit));
  ipcMain.handle('db:update-habit', (_, habit) => {
    storage.updateHabit(habit);
    if (dashboardWindow) dashboardWindow.webContents.send('db:updated');
  });
  ipcMain.handle('db:delete-habit', (_, id) => {
    storage.deleteHabit(id);
    scheduler.clearSnoozesForHabit(id);
    if (dashboardWindow) dashboardWindow.webContents.send('db:updated');
  });

  // DB Logs & Progress
  ipcMain.handle('db:get-progress', (_, date) => storage.getProgressLogs(date));
  ipcMain.handle('db:log-progress', (_, habitId, status, snoozeDuration) => {
    if (status === 'snoozed' && snoozeDuration) {
      scheduler.addSnooze(habitId, snoozeDuration);
    } else {
      scheduler.clearSnoozesForHabit(habitId);
    }
    storage.logProgress(habitId, status, snoozeDuration);
    
    // Notify dashboard
    if (dashboardWindow) dashboardWindow.webContents.send('db:updated');
  });

  // Settings
  ipcMain.handle('db:get-settings', () => storage.getSettings());
  ipcMain.handle('db:save-settings', (_, settings: Settings) => {
    storage.saveSettings(settings);
    // Apply startup settings
    app.setLoginItemSettings({
      openAtLogin: settings.startup,
      path: app.getPath('exe')
    });
    
    // Apply window position if popup exists
    if (popupWindow && !popupWindow.isDestroyed()) {
      const size = popupWindow.getSize();
      const { x, y } = getWindowPosition(size[0], size[1], settings.position);
      popupWindow.setPosition(x, y);
    }
  });

  // Stats
  ipcMain.handle('db:get-stats', () => storage.getStats());

  // Window manipulation
  ipcMain.handle('win:close-popup', () => {
    if (popupWindow) {
      popupWindow.close();
      popupWindow = null;
    }
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.focus();
    }
  });

  ipcMain.handle('win:minimize-popup', () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      const settings = storage.getSettings();
      // Resize to a small widget for the timer
      const width = 160;
      const height = 90;
      const { x, y } = getWindowPosition(width, height, settings.position);
      popupWindow.setSize(width, height);
      popupWindow.setPosition(x, y);
    }
  });

  ipcMain.handle('win:open-dashboard', () => {
    createDashboardWindow();
  });

  // Walk Timer handlers
  ipcMain.handle('timer:start-walk', (_, habitId, durationMinutes) => {
    scheduler.startWalkTimer(habitId, durationMinutes, (timer, isFinished) => {
      if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.webContents.send('timer:tick', {
          habitId: timer.habitId,
          timeLeft: Math.round(timer.timeLeftMs / 1000),
          totalDuration: Math.round(timer.durationMs / 1000),
          isFinished
        });
      }
      
      if (isFinished && dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('db:updated');
      }
    });
  });

  ipcMain.handle('timer:cancel-walk', () => {
    scheduler.cancelWalkTimer();
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Ensure DB path initialized
  storage.loadData();
  
  createTray();
  registerIpcHandlers();
  startScheduler();

  // Create dashboard window on startup by default (or keep in tray)
  // Let's open it on launch so the user knows the app is running!
  createDashboardWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDashboardWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Overridden: keep app running in tray when windows are closed
  // On macOS it is common for apps to stay open, on Windows we want tray-only behavior
});

app.on('before-quit', () => {
  stopScheduler();
  scheduler.cancelWalkTimer();
});
