import React, { useState, useEffect } from 'react';
import Companion from './Companion';
import { Habit, Settings, ProgressLog } from '../../types';
import { 
  Home, 
  PlusCircle, 
  BarChart2, 
  Settings as SettingsIcon, 
  Plus, 
  Trash, 
  Flame, 
  Volume2, 
  VolumeX, 
  Sparkles,
  TrendingUp,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { playRetroSound, setSoundEnabled } from '../utils/sound';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'goals' | 'add' | 'stats' | 'settings'>('goals');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const [scheduleMode, setScheduleMode] = useState<'auto' | 'manual'>('auto');
  const [customTimes, setCustomTimes] = useState<string[]>([]);

  const generateDefaultTimes = (goalCount: number, start: string, end: string): string[] => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMin = startH * 60 + startM;
    let endMin = endH * 60 + endM;
    let diff = endMin - startMin;
    if (diff <= 0) {
      diff += 24 * 60;
    }
    
    const interval = diff / goalCount;
    const times: string[] = [];
    
    for (let i = 1; i <= goalCount; i++) {
      const totalMins = Math.round(startMin + i * interval) % (24 * 60);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
    return times.sort();
  };

  // Form State for Adding/Editing Habits
  const [habitForm, setHabitForm] = useState({
    name: '',
    emoji: '💧',
    goal: 5,
    startTime: '09:00',
    endTime: '21:00',
    duration: '',
    message: '',
    color: '#3b82f6',
  });

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<Settings | null>(null);

  // Load Database Data
  const loadData = async () => {
    try {
      const allHabits = await window.electronAPI.getHabits();
      setHabits(allHabits);

      const todayStr = new Date().toISOString().split('T')[0];
      const todayProgress = await window.electronAPI.getProgress(todayStr);
      setProgressLogs(todayProgress);

      const loadedSettings = await window.electronAPI.getSettings();
      setSettings(loadedSettings);
      setSettingsForm(loadedSettings);
      setSoundEnabled(loadedSettings.sounds);

      const loadedStats = await window.electronAPI.getStats();
      setStats(loadedStats);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  useEffect(() => {
    loadData();

    if (window.electronAPI.onDbUpdated) {
      const unsubscribe = window.electronAPI.onDbUpdated(() => {
        console.log('[Dashboard] Database updated, reloading...');
        loadData();
      });
      return unsubscribe;
    }
  }, []);

  // Quick manually log progress from dashboard
  const handleQuickLog = async (habitId: string) => {
    playRetroSound('success');
    await window.electronAPI.logProgress(habitId, 'completed');
    loadData();
  };

  const handleQuickDelete = async (habitId: string) => {
    if (confirm('Are you sure you want to delete this habit?')) {
      playRetroSound('click');
      await window.electronAPI.deleteHabit(habitId);
      loadData();
    }
  };

  // Submit Habit Creation/Edit
  const handleHabitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitForm.name) return;

    playRetroSound('click');

    const habitData = {
      name: habitForm.name,
      emoji: habitForm.emoji,
      goal: Number(habitForm.goal),
      startTime: habitForm.startTime,
      endTime: habitForm.endTime,
      duration: habitForm.duration ? Number(habitForm.duration) : undefined,
      message: habitForm.message || undefined,
      color: habitForm.color,
      customTimes: scheduleMode === 'manual' ? customTimes : undefined,
    };

    if (editingHabit) {
      await window.electronAPI.updateHabit({
        ...editingHabit,
        ...habitData,
      });
      setEditingHabit(null);
    } else {
      await window.electronAPI.addHabit(habitData);
    }

    // Reset Form
    setHabitForm({
      name: '',
      emoji: '💧',
      goal: 5,
      startTime: '09:00',
      endTime: '21:00',
      duration: '',
      message: '',
      color: '#3b82f6',
    });
    setScheduleMode('auto');
    setCustomTimes([]);

    setActiveTab('goals');
    loadData();
  };

  // Populate Edit Habit
  const handleEditClick = (habit: Habit) => {
    playRetroSound('click');
    setEditingHabit(habit);
    setHabitForm({
      name: habit.name,
      emoji: habit.emoji,
      goal: habit.goal,
      startTime: habit.startTime,
      endTime: habit.endTime,
      duration: habit.duration ? habit.duration.toString() : '',
      message: habit.message || '',
      color: habit.color || '#3b82f6',
    });
    
    if (habit.customTimes && habit.customTimes.length > 0) {
      setScheduleMode('manual');
      setCustomTimes(habit.customTimes);
    } else {
      setScheduleMode('auto');
      setCustomTimes([]);
    }
    
    setActiveTab('add');
  };

  // Submit Settings
  const handleSettingsSave = async (updatedSettings: Settings) => {
    playRetroSound('click');
    setSettings(updatedSettings);
    await window.electronAPI.saveSettings(updatedSettings);
    loadData();
  };

  const handleThemeChange = async (themeName: 'creme' | 'green' | 'pink' | 'white' | 'dark') => {
    if (!settings) return;
    playRetroSound('click');
    const updatedSettings: Settings = {
      ...settings,
      theme: themeName
    };
    setSettings(updatedSettings);
    if (settingsForm) {
      setSettingsForm(updatedSettings);
    }
    await window.electronAPI.saveSettings(updatedSettings);
    
    // Apply theme immediately on web fallback
    const root = document.documentElement;
    root.classList.remove('theme-creme', 'theme-green', 'theme-pink', 'theme-white', 'theme-dark', 'dark');
    root.classList.add(`theme-${themeName}`);
    if (themeName === 'dark') {
      root.classList.add('dark');
    }
    
    loadData();
  };

  const getCompletedCount = (habitId: string) => {
    return progressLogs.filter(l => l.habitId === habitId && l.status === 'completed').length;
  };

  // Calculate Overall Progress
  const totalCompleted = habits.reduce((acc, h) => acc + getCompletedCount(h.id), 0);
  const totalGoal = habits.reduce((acc, h) => acc + h.goal, 0);
  const overallPercentage = totalGoal > 0 ? Math.round((totalCompleted / totalGoal) * 100) : 0;

  return (
    <div className="app-container">
      {/* Left Navigation Sidebar */}
      <nav className="sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
            <h1 style={{ fontFamily: 'var(--font-retro)', fontSize: '12px', letterSpacing: '0.5px' }}>
              Pixel Roommate
            </h1>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
              Companion Setup
            </span>
          </div>

          <ul className="sidebar-menu">
            <li>
              <button 
                onClick={() => { playRetroSound('click'); setActiveTab('goals'); }}
                className={`pixel-btn ${activeTab === 'goals' ? 'pixel-btn-primary' : ''}`}
              >
                <Home size={12} />
                <span>Goals List</span>
              </button>
            </li>
            <li>
              <button 
                onClick={() => { playRetroSound('click'); setEditingHabit(null); setActiveTab('add'); }}
                className={`pixel-btn ${activeTab === 'add' ? 'pixel-btn-primary' : ''}`}
              >
                <PlusCircle size={12} />
                <span>{editingHabit ? 'Edit Habit' : 'Add Habit'}</span>
              </button>
            </li>
            <li>
              <button 
                onClick={() => { playRetroSound('click'); setActiveTab('stats'); }}
                className={`pixel-btn ${activeTab === 'stats' ? 'pixel-btn-primary' : ''}`}
              >
                <BarChart2 size={12} />
                <span>Statistics</span>
              </button>
            </li>
            <li>
              <button 
                onClick={() => { playRetroSound('click'); setActiveTab('settings'); }}
                className={`pixel-btn ${activeTab === 'settings' ? 'pixel-btn-primary' : ''}`}
              >
                <SettingsIcon size={12} />
                <span>Settings</span>
              </button>
            </li>
          </ul>
        </div>

      </nav>

      {/* Main Content Body */}
      <main className="main-content">
        {/* Dashboard Top Header */}
        <header className="dashboard-header">
          <div className="header-title-section">
            <div>
              <h2 style={{ fontFamily: 'var(--font-retro)', fontSize: '16px' }}>
                {activeTab === 'goals' && 'Today\'s Habits'}
                {activeTab === 'add' && (editingHabit ? 'Edit Habit' : 'Add Habit')}
                {activeTab === 'stats' && 'Analytics'}
                {activeTab === 'settings' && 'Configuration'}
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>
                {activeTab === 'goals' && 'Track your roommate goals and daily routines'}
                {activeTab === 'add' && 'Configure custom schedules, times, and colors'}
                {activeTab === 'stats' && 'Visual historical streaks and completion metrics'}
                {activeTab === 'settings' && 'Tune visual scaling, positions, themes, and sound settings'}
              </p>

              {/* Theme Circles Bar */}
              <div className="theme-selector-bar">
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>Theme:</span>
                {[
                  { name: 'creme', color: '#faf5ed', borderColor: '#4e3629', label: 'Creme' },
                  { name: 'green', color: '#edf7ed', borderColor: '#2b3e34', label: 'Sage' },
                  { name: 'pink', color: '#fff0f5', borderColor: '#5c3b47', label: 'Sakura' },
                  { name: 'white', color: '#ffffff', borderColor: '#212529', label: 'White' },
                  { name: 'dark', color: '#1a120b', borderColor: '#fcecd8', label: 'Dark' }
                ].map(t => {
                  const currentTheme = ['creme', 'green', 'pink', 'white', 'dark'].includes(settings?.theme || '') ? settings?.theme : 'creme';
                  const isActive = currentTheme === t.name;
                  return (
                    <button
                      key={t.name}
                      onClick={() => handleThemeChange(t.name as any)}
                      className={`theme-circle-btn ${isActive ? 'active' : ''}`}
                      title={t.label}
                      style={{
                        backgroundColor: t.color,
                        border: `2px solid ${t.borderColor}`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Global Progress Bar */}
          <div className="header-progress-box">
            <div className="header-progress-bar-group">
              <div className="header-progress-bar-labels">
                <span>Completed</span>
                <span>{totalCompleted} / {totalGoal}</span>
              </div>
              <div className="pixel-progress-container">
                <div 
                  className="pixel-progress-fill" 
                  style={{ width: `${overallPercentage}%` }} 
                />
              </div>
            </div>
            <div className="header-percentage-badge">
              {overallPercentage}%
            </div>
          </div>
        </header>

        {/* TAB: GOALS */}
        {activeTab === 'goals' && (
          <div className="content-container">
            {stats && stats.currentStreak > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                border: '2px solid var(--primary)',
                borderRadius: '2px',
                color: 'var(--primary)',
                fontWeight: 'bold',
                fontSize: '13px',
                width: 'fit-content'
              }}>
                <Flame size={14} fill="var(--primary)" />
                <span>You are on a {stats.currentStreak} day streak! Keep it up roommate!</span>
              </div>
            )}

            {/* Mobile PWA Installation Tip */}
            {(window.electronAPI as any).triggerWebReminder !== undefined && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 16px',
                backgroundColor: 'var(--panel-bg)',
                boxShadow: 'var(--pixel-border)',
                fontSize: '15px',
                lineHeight: '1.4',
                color: 'var(--text-main)',
                borderRadius: '2px',
                margin: '8px'
              }}>
                <span style={{ fontSize: '18px' }}>💡</span>
                <div>
                  <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>Mobile Reminders: </span>
                  For background notifications on mobile, add this page to your Home Screen (tap Share/Menu &rarr; "Add to Home Screen"). Reminders will run while the app is open or active.
                </div>
              </div>
            )}

            {habits.length === 0 ? (
              <div className="pixel-panel" style={{ textAlign: 'center', padding: '40px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>No habits registered!</h3>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Click Add Habit to schedule reminders and bring your roommate to life.
                </p>
                <button onClick={() => setActiveTab('add')} className="pixel-btn pixel-btn-primary">
                  Create Habit
                </button>
              </div>
            ) : (
              <div className="goals-grid">
                {habits.map(habit => {
                  const count = getCompletedCount(habit.id);
                  const percentage = Math.min(100, Math.round((count / habit.goal) * 100));

                  return (
                    <div 
                      key={habit.id} 
                      className="pixel-panel goal-card"
                      style={{ borderLeftColor: habit.color || 'var(--primary)' }}
                    >
                      {/* Title, Emoji & Clock */}
                      <div className="card-title-area" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="card-emoji">{habit.emoji}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
                          <span className="card-title-text">{habit.name}</span>
                          <span className="card-subtitle-text">
                            <Clock size={10} style={{ flexShrink: 0 }} />
                            {habit.startTime} - {habit.endTime} {habit.duration && `(${habit.duration}m)`}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="card-progress-section">
                        <div className="card-progress-labels">
                          <span>{percentage}% done</span>
                          <span>{count}/{habit.goal}</span>
                        </div>
                        <div className="pixel-progress-container">
                          <div 
                            className="pixel-progress-fill" 
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: habit.color || 'var(--primary)'
                            }} 
                          />
                        </div>
                      </div>

                      {/* Action buttons row */}
                      <div className="card-actions">
                        <button 
                          onClick={() => handleQuickLog(habit.id)}
                          disabled={count >= habit.goal}
                          className="pixel-btn"
                        >
                          Done
                        </button>
                        <button 
                          onClick={() => handleEditClick(habit)}
                          className="pixel-btn"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleQuickDelete(habit.id)}
                          className="pixel-btn"
                          style={{ color: '#ef4444' }}
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: ADD / EDIT HABIT */}
        {activeTab === 'add' && (
          <div className="content-container">
            <div className="pixel-panel form-card">
            <form onSubmit={handleHabitSubmit}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Habit Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Drink Water"
                    value={habitForm.name}
                    onChange={e => setHabitForm(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Emoji Symbol</label>
                  <input 
                    type="text" 
                    required
                    maxLength={4}
                    value={habitForm.emoji}
                    onChange={e => setHabitForm(prev => ({ ...prev, emoji: e.target.value }))}
                    className="form-input"
                    style={{ textAlign: 'center' }}
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Daily Goal Count</label>
                  <input 
                    type="number" 
                    required
                    min={1}
                    max={50}
                    value={habitForm.goal}
                    onChange={e => {
                      const raw = e.target.value;
                      const val = parseInt(raw, 10);
                      setHabitForm(prev => ({ ...prev, goal: raw === '' ? '' as any : val }));
                      if (scheduleMode === 'manual' && !isNaN(val) && val > 0) {
                        setCustomTimes(generateDefaultTimes(val, habitForm.startTime, habitForm.endTime));
                      }
                    }}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Start Window</label>
                  <input 
                    type="time" 
                    required
                    value={habitForm.startTime}
                    onChange={e => {
                      const val = e.target.value;
                      setHabitForm(prev => ({ ...prev, startTime: val }));
                      if (scheduleMode === 'manual') {
                        setCustomTimes(generateDefaultTimes(habitForm.goal, val, habitForm.endTime));
                      }
                    }}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>End Window</label>
                  <input 
                    type="time" 
                    required
                    value={habitForm.endTime}
                    onChange={e => {
                      const val = e.target.value;
                      setHabitForm(prev => ({ ...prev, endTime: val }));
                      if (scheduleMode === 'manual') {
                        setCustomTimes(generateDefaultTimes(habitForm.goal, habitForm.startTime, val));
                      }
                    }}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Countdown Timer (Optional Minutes)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 15 for walk timers"
                    value={habitForm.duration}
                    onChange={e => setHabitForm(prev => ({ ...prev, duration: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Habit Custom Accent Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="color" 
                      value={habitForm.color}
                      onChange={e => setHabitForm(prev => ({ ...prev, color: e.target.value }))}
                      style={{ width: '36px', height: '36px', border: '2px solid var(--border-color)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '15px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {habitForm.color.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Schedule Mode Selector */}
              <div className="form-group">
                <label>Scheduling Mode</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '6px' }}>
                  <label className="checkbox-label" style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    <input
                      type="radio"
                      name="scheduleMode"
                      checked={scheduleMode === 'auto'}
                      onChange={() => {
                        playRetroSound('click');
                        setScheduleMode('auto');
                      }}
                      className="checkbox-input"
                      style={{ width: '15px', height: '15px' }}
                    />
                    <span>Automatic (Distribute Evenly)</span>
                  </label>
                  <label className="checkbox-label" style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    <input
                      type="radio"
                      name="scheduleMode"
                      checked={scheduleMode === 'manual'}
                      onChange={() => {
                        playRetroSound('click');
                        setScheduleMode('manual');
                        setCustomTimes(generateDefaultTimes(habitForm.goal, habitForm.startTime, habitForm.endTime));
                      }}
                      className="checkbox-input"
                      style={{ width: '15px', height: '15px' }}
                    />
                    <span>Manual (Customize Each Reminder)</span>
                  </label>
                </div>
              </div>

              {/* Scrollable list of manual time inputs if manual mode is active */}
              {scheduleMode === 'manual' && (
                <div className="form-group">
                  <label>Set Reminder Times ({habitForm.goal} total)</label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                    gap: '10px',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    padding: '10px',
                    border: '2px solid var(--border-color)',
                    backgroundColor: 'var(--bg-color)',
                    marginTop: '6px'
                  }}>
                    {Array.from({ length: habitForm.goal }).map((_, index) => (
                      <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                          Time #{index + 1}
                        </span>
                        <input
                          type="time"
                          required
                          value={customTimes[index] || ''}
                          onChange={e => {
                            const updated = [...customTimes];
                            updated[index] = e.target.value;
                            setCustomTimes(updated);
                          }}
                          className="form-input"
                          style={{ padding: '6px 8px', fontSize: '18px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Roommate Custom Support Message</label>
                <textarea 
                  rows={2}
                  placeholder="Hey! Time to drink some water! 💧"
                  value={habitForm.message}
                  onChange={e => setHabitForm(prev => ({ ...prev, message: e.target.value }))}
                  className="form-textarea"
                  style={{ resize: 'none' }}
                />
              </div>

              <div className="form-actions">
                {editingHabit && (
                  <button 
                    type="button" 
                    onClick={() => { playRetroSound('click'); setEditingHabit(null); setActiveTab('goals'); }} 
                    className="pixel-btn"
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="pixel-btn pixel-btn-primary">
                  {editingHabit ? 'Save Details' : 'Create Reminder'}
                </button>
              </div>
            </form>
          </div>
          </div>
        )}

        {/* TAB: STATISTICS */}
        {activeTab === 'stats' && (
          <div className="content-container">
            {stats ? (
              <>
                <div className="stats-cards-grid">
                  <div className="pixel-panel stats-card">
                    <span className="stats-card-title">
                      <Flame size={12} /> Current Streak
                    </span>
                    <span className="stats-card-value">{stats.currentStreak} Days</span>
                  </div>
                  <div className="pixel-panel stats-card">
                    <span className="stats-card-title">
                      <TrendingUp size={12} /> Longest Streak
                    </span>
                    <span className="stats-card-value">{stats.longestStreak} Days</span>
                  </div>
                  <div className="pixel-panel stats-card">
                    <span className="stats-card-title">Most Skipped</span>
                    <span className="stats-card-value" style={{ fontSize: '20px', color: '#ef4444' }}>
                      {stats.mostSkipped ? `${stats.mostSkipped.name}` : 'None'}
                    </span>
                  </div>
                  <div className="pixel-panel stats-card">
                    <span className="stats-card-title">Most Snoozed</span>
                    <span className="stats-card-value" style={{ fontSize: '20px', color: '#3b82f6' }}>
                      {stats.mostSnoozed ? `${stats.mostSnoozed.name}` : 'None'}
                    </span>
                  </div>
                </div>

                <div className="pixel-panel stats-chart-card">
                  <h3 style={{ fontFamily: 'var(--font-retro)', fontSize: '14px', marginBottom: '16px' }}>
                    Completion Rates Analytics
                  </h3>
                  <div className="stats-chart-group">
                    <div className="stats-chart-row">
                      <div className="stats-chart-labels">
                        <span>Today</span>
                        <span>{stats.dailyCompletionRate}%</span>
                      </div>
                      <div className="pixel-progress-container" style={{ height: '20px' }}>
                        <div 
                          className="pixel-progress-fill" 
                          style={{ width: `${stats.dailyCompletionRate}%`, backgroundColor: '#d97706' }} 
                        />
                      </div>
                    </div>

                    <div className="stats-chart-row">
                      <div className="stats-chart-labels">
                        <span>Weekly Avg</span>
                        <span>{stats.weeklyCompletionRate}%</span>
                      </div>
                      <div className="pixel-progress-container" style={{ height: '20px' }}>
                        <div 
                          className="pixel-progress-fill" 
                          style={{ width: `${stats.weeklyCompletionRate}%`, backgroundColor: '#10b981' }} 
                        />
                      </div>
                    </div>

                    <div className="stats-chart-row">
                      <div className="stats-chart-labels">
                        <span>Monthly Avg</span>
                        <span>{stats.monthlyCompletionRate}%</span>
                      </div>
                      <div className="pixel-progress-container" style={{ height: '20px' }}>
                        <div 
                          className="pixel-progress-fill" 
                          style={{ width: `${stats.monthlyCompletionRate}%`, backgroundColor: '#3b82f6' }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="pixel-panel" style={{ textAlign: 'center', padding: '20px' }}>
                Loading Metrics...
              </div>
            )}
          </div>
        )}

        {/* TAB: SETTINGS */}
        {activeTab === 'settings' && settingsForm && (
          <div className="content-container">
            <div className="pixel-panel" style={{ maxWidth: '600px' }}>
            <div className="settings-panel-grid">
              <div className="form-group">
                <label>Visual Mode Theme</label>
                <select
                  value={settingsForm.theme}
                  onChange={e => {
                    const themeValue = e.target.value as any;
                    const newS = { ...settingsForm, theme: themeValue };
                    setSettingsForm(newS);
                    handleSettingsSave(newS);
                    
                    // Force apply theme immediately
                    const root = document.documentElement;
                    root.classList.remove('theme-creme', 'theme-green', 'theme-pink', 'theme-white', 'theme-dark', 'dark');
                    root.classList.add(`theme-${themeValue}`);
                    if (themeValue === 'dark') {
                      root.classList.add('dark');
                    }
                  }}
                  className="form-select"
                >
                  <option value="creme">Creme (Cozy Warm)</option>
                  <option value="green">Sage (Pastel Green)</option>
                  <option value="pink">Sakura (Pastel Pink)</option>
                  <option value="white">White (Minimalist)</option>
                  <option value="dark">Cozy Midnight (Dark)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Character Scale Size</label>
                <select
                  value={settingsForm.scale}
                  onChange={e => {
                    const newS = { ...settingsForm, scale: e.target.value as any };
                    setSettingsForm(newS);
                    handleSettingsSave(newS);
                  }}
                  className="form-select"
                >
                  <option value="small">Small (64x64)</option>
                  <option value="medium">Medium (96x96)</option>
                  <option value="large">Large (128x128)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Corner Popup Location</label>
                <select
                  value={settingsForm.position}
                  onChange={e => {
                    const newS = { ...settingsForm, position: e.target.value as any };
                    setSettingsForm(newS);
                    handleSettingsSave(newS);
                  }}
                  className="form-select"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>

              <div className="form-group">
                <label>Animation Motion Speed</label>
                <select
                  value={settingsForm.speed}
                  onChange={e => {
                    const newS = { ...settingsForm, speed: Number(e.target.value) };
                    setSettingsForm(newS);
                    handleSettingsSave(newS);
                  }}
                  className="form-select"
                >
                  <option value="0.75">Slower (0.75x)</option>
                  <option value="1">Normal (1.0x)</option>
                  <option value="1.25">Cheerier (1.25x)</option>
                  <option value="1.5">Fast (1.5x)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Roommate Character</label>
                <select
                  value={settingsForm.character || 'girl'}
                  onChange={e => {
                    const newS = { ...settingsForm, character: e.target.value as any };
                    setSettingsForm(newS);
                    handleSettingsSave(newS);
                  }}
                  className="form-select"
                >
                  <option value="girl">Cozy Girl</option>
                  <option value="boy">Cozy Boy</option>
                  <option value="cat">Cozy Cat</option>
                </select>
              </div>
            </div>

            <div className="toggle-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settingsForm.sounds}
                  onChange={e => {
                    const newS = { ...settingsForm, sounds: e.target.checked };
                    setSettingsForm(newS);
                    handleSettingsSave(newS);
                  }}
                  className="checkbox-input"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {settingsForm.sounds ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  <span>Enable synthesized 8-bit retro sound cues</span>
                </div>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settingsForm.startup}
                  onChange={e => {
                    const newS = { ...settingsForm, startup: e.target.checked };
                    setSettingsForm(newS);
                    handleSettingsSave(newS);
                  }}
                  className="checkbox-input"
                />
                <span>Register app to boot with Windows startup</span>
              </label>
            </div>
            </div>
          </div>
        )}

      </main>

      {/* Floating guide companion in the bottom-right corner */}
      <div className="dashboard-roommate-guide">
        <div className="guide-speech-bubble">
          {activeTab === 'goals' && "Let's complete our goals today!"}
          {activeTab === 'add' && (editingHabit ? "Editing this habit!" : "Adding a new routine?")}
          {activeTab === 'stats' && "Look at your amazing streaks!"}
          {activeTab === 'settings' && "Making things cozy?"}
        </div>
        <Companion 
          expression={activeTab === 'stats' ? 'celebrate' : activeTab === 'add' ? 'neutral' : 'happy'} 
          character={settings?.character || 'girl'}
          scale="medium" 
          animation="idle" 
        />
      </div>
    </div>
  );
}
