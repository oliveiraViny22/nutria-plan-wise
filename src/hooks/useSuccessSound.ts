import { useCallback, useRef } from 'react';

// Success sound frequency pattern - a pleasant ascending chime
const FREQUENCIES = [523.25, 659.25, 783.99]; // C5, E5, G5 (major chord arpeggio)
const DURATION = 0.12;
const GAIN = 0.15; // Subtle volume

export function useSuccessSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSuccessSound = useCallback(() => {
    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      // Resume context if suspended (required by some browsers)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      FREQUENCIES.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now);

        // Envelope: quick attack, sustain, gentle release
        const startTime = now + i * 0.08;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(GAIN, startTime + 0.02);
        gainNode.gain.setValueAtTime(GAIN, startTime + DURATION);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + DURATION + 0.15);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + DURATION + 0.2);
      });
    } catch (error) {
      // Silently fail - audio is optional enhancement
      console.debug('Audio playback failed:', error);
    }
  }, []);

  return { playSuccessSound };
}
