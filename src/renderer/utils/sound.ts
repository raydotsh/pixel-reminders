// sound.ts - Retro 8-bit Synthesizer

let audioEnabled = true;

export function setSoundEnabled(enabled: boolean) {
  audioEnabled = enabled;
}

export function playRetroSound(type: 'chime' | 'success' | 'victory' | 'click') {
  if (!audioEnabled) return;
  
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    
    if (type === 'click') {
      playTone(ctx, 300, 0.05, 0, 'triangle', 0.03);
    } else if (type === 'chime') {
      // Wholesome high chime
      playTone(ctx, 587.33, 0.08, 0, 'sine', 0.06); // D5
      playTone(ctx, 880.00, 0.12, 0.09, 'sine', 0.06); // A5
    } else if (type === 'success') {
      // Cheerful ascending arpeggio
      playTone(ctx, 523.25, 0.06, 0, 'square', 0.04);   // C5
      playTone(ctx, 659.25, 0.06, 0.07, 'square', 0.04);  // E5
      playTone(ctx, 783.99, 0.06, 0.14, 'square', 0.04);  // G5
      playTone(ctx, 1046.50, 0.15, 0.21, 'square', 0.04); // C6
    } else if (type === 'victory') {
      // Uplifting JRPG fanfare
      playTone(ctx, 523.25, 0.08, 0, 'square', 0.04);
      playTone(ctx, 523.25, 0.04, 0.09, 'square', 0.04);
      playTone(ctx, 523.25, 0.04, 0.14, 'square', 0.04);
      playTone(ctx, 523.25, 0.12, 0.19, 'square', 0.04);
      playTone(ctx, 659.25, 0.12, 0.32, 'square', 0.04);
      playTone(ctx, 783.99, 0.12, 0.45, 'square', 0.04);
      playTone(ctx, 1046.50, 0.30, 0.58, 'square', 0.04);
    }
  } catch (err) {
    console.error('AudioContext synthesis failed', err);
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  delay: number,
  type: OscillatorType,
  volume = 0.05
) {
  setTimeout(() => {
    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (err) {
      // Ignore audio start failures if context is suspended
    }
  }, delay * 1000);
}
