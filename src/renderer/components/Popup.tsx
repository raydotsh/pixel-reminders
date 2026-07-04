import React, { useState, useEffect } from 'react';
import Companion, { CompanionExpression } from './Companion';
import Confetti from './Confetti';
import { Habit } from '../../types';
import { playRetroSound, setSoundEnabled } from '../utils/sound';

interface PopupProps {
  habitId: string;
  progress: number;
  goal: number;
}

export default function Popup({ habitId: initialHabitId, progress: initialProgress, goal: initialGoal }: PopupProps) {
  const [habit, setHabit] = useState<Habit | null>(null);
  const [progress, setProgress] = useState(initialProgress);
  const [expression, setExpression] = useState<CompanionExpression>('neutral');
  const [animation, setAnimation] = useState<'idle' | 'wave' | 'jump' | 'none'>('idle');
  const [message, setMessage] = useState('');
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);
  const [isConfettiActive, setIsConfettiActive] = useState(false);
  const [character, setCharacter] = useState<'girl' | 'boy' | 'cat'>('girl');
  
  // Stages: 'walking' -> 'talking'
  const [stage, setStage] = useState<'walking' | 'talking'>('walking');
  const [isExiting, setIsExiting] = useState(false);
  
  const [showBubble, setShowBubble] = useState(true);
  
  // Timer state for Walk timers
  const [timerState, setTimerState] = useState<{
    isActive: boolean;
    timeLeft: number;
    totalDuration: number;
  }>({
    isActive: false,
    timeLeft: 0,
    totalDuration: 0,
  });

  const [isWide, setIsWide] = useState(typeof window !== 'undefined' && window.innerWidth > 768);

  useEffect(() => {
    const handleResize = () => {
      setIsWide(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isElectron = typeof document !== 'undefined' && document.documentElement.classList.contains('is-electron');
  const shouldAnimateWalk = isElectron || isWide;
  const currentTransform = isExiting 
    ? (shouldAnimateWalk ? 'translateX(380px)' : 'none') 
    : stage === 'walking' 
      ? (shouldAnimateWalk ? 'translateX(380px)' : 'none') 
      : 'none';

  // Load Habit details
  useEffect(() => {
    const loadHabitDetails = async () => {
      try {
        const habits = await window.electronAPI.getHabits();
        const settings = await window.electronAPI.getSettings();
        setSoundEnabled(settings.sounds);
        
        const found = habits.find(h => h.id === initialHabitId);
        if (found) {
          setHabit(found);
          setMessage(found.message || `Time to ${found.name.toLowerCase()}!`);
          setExpression('neutral');
          setAnimation('idle'); // Breathing while walking
          setCharacter(settings.character || 'girl');
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    if (initialHabitId) {
      loadHabitDetails();
    }
  }, [initialHabitId]);

  // Handle Walking Stage to Talking Stage transition (5.5 seconds walk)
  useEffect(() => {
    if (stage === 'walking' && habit) {
      const walkTimer = setTimeout(() => {
        setStage('talking');
        setExpression('happy');
        setAnimation('wave'); // Wave when bubble appears
        playRetroSound('chime'); // Play sound exactly when bubble pops up!
        
        // Stop waving and stand still (idle breathing) after 1.2 seconds
        setTimeout(() => {
          setAnimation('idle');
        }, 1200);
      }, 5500);
      return () => clearTimeout(walkTimer);
    }
  }, [stage, habit]);

  // Listen to Walk Timer tick updates from Electron
  useEffect(() => {
    const removeListener = window.electronAPI.onTimerUpdate((data) => {
      if (data.habitId === initialHabitId) {
        if (data.isFinished) {
          // Timer finished!
          setTimerState({ isActive: false, timeLeft: 0, totalDuration: 0 });
          setProgress(prev => prev + 1);
          setExpression('celebrate');
          setAnimation('jump');
          setMessage('🎉 Great job! Walk completed!');
          playRetroSound('victory');
          setIsConfettiActive(true);
          
          // Auto exit walk-out after 3.5 seconds
          setTimeout(() => {
            handleExitSequence();
          }, 3500);
        } else {
          setTimerState({
            isActive: true,
            timeLeft: data.timeLeft,
            totalDuration: data.totalDuration,
          });
          setExpression('happy');
        }
      }
    });

    return () => {
      removeListener();
    };
  }, [initialHabitId]);

  const handleExitSequence = () => {
    setIsExiting(true);
    // Hides the speech bubble, plays walk-out animation, and closes Electron after 2 seconds
    setTimeout(() => {
      window.electronAPI.closePopup();
    }, 2000);
  };

  const handleDone = async () => {
    if (!habit) return;
    
    setShowBubble(false);
    setProgress(prev => prev + 1);
    setExpression('celebrate');
    setAnimation('jump');
    setMessage('Nice! Keep it up! ✨');
    setIsConfettiActive(true);
    playRetroSound('success');

    // Save to Database
    await window.electronAPI.logProgress(habit.id, 'completed');

    // Start exit sequence after 2 seconds
    setTimeout(() => {
      handleExitSequence();
    }, 2000);
  };

  const handleSnooze = (minutes: number) => {
    if (!habit) return;
    
    setShowBubble(false);
    setExpression('sleepy');
    setMessage(`Snoozed for ${minutes}m. See you soon! 😊`);
    playRetroSound('click');
    
    // Save to Database
    window.electronAPI.logProgress(habit.id, 'snoozed', minutes);

    setTimeout(() => {
      handleExitSequence();
    }, 1500);
  };

  const handleStartWalk = () => {
    if (!habit || !habit.duration) return;
    
    setShowBubble(false);
    playRetroSound('click');
    setTimerState({
      isActive: true,
      timeLeft: habit.duration * 60,
      totalDuration: habit.duration * 60,
    });
    
    // Start countdown timer in Main process
    window.electronAPI.startWalkTimer(habit.id, habit.duration);
    // Minimize popup to corner bubble
    window.electronAPI.minimizePopup();
  };

  if (!habit) return null;

  // Formatting utility for timer (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Minimized Walk Timer Layout (fits 160x90)
  if (timerState.isActive) {
    return (
      <div 
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          padding: '4px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 10px',
          backgroundColor: 'var(--panel-bg)',
          boxShadow: 'var(--pixel-border)',
          width: '100%',
          height: '100%',
          borderRadius: '2px',
          boxSizing: 'border-box'
        }}>
          <Companion 
            expression="happy" 
            character={character}
            scale="small" 
            animation="idle" 
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ 
              fontFamily: 'var(--font-pixel)', 
              fontSize: '26px', 
              fontWeight: 'bold', 
              lineHeight: '0.9',
              color: 'var(--text-main)' 
            }}>
              {formatTime(timerState.timeLeft)}
            </span>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'bold' }}>Walking...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-root">
      <Confetti active={isConfettiActive} />

      <div className="popup-flow" style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-end' }}>
        {/* Companion walks in from right, stands on right side */}
        <div 
          className={isExiting ? "animate-walk-out" : stage === 'walking' ? "animate-walk-calmly" : ""}
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-end', 
            flexShrink: 0,
            transform: currentTransform
          }}
        >
          <Companion expression={expression} character={character} scale="medium" animation={animation} />
        </div>

        {/* Floating Bubble Panel (appears on her LEFT on screen, always in DOM to prevent layout shift) */}
        <div 
          className={stage === 'talking' ? "popup-bubble-side animate-bubble-fadein" : "popup-bubble-side"}
          style={{
            visibility: (stage === 'talking' && !isExiting && showBubble) ? 'visible' : 'hidden',
            opacity: (stage === 'talking' && !isExiting && showBubble) ? 1 : 0,
            pointerEvents: (stage === 'talking' && !isExiting && showBubble) ? 'auto' : 'none',
            transition: 'opacity 0.3s ease, visibility 0.3s ease'
          }}
        >
          <div className="popup-bubble-panel">
            <span className="popup-heading">
              {habit.emoji} {habit.name}
            </span>
            <p className="popup-msg">
              {message}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div className="popup-progress-labels">
                <span>Today's Progress</span>
                <span style={{ fontFamily: 'monospace' }}>{progress} / {habit.goal}</span>
              </div>
              <div className="pixel-progress-container" style={{ height: '10px' }}>
                <div 
                  className="pixel-progress-fill" 
                  style={{ 
                    width: `${Math.min(100, (progress / habit.goal) * 100)}%`,
                    backgroundColor: habit.color || 'var(--primary)' 
                  }} 
                />
              </div>
            </div>

            {/* Actions Row - Done and Snooze (Exactly 2 options) */}
            <div className="popup-btn-row">
              {!isSnoozeOpen ? (
                <>
                  {habit.duration ? (
                    <button onClick={handleStartWalk} className="pixel-btn pixel-btn-primary">
                      Start Walk
                    </button>
                  ) : (
                    <button onClick={handleDone} className="pixel-btn pixel-btn-primary">
                      Done
                    </button>
                  )}
                  <button onClick={() => setIsSnoozeOpen(true)} className="pixel-btn">
                    Snooze
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)', marginRight: '2px' }}>Time:</span>
                  {[5, 10, 15, 30].map(mins => (
                    <button
                      key={mins}
                      onClick={() => handleSnooze(mins)}
                      className="pixel-btn"
                      style={{ padding: '4px 6px', fontSize: '13px' }}
                    >
                      {mins}m
                    </button>
                  ))}
                  <button
                    onClick={() => setIsSnoozeOpen(false)}
                    className="pixel-btn"
                    style={{ padding: '4px 6px', fontSize: '13px', color: 'var(--text-muted)' }}
                  >
                    Back
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
