// Sound effect utilities for task completions and celebrations

export type SoundType = 'complete' | 'bonus' | 'streak' | 'achievement' | 'levelup';

export function playTaskSound(type: 'cleaning' | 'reminder' | 'task' = 'task') {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    const frequencies: Record<string, number[]> = {
      cleaning: [523.25, 659.25], // C5 -> E5 (clean, bright)
      reminder: [440, 554.37], // A4 -> C#5 (attention-grabbing)
      task: [392, 523.25], // G4 -> C5 (satisfying)
    };

    const notes = frequencies[type] || frequencies.task;
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });

    setTimeout(() => ctx.close(), 500);
  } catch {}
}

export function playBonusSound() {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    // Ascending arpeggio for bonus
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 -> E5 -> G5 -> C6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.25);
    });

    setTimeout(() => ctx.close(), 600);
  } catch {}
}

export function playStreakSound() {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    // Fire sound - crackling effect
    const notes = [880, 932.33, 987.77]; // A5 -> A#5 -> B5
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.05 + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + i * 0.05 + 0.2);
    });

    setTimeout(() => ctx.close(), 400);
  } catch {}
}

export function playAchievementSound() {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    // Triumphant fanfare
    const notes = [
      { freq: 523.25, start: 0, dur: 0.15 }, // C5
      { freq: 659.25, start: 0.15, dur: 0.15 }, // E5
      { freq: 783.99, start: 0.3, dur: 0.15 }, // G5
      { freq: 1046.50, start: 0.45, dur: 0.4 }, // C6 (hold)
    ];
    
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });

    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

export function playLevelUpSound() {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    // Epic level up sound
    const notes = [
      { freq: 392, start: 0, dur: 0.1 }, // G4
      { freq: 523.25, start: 0.1, dur: 0.1 }, // C5
      { freq: 659.25, start: 0.2, dur: 0.1 }, // E5
      { freq: 783.99, start: 0.3, dur: 0.1 }, // G5
      { freq: 1046.50, start: 0.4, dur: 0.5 }, // C6 (hold)
    ];
    
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });

    setTimeout(() => ctx.close(), 1000);
  } catch {}
}
