// audio.js - Zero-dependency procedural Web Audio API sound engine
// Provides countdown ticks, answer chimes, streak sounds, fanfare, and dynamic background music.

(function (window) {
  let ctx = null;
  let muted = localStorage.getItem('quiz_sound_muted') === 'true';
  let musicGain = null;
  let sfxGain = null;
  let activeThemeTimer = null;
  let isPlayingMusic = false;

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
        musicGain = ctx.createGain();
        musicGain.gain.setValueAtTime(muted ? 0 : 0.18, ctx.currentTime);
        musicGain.connect(ctx.destination);

        sfxGain = ctx.createGain();
        sfxGain.gain.setValueAtTime(muted ? 0 : 0.35, ctx.currentTime);
        sfxGain.connect(ctx.destination);
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  // Ensure AudioContext starts on user interaction
  function unlockAudio() {
    const context = getContext();
    if (context && context.state === 'suspended') {
      context.resume();
    }
  }

  ['click', 'touchstart', 'keydown'].forEach((event) => {
    document.addEventListener(event, unlockAudio, { once: true, passive: true });
  });

  const QuizAudio = {
    unlock: unlockAudio,

    isMuted() {
      return muted;
    },

    toggleMute() {
      muted = !muted;
      localStorage.setItem('quiz_sound_muted', muted ? 'true' : 'false');
      if (ctx) {
        const t = ctx.currentTime;
        if (musicGain) musicGain.gain.setValueAtTime(muted ? 0 : 0.18, t);
        if (sfxGain) sfxGain.gain.setValueAtTime(muted ? 0 : 0.35, t);
      }
      return muted;
    },

    // Crisp countdown clock tick with pitch ascending as timer expires
    playTick(pitchRatio = 1) {
      if (muted) return;
      const c = getContext();
      if (!c) return;
      try {
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();

        // Higher pitch for lower remaining time
        const baseFreq = 600 + (1 - Math.max(0, Math.min(1, pitchRatio))) * 600;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.04);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(sfxGain || c.destination);

        osc.start(t);
        osc.stop(t + 0.05);
      } catch (e) {}
    },

    // Bright 3-note ascending victory chime
    playCorrect() {
      if (muted) return;
      const c = getContext();
      if (!c) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const t = c.currentTime + i * 0.08;
          const osc = c.createOscillator();
          const gain = c.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.35, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

          osc.connect(gain);
          gain.connect(sfxGain || c.destination);

          osc.start(t);
          osc.stop(t + 0.3);
        });
      } catch (e) {}
    },

    // Soft buzz for incorrect answers
    playWrong() {
      if (muted) return;
      const c = getContext();
      if (!c) return;
      try {
        const t = c.currentTime;
        const osc1 = c.createOscillator();
        const osc2 = c.createOscillator();
        const gain = c.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, t);
        osc1.frequency.linearRampToValueAtTime(110, t + 0.28);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(142, t);
        osc2.frequency.linearRampToValueAtTime(104, t + 0.28);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(sfxGain || c.destination);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.32);
        osc2.stop(t + 0.32);
      } catch (e) {}
    },

    // Rising power-up sound for streak milestones
    playStreak(streakCount = 2) {
      if (muted) return;
      const c = getContext();
      if (!c) return;
      try {
        const t = c.currentTime;
        const baseFreq = 440 * Math.min(1.8, 1 + streakCount * 0.15);
        const osc = c.createOscillator();
        const gain = c.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, t + 0.35);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.connect(gain);
        gain.connect(sfxGain || c.destination);

        osc.start(t);
        osc.stop(t + 0.42);
      } catch (e) {}
    },

    // Gentle pop sound for floating reactions
    playPop() {
      if (muted) return;
      const c = getContext();
      if (!c) return;
      try {
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();

        const f = 400 + Math.random() * 300;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.06);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        osc.connect(gain);
        gain.connect(sfxGain || c.destination);

        osc.start(t);
        osc.stop(t + 0.07);
      } catch (e) {}
    },

    // Grand fanfare for podium and final winners
    playPodiumFanfare() {
      if (muted) return;
      const c = getContext();
      if (!c) return;
      try {
        const fanfareChords = [
          { notes: [523.25, 659.25], time: 0, dur: 0.18 },
          { notes: [523.25, 659.25], time: 0.2, dur: 0.18 },
          { notes: [523.25, 659.25], time: 0.4, dur: 0.18 },
          { notes: [659.25, 783.99, 1046.5], time: 0.65, dur: 0.7 },
        ];

        fanfareChords.forEach((chord) => {
          chord.notes.forEach((freq) => {
            const t = c.currentTime + chord.time;
            const osc = c.createOscillator();
            const gain = c.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + chord.dur);

            osc.connect(gain);
            gain.connect(sfxGain || c.destination);

            osc.start(t);
            osc.stop(t + chord.dur + 0.05);
          });
        });
      } catch (e) {}
    },

    // Upbeat procedural lobby music loop
    startLobbyMusic() {
      this.stopAllMusic();
      const c = getContext();
      if (!c) return;
      isPlayingMusic = true;

      const chordProg = [
        [261.63, 329.63, 392.0], // C
        [220.0, 261.63, 329.63], // Am
        [174.61, 220.0, 261.63], // F
        [196.0, 246.94, 293.66], // G
      ];

      let step = 0;
      const bpm = 116;
      const stepDuration = (60 / bpm) * 0.5;

      const playStep = () => {
        if (!isPlayingMusic || muted) {
          activeThemeTimer = setTimeout(playStep, stepDuration * 1000);
          return;
        }

        const t = c.currentTime;
        const chordIndex = Math.floor(step / 8) % chordProg.length;
        const currentChord = chordProg[chordIndex];
        const noteFreq = currentChord[step % currentChord.length];

        // Pluck note
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq * (step % 2 === 0 ? 1 : 2), t);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.9);

        osc.connect(gain);
        gain.connect(musicGain || c.destination);

        osc.start(t);
        osc.stop(t + stepDuration);

        step = (step + 1) % 32;
        activeThemeTimer = setTimeout(playStep, stepDuration * 1000);
      };

      playStep();
    },

    // Dynamic rhythmic question theme with subtle tension
    startQuestionTheme() {
      this.stopAllMusic();
      const c = getContext();
      if (!c) return;
      isPlayingMusic = true;

      let step = 0;
      const bpm = 128;
      const stepDuration = (60 / bpm) * 0.5;

      const bassNotes = [130.81, 130.81, 155.56, 174.61, 164.81, 130.81, 116.54, 123.47];

      const playStep = () => {
        if (!isPlayingMusic || muted) {
          activeThemeTimer = setTimeout(playStep, stepDuration * 1000);
          return;
        }

        const t = c.currentTime;
        const noteFreq = bassNotes[step % bassNotes.length];

        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = step % 4 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(noteFreq, t);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.85);

        osc.connect(gain);
        gain.connect(musicGain || c.destination);

        osc.start(t);
        osc.stop(t + stepDuration);

        step++;
        activeThemeTimer = setTimeout(playStep, stepDuration * 1000);
      };

      playStep();
    },

    stopAllMusic() {
      isPlayingMusic = false;
      if (activeThemeTimer) {
        clearTimeout(activeThemeTimer);
        activeThemeTimer = null;
      }
    },
  };

  window.QuizAudio = QuizAudio;
})(window);
