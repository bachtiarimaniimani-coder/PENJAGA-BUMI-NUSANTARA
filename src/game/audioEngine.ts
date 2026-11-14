export type NarratorPersona = 'rahma' | 'ilyas' | 'muted';
export type NarrationVoiceStatus = 'idle' | 'waiting' | 'speaking';

const OPENING_MUSIC_ASSET_PATH = '/assets/aistudio/OPENING_OK-base64-datauri.HTML_bf6d558e.txt';
const OPENING_MUSIC_VOLUME = 0.42;
const OPENING_MUSIC_DUCKED_VOLUME = 0.14;

const TRANSITION_MUSIC_ASSET_PATH =
  '/assets/aistudio/TRANSISI_ANTAR_GAME_-_MENEGANGKAN-base64-datauri_9b3d3b06.txt';
const TRANSITION_MUSIC_VOLUME = 0.34;
const TRANSITION_MUSIC_DUCKED_VOLUME = 0.14;

const PROLOGUE_MUSIC_ASSET_PATH =
  '/assets/aistudio/TRANSISI_ANTAR_GAME_-_MENEGANGKAN-base64-datauri_9b3d3b06.txt';
const PROLOGUE_MUSIC_VOLUME = 0.42;
const PROLOGUE_MUSIC_DUCKED_VOLUME = 0.2;

const LEVEL_MUSIC_TRACK_CONFIG: Record<
  number,
  { assetPath: string; volume: number; duckedVolume: number }
> = {
  1: {
    assetPath: '/assets/aistudio/LEVEL_1_OK-base64-datauri_cdee1dfa.txt',
    volume: 0.32,
    duckedVolume: 0.1,
  },
  2: {
    assetPath: '/assets/aistudio/LEVEL_2_OK-base64-datauri_2d69078f.txt',
    volume: 0.32,
    duckedVolume: 0.1,
  },
  3: {
    assetPath: '/assets/aistudio/LEVEL_3_MACHINE-base64-datauri_4575304d.txt',
    volume: 0.32,
    duckedVolume: 0.1,
  },
  4: {
    assetPath: '/assets/aistudio/TRANSISI-base64-datauri_616dae1b.txt',
    volume: 0.32,
    duckedVolume: 0.1,
  },
  5: {
    assetPath: '/assets/aistudio/LEVEL_5_OK-base64-datauri_e8569360.txt',
    volume: 0.32,
    duckedVolume: 0.1,
  },
  6: {
    assetPath: '/assets/aistudio/LEVEL_6_OK-base64-datauri_5edde7c0.txt',
    volume: 0.32,
    duckedVolume: 0.1,
  },
};

interface LevelMusicState {
  audio: HTMLAudioElement | null;
  loadPromise: Promise<HTMLAudioElement | null> | null;
  unlockHandler: (() => void) | null;
}

class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private sfxEnabled = true;
  private persona: NarratorPersona = 'rahma';
  private speechTimers: number[] = [];
  private speakingUntil = 0;
  private speechSessionId = 0;
  private activeNarrationAudio: HTMLAudioElement | null = null;
  private activePcmSources: AudioBufferSourceNode[] = [];
  private narrationAbortController: AbortController | null = null;
  private studioAudioCache = new Map<string, string>();
  private studioPrefetchInFlight = new Set<string>();
  private studioPrefetchPromises = new Map<string, Promise<string | null>>();
  private studioQuotaCooldownUntil = 0;
  private lastSpokenText: string | null = null;
  private voiceStatus: NarrationVoiceStatus = 'idle';
  private statusListeners = new Set<(status: NarrationVoiceStatus) => void>();
  private openingAudio: HTMLAudioElement | null = null;
  private openingLoadPromise: Promise<HTMLAudioElement | null> | null = null;
  private openingShouldPlay = false;
  private openingUnlockHandler: (() => void) | null = null;
  private transitionAudio: HTMLAudioElement | null = null;
  private transitionLoadPromise: Promise<HTMLAudioElement | null> | null = null;
  private transitionShouldPlay = false;
  private transitionUnlockHandler: (() => void) | null = null;
  private prologueAudio: HTMLAudioElement | null = null;
  private prologueLoadPromise: Promise<HTMLAudioElement | null> | null = null;
  private prologueShouldPlay = false;
  private prologueUnlockHandler: (() => void) | null = null;
  private levelMusicStates = new Map<number, LevelMusicState>();
  private activeLevelMusic: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const onUserGesture = () => {
        this.unlockAudio();
      };
      window.addEventListener('pointerdown', onUserGesture, { capture: true, passive: true });
      window.addEventListener('touchstart', onUserGesture, { capture: true, passive: true });
      window.addEventListener('keydown', onUserGesture, { capture: true, passive: true });
    }
  }

  private getOpeningTargetVolume(): number {
    return this.voiceStatus === 'waiting' || this.voiceStatus === 'speaking'
      ? OPENING_MUSIC_DUCKED_VOLUME
      : OPENING_MUSIC_VOLUME;
  }

  private updateOpeningVolume() {
    if (this.openingAudio) {
      this.openingAudio.volume = this.getOpeningTargetVolume();
    }
  }

  private getTransitionTargetVolume(): number {
    return this.voiceStatus === 'waiting' || this.voiceStatus === 'speaking'
      ? TRANSITION_MUSIC_DUCKED_VOLUME
      : TRANSITION_MUSIC_VOLUME;
  }

  private updateTransitionVolume() {
    if (this.transitionAudio) {
      this.transitionAudio.volume = this.getTransitionTargetVolume();
    }
  }

  private getPrologueTargetVolume(): number {
    return this.voiceStatus === 'waiting' || this.voiceStatus === 'speaking'
      ? PROLOGUE_MUSIC_DUCKED_VOLUME
      : PROLOGUE_MUSIC_VOLUME;
  }

  private updatePrologueVolume() {
    if (this.prologueAudio) {
      this.prologueAudio.volume = this.getPrologueTargetVolume();
    }
  }

  private getLevelTargetVolume(level: number): number {
    const cfg = LEVEL_MUSIC_TRACK_CONFIG[level];
    if (!cfg) return 0.32;
    return this.voiceStatus === 'waiting' || this.voiceStatus === 'speaking'
      ? cfg.duckedVolume
      : cfg.volume;
  }

  private updateLevelVolumes() {
    this.levelMusicStates.forEach((state, level) => {
      if (state.audio) {
        state.audio.volume = this.getLevelTargetVolume(level);
      }
    });
  }

  private setVoiceStatus(next: NarrationVoiceStatus) {
    this.voiceStatus = next;
    this.updateOpeningVolume();
    this.updateTransitionVolume();
    this.updatePrologueVolume();
    this.updateLevelVolumes();
    this.statusListeners.forEach((cb) => cb(next));
  }

  public getVoiceStatus(): NarrationVoiceStatus {
    return this.voiceStatus;
  }

  public subscribeVoiceStatus(cb: (status: NarrationVoiceStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.voiceStatus);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  private loadOpeningAudio(): Promise<HTMLAudioElement | null> {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return Promise.resolve(null);
    }
    if (this.openingAudio) {
      return Promise.resolve(this.openingAudio);
    }
    if (!this.openingLoadPromise) {
      this.openingLoadPromise = fetch(OPENING_MUSIC_ASSET_PATH)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch opening music asset (${res.status})`);
          }
          return res.text();
        })
        .then((rawText) => {
          const dataUri = rawText.trim();
          if (!dataUri.startsWith('data:audio/')) {
            throw new Error('Opening music asset is not a valid audio data URI');
          }
          const audio = new Audio(dataUri);
          audio.loop = true;
          audio.preload = 'auto';
          audio.volume = this.getOpeningTargetVolume();
          this.openingAudio = audio;
          return audio;
        })
        .catch(() => {
          this.openingLoadPromise = null;
          return null;
        });
    }
    return this.openingLoadPromise;
  }

  private detachOpeningUnlock() {
    if (typeof window === 'undefined' || !this.openingUnlockHandler) return;
    const handler = this.openingUnlockHandler;
    this.openingUnlockHandler = null;
    window.removeEventListener('pointerdown', handler, true);
    window.removeEventListener('keydown', handler, true);
    window.removeEventListener('touchstart', handler, true);
  }

  private attachOpeningUnlock() {
    if (typeof window === 'undefined' || this.openingUnlockHandler) return;
    const handler = () => {
      this.detachOpeningUnlock();
      if (this.openingShouldPlay && this.sfxEnabled) {
        this.startOpeningMusic();
      }
    };
    this.openingUnlockHandler = handler;
    window.addEventListener('pointerdown', handler, { capture: true, passive: true });
    window.addEventListener('keydown', handler, { capture: true, passive: true });
    window.addEventListener('touchstart', handler, { capture: true, passive: true });
  }

  private tryPlayOpeningAudioElement(audio: HTMLAudioElement) {
    if (!this.openingShouldPlay || !this.sfxEnabled) return;
    audio.volume = this.getOpeningTargetVolume();
    if (!audio.paused) {
      this.detachOpeningUnlock();
      return;
    }
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            this.detachOpeningUnlock();
          })
          .catch(() => {
            if (this.openingShouldPlay && this.sfxEnabled) {
              this.attachOpeningUnlock();
            }
          });
      }
    } catch {
      if (this.openingShouldPlay && this.sfxEnabled) {
        this.attachOpeningUnlock();
      }
    }
  }

  public startOpeningMusic() {
    this.stopPrologueMusic(true);
    this.stopTransitionMusic(true);
    this.stopLevelMusic(true);
    this.openingShouldPlay = true;
    if (!this.sfxEnabled || typeof window === 'undefined') return;
    if (this.openingAudio) {
      this.tryPlayOpeningAudioElement(this.openingAudio);
      return;
    }
    // Pre-attach gesture unlock while async fetch completes, and also attempt autoplay on load
    this.attachOpeningUnlock();
    void this.loadOpeningAudio().then((audio) => {
      if (audio && this.openingShouldPlay && this.sfxEnabled) {
        this.tryPlayOpeningAudioElement(audio);
      }
    });
  }

  public stopOpeningMusic(resetTime = true) {
    this.openingShouldPlay = false;
    this.detachOpeningUnlock();
    if (this.openingAudio) {
      this.openingAudio.pause();
      if (resetTime) {
        try {
          this.openingAudio.currentTime = 0;
        } catch {
          // Ignore seek errors before metadata loads
        }
      }
    }
  }

  private loadTransitionAudio(): Promise<HTMLAudioElement | null> {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return Promise.resolve(null);
    }
    if (this.transitionAudio) {
      return Promise.resolve(this.transitionAudio);
    }
    if (!this.transitionLoadPromise) {
      this.transitionLoadPromise = fetch(TRANSITION_MUSIC_ASSET_PATH)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch transition music asset (${res.status})`);
          }
          return res.text();
        })
        .then((rawText) => {
          const dataUri = rawText.trim();
          if (!dataUri.startsWith('data:audio/')) {
            throw new Error('Transition music asset is not a valid audio data URI');
          }
          const audio = new Audio(dataUri);
          audio.loop = true;
          audio.preload = 'auto';
          audio.volume = this.getTransitionTargetVolume();
          this.transitionAudio = audio;
          return audio;
        })
        .catch(() => {
          this.transitionLoadPromise = null;
          return null;
        });
    }
    return this.transitionLoadPromise;
  }

  private detachTransitionUnlock() {
    if (typeof window === 'undefined' || !this.transitionUnlockHandler) return;
    const handler = this.transitionUnlockHandler;
    this.transitionUnlockHandler = null;
    window.removeEventListener('pointerdown', handler, true);
    window.removeEventListener('keydown', handler, true);
    window.removeEventListener('touchstart', handler, true);
  }

  private attachTransitionUnlock() {
    if (typeof window === 'undefined' || this.transitionUnlockHandler) return;
    const handler = () => {
      this.detachTransitionUnlock();
      if (this.transitionShouldPlay && this.sfxEnabled) {
        this.startTransitionMusic();
      }
    };
    this.transitionUnlockHandler = handler;
    window.addEventListener('pointerdown', handler, { capture: true, passive: true });
    window.addEventListener('keydown', handler, { capture: true, passive: true });
    window.addEventListener('touchstart', handler, { capture: true, passive: true });
  }

  private tryPlayTransitionAudioElement(audio: HTMLAudioElement) {
    if (!this.transitionShouldPlay || !this.sfxEnabled) return;
    audio.volume = this.getTransitionTargetVolume();
    if (!audio.paused) {
      this.detachTransitionUnlock();
      return;
    }
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            this.detachTransitionUnlock();
          })
          .catch(() => {
            if (this.transitionShouldPlay && this.sfxEnabled) {
              this.attachTransitionUnlock();
            }
          });
      }
    } catch {
      if (this.transitionShouldPlay && this.sfxEnabled) {
        this.attachTransitionUnlock();
      }
    }
  }

  public startTransitionMusic() {
    this.stopOpeningMusic(true);
    this.stopPrologueMusic(true);
    this.stopLevelMusic(true);
    this.transitionShouldPlay = true;
    if (!this.sfxEnabled || typeof window === 'undefined') return;
    if (this.transitionAudio) {
      this.tryPlayTransitionAudioElement(this.transitionAudio);
      return;
    }
    this.attachTransitionUnlock();
    void this.loadTransitionAudio().then((audio) => {
      if (audio && this.transitionShouldPlay && this.sfxEnabled) {
        this.tryPlayTransitionAudioElement(audio);
      }
    });
  }

  public stopTransitionMusic(resetTime = true) {
    this.transitionShouldPlay = false;
    this.detachTransitionUnlock();
    if (this.transitionAudio) {
      this.transitionAudio.pause();
      if (resetTime) {
        try {
          this.transitionAudio.currentTime = 0;
        } catch {
          // Ignore seek errors before metadata loads
        }
      }
    }
  }

  private loadPrologueAudio(): Promise<HTMLAudioElement | null> {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return Promise.resolve(null);
    }
    if (this.prologueAudio) {
      return Promise.resolve(this.prologueAudio);
    }
    if (!this.prologueLoadPromise) {
      this.prologueLoadPromise = fetch(PROLOGUE_MUSIC_ASSET_PATH)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch prologue music asset (${res.status})`);
          }
          return res.text();
        })
        .then((rawText) => {
          const dataUri = rawText.trim();
          if (!dataUri.startsWith('data:audio/')) {
            throw new Error('Prologue music asset is not a valid audio data URI');
          }
          const audio = new Audio(dataUri);
          audio.loop = true;
          audio.preload = 'auto';
          audio.volume = this.getPrologueTargetVolume();
          this.prologueAudio = audio;
          return audio;
        })
        .catch(() => {
          this.prologueLoadPromise = null;
          return null;
        });
    }
    return this.prologueLoadPromise;
  }

  public preloadPrologueMusic() {
    if (typeof window === 'undefined') return;
    void this.loadPrologueAudio();
  }

  private detachPrologueUnlock() {
    if (typeof window === 'undefined' || !this.prologueUnlockHandler) return;
    const handler = this.prologueUnlockHandler;
    this.prologueUnlockHandler = null;
    window.removeEventListener('pointerdown', handler, true);
    window.removeEventListener('keydown', handler, true);
    window.removeEventListener('touchstart', handler, true);
  }

  private attachPrologueUnlock() {
    if (typeof window === 'undefined' || this.prologueUnlockHandler) return;
    const handler = () => {
      this.detachPrologueUnlock();
      if (this.prologueShouldPlay && this.sfxEnabled) {
        this.startPrologueMusic();
      }
    };
    this.prologueUnlockHandler = handler;
    window.addEventListener('pointerdown', handler, { capture: true, passive: true });
    window.addEventListener('keydown', handler, { capture: true, passive: true });
    window.addEventListener('touchstart', handler, { capture: true, passive: true });
  }

  private tryPlayPrologueAudioElement(audio: HTMLAudioElement) {
    if (!this.prologueShouldPlay || !this.sfxEnabled) return;
    audio.volume = this.getPrologueTargetVolume();
    if (!audio.paused) {
      this.detachPrologueUnlock();
      return;
    }
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            this.detachPrologueUnlock();
          })
          .catch(() => {
            if (this.prologueShouldPlay && this.sfxEnabled) {
              this.attachPrologueUnlock();
            }
          });
      }
    } catch {
      if (this.prologueShouldPlay && this.sfxEnabled) {
        this.attachPrologueUnlock();
      }
    }
  }

  public startPrologueMusic() {
    this.stopOpeningMusic(true);
    this.stopTransitionMusic(true);
    this.stopLevelMusic(true);
    this.prologueShouldPlay = true;
    if (!this.sfxEnabled || typeof window === 'undefined') return;
    if (this.prologueAudio) {
      this.tryPlayPrologueAudioElement(this.prologueAudio);
      return;
    }
    this.attachPrologueUnlock();
    void this.loadPrologueAudio().then((audio) => {
      if (audio && this.prologueShouldPlay && this.sfxEnabled) {
        this.tryPlayPrologueAudioElement(audio);
      }
    });
  }

  public stopPrologueMusic(resetTime = true) {
    this.prologueShouldPlay = false;
    this.detachPrologueUnlock();
    if (this.prologueAudio) {
      this.prologueAudio.pause();
      if (resetTime) {
        try {
          this.prologueAudio.currentTime = 0;
        } catch {
          // Ignore seek errors before metadata loads
        }
      }
    }
  }

  private getOrCreateLevelMusicState(level: number): LevelMusicState {
    let state = this.levelMusicStates.get(level);
    if (!state) {
      state = { audio: null, loadPromise: null, unlockHandler: null };
      this.levelMusicStates.set(level, state);
    }
    return state;
  }

  private loadLevelAudio(level: number): Promise<HTMLAudioElement | null> {
    const cfg = LEVEL_MUSIC_TRACK_CONFIG[level];
    if (!cfg || typeof window === 'undefined' || typeof Audio === 'undefined') {
      return Promise.resolve(null);
    }
    const state = this.getOrCreateLevelMusicState(level);
    if (state.audio) {
      return Promise.resolve(state.audio);
    }
    if (!state.loadPromise) {
      state.loadPromise = fetch(cfg.assetPath)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch level ${level} music asset (${res.status})`);
          }
          return res.text();
        })
        .then((rawText) => {
          const dataUri = rawText.trim();
          if (!dataUri.startsWith('data:audio/')) {
            throw new Error(`Level ${level} music asset is not a valid audio data URI`);
          }
          const audio = new Audio(dataUri);
          audio.loop = true;
          audio.preload = 'auto';
          audio.volume = this.getLevelTargetVolume(level);
          state.audio = audio;
          return audio;
        })
        .catch(() => {
          state.loadPromise = null;
          return null;
        });
    }
    return state.loadPromise;
  }

  private detachLevelUnlock(level?: number) {
    if (typeof window === 'undefined') return;
    const detachFor = (lv: number) => {
      const state = this.levelMusicStates.get(lv);
      if (!state || !state.unlockHandler) return;
      const handler = state.unlockHandler;
      state.unlockHandler = null;
      window.removeEventListener('pointerdown', handler, true);
      window.removeEventListener('keydown', handler, true);
      window.removeEventListener('touchstart', handler, true);
    };
    if (typeof level === 'number') {
      detachFor(level);
    } else {
      this.levelMusicStates.forEach((_state, lv) => detachFor(lv));
    }
  }

  private attachLevelUnlock(level: number) {
    if (typeof window === 'undefined') return;
    const state = this.getOrCreateLevelMusicState(level);
    if (state.unlockHandler) return;
    const handler = () => {
      this.detachLevelUnlock(level);
      if (this.activeLevelMusic === level && this.sfxEnabled) {
        this.startLevelMusic(level);
      }
    };
    state.unlockHandler = handler;
    window.addEventListener('pointerdown', handler, { capture: true, passive: true });
    window.addEventListener('keydown', handler, { capture: true, passive: true });
    window.addEventListener('touchstart', handler, { capture: true, passive: true });
  }

  private tryPlayLevelAudioElement(level: number, audio: HTMLAudioElement) {
    if (this.activeLevelMusic !== level || !this.sfxEnabled) return;
    audio.volume = this.getLevelTargetVolume(level);
    if (!audio.paused) {
      this.detachLevelUnlock(level);
      return;
    }
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            this.detachLevelUnlock(level);
          })
          .catch(() => {
            if (this.activeLevelMusic === level && this.sfxEnabled) {
              this.attachLevelUnlock(level);
            }
          });
      }
    } catch {
      if (this.activeLevelMusic === level && this.sfxEnabled) {
        this.attachLevelUnlock(level);
      }
    }
  }

  private stopOtherLevelTracks(activeLevel: number | null, resetTime = true) {
    this.levelMusicStates.forEach((state, lv) => {
      if (lv === activeLevel) return;
      this.detachLevelUnlock(lv);
      if (state.audio) {
        state.audio.pause();
        if (resetTime) {
          try {
            state.audio.currentTime = 0;
          } catch {
            // Ignore seek errors before metadata loads
          }
        }
      }
    });
  }

  public startLevelMusic(level: number) {
    if (!LEVEL_MUSIC_TRACK_CONFIG[level]) {
      this.stopLevelMusic(true);
      return;
    }
    this.stopOpeningMusic(true);
    this.stopPrologueMusic(true);
    this.stopTransitionMusic(true);
    this.stopOtherLevelTracks(level, true);
    this.activeLevelMusic = level;
    if (!this.sfxEnabled || typeof window === 'undefined') return;
    const state = this.getOrCreateLevelMusicState(level);
    if (state.audio) {
      this.tryPlayLevelAudioElement(level, state.audio);
      return;
    }
    this.attachLevelUnlock(level);
    void this.loadLevelAudio(level).then((audio) => {
      if (audio && this.activeLevelMusic === level && this.sfxEnabled) {
        this.tryPlayLevelAudioElement(level, audio);
      }
    });
  }

  public stopLevelMusic(resetTime = true) {
    this.activeLevelMusic = null;
    this.stopOtherLevelTracks(null, resetTime);
  }

  public hasLevelMusicTrack(level: number): boolean {
    return Boolean(LEVEL_MUSIC_TRACK_CONFIG[level]);
  }

  public startLevel1Music() {
    this.startLevelMusic(1);
  }

  public stopLevel1Music(resetTime = true) {
    if (this.activeLevelMusic === 1) {
      this.stopLevelMusic(resetTime);
    }
  }

  public startLevel2Music() {
    this.startLevelMusic(2);
  }

  public stopLevel2Music(resetTime = true) {
    if (this.activeLevelMusic === 2) {
      this.stopLevelMusic(resetTime);
    }
  }

  public startLevel3Music() {
    this.startLevelMusic(3);
  }

  public stopLevel3Music(resetTime = true) {
    if (this.activeLevelMusic === 3) {
      this.stopLevelMusic(resetTime);
    }
  }

  public startLevel4Music() {
    this.startLevelMusic(4);
  }

  public stopLevel4Music(resetTime = true) {
    if (this.activeLevelMusic === 4) {
      this.stopLevelMusic(resetTime);
    }
  }

  public startLevel5Music() {
    this.startLevelMusic(5);
  }

  public stopLevel5Music(resetTime = true) {
    if (this.activeLevelMusic === 5) {
      this.stopLevelMusic(resetTime);
    }
  }

  public startLevel6Music() {
    this.startLevelMusic(6);
  }

  public stopLevel6Music(resetTime = true) {
    if (this.activeLevelMusic === 6) {
      this.stopLevelMusic(resetTime);
    }
  }

  private getContext(): AudioContext | null {
    if (!this.sfxEnabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getNarrationAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Unlocks Web AudioContext synchronously inside a user gesture
   * so delayed (0.1s) or async-streamed narrations play reliably on desktop & mobile.
   */
  public unlockAudio() {
    if (typeof window === 'undefined') return;
    void this.loadPrologueAudio();
    void this.loadTransitionAudio();
    const ctx = this.getNarrationAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      try {
        const silentBuf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        // Ignore silent buffer unlock errors
      }
    }
  }

  public setPersona(p: NarratorPersona) {
    const prev = this.persona;
    this.persona = p;
    if (p === 'muted') {
      this.stopSpeech();
      return;
    }
    if (p !== prev && this.isSpeaking() && this.lastSpokenText) {
      this.speak(this.lastSpokenText, 100);
    }
  }

  public getPersona(): NarratorPersona {
    return this.persona;
  }

  public getLastSpokenText(): string | null {
    return this.lastSpokenText;
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (!enabled) {
      if (this.openingAudio && !this.openingAudio.paused) {
        this.openingAudio.pause();
      }
      if (this.prologueAudio && !this.prologueAudio.paused) {
        this.prologueAudio.pause();
      }
      if (this.transitionAudio && !this.transitionAudio.paused) {
        this.transitionAudio.pause();
      }
      this.levelMusicStates.forEach((state) => {
        if (state.audio && !state.audio.paused) {
          state.audio.pause();
        }
      });
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } else {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.openingShouldPlay) {
        this.startOpeningMusic();
      }
      if (this.prologueShouldPlay) {
        this.startPrologueMusic();
      }
      if (this.transitionShouldPlay) {
        this.startTransitionMusic();
      }
      if (this.activeLevelMusic !== null) {
        this.startLevelMusic(this.activeLevelMusic);
      }
    }
  }

  public isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  public stopSpeech() {
    this.speechSessionId += 1;
    this.speechTimers.forEach((id) => window.clearTimeout(id));
    this.speechTimers = [];
    this.speakingUntil = 0;
    if (this.narrationAbortController) {
      try {
        this.narrationAbortController.abort();
      } catch {
        // Ignore abort errors
      }
      this.narrationAbortController = null;
    }
    if (this.activeNarrationAudio) {
      try {
        this.activeNarrationAudio.onended = null;
        this.activeNarrationAudio.onerror = null;
        this.activeNarrationAudio.pause();
        this.activeNarrationAudio.currentTime = 0;
        this.activeNarrationAudio.src = '';
      } catch {
        // Ignore media teardown errors
      }
      this.activeNarrationAudio = null;
    }
    if (this.activePcmSources.length > 0) {
      for (const src of this.activePcmSources) {
        try {
          src.onended = null;
          src.stop();
          src.disconnect();
        } catch {
          // Ignore already-stopped source errors
        }
      }
      this.activePcmSources = [];
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore synthesis cancel errors
      }
    }
    this.setVoiceStatus('idle');
  }

  public isSpeaking(): boolean {
    if (this.persona === 'muted') return false;
    if (this.voiceStatus === 'waiting' || this.voiceStatus === 'speaking') return true;
    if (this.activeNarrationAudio && !this.activeNarrationAudio.paused && !this.activeNarrationAudio.ended) {
      return true;
    }
    if (this.activePcmSources.length > 0) {
      return true;
    }
    return Date.now() < this.speakingUntil;
  }

  public teardownAll() {
    this.stopSpeech();
    this.stopOpeningMusic(true);
    this.stopPrologueMusic(true);
    this.stopTransitionMusic(true);
    this.stopLevelMusic(true);
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  private getStudioCacheKey(persona: 'rahma' | 'ilyas', cleanText: string): string {
    return `v3::${persona}::${cleanText}`;
  }

  private cacheStudioBlob(persona: 'rahma' | 'ilyas', cleanText: string, blob: Blob): string {
    const key = this.getStudioCacheKey(persona, cleanText);
    const existing = this.studioAudioCache.get(key);
    if (existing) return existing;

    const objectUrl = URL.createObjectURL(blob);
    if (this.studioAudioCache.size >= 100) {
      const oldestKey = this.studioAudioCache.keys().next().value;
      if (oldestKey) {
        const oldUrl = this.studioAudioCache.get(oldestKey);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        this.studioAudioCache.delete(oldestKey);
      }
    }
    this.studioAudioCache.set(key, objectUrl);
    return objectUrl;
  }

  private buildWavBlobFromPcmChunks(chunks: Uint8Array[], sampleRate = 24000): Blob {
    let totalLen = 0;
    for (const c of chunks) totalLen += c.length;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + totalLen, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, totalLen, true);
    return new Blob([header, ...(chunks as BlobPart[])], { type: 'audio/wav' });
  }

  private async fetchStudioAudioUrl(
    persona: 'rahma' | 'ilyas',
    cleanText: string,
    signal?: AbortSignal
  ): Promise<string | null> {
    const key = this.getStudioCacheKey(persona, cleanText);
    const cachedUrl = this.studioAudioCache.get(key);
    if (cachedUrl) {
      return cachedUrl;
    }

    if (Date.now() < this.studioQuotaCooldownUntil) {
      return null;
    }

    const existingPromise = this.studioPrefetchPromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = (async () => {
      try {
        const response = await fetch('/api/tts/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText, persona }),
          signal,
        });
        if (response.status === 429 || response.status === 503) {
          this.studioQuotaCooldownUntil = Date.now() + 30_000;
          return null;
        }
        if (!response.ok) {
          return null;
        }
        const data = (await response.json()) as {
          mimeType?: string;
          audioBase64?: string;
        };
        if (!data.audioBase64) {
          return null;
        }

        const byteStr = atob(data.audioBase64);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) {
          bytes[i] = byteStr.charCodeAt(i);
        }
        // Ensure valid 44-byte RIFF WAV header on client side too
        let blob: Blob;
        if (
          bytes.length >= 44 &&
          bytes[0] === 0x52 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x46
        ) {
          blob = new Blob([bytes], { type: 'audio/wav' });
        } else {
          blob = this.buildWavBlobFromPcmChunks([bytes], 24000);
        }
        return this.cacheStudioBlob(persona, cleanText, blob);
      } catch {
        return null;
      }
    })();

    this.studioPrefetchPromises.set(key, promise);
    try {
      return await promise;
    } finally {
      this.studioPrefetchPromises.delete(key);
    }
  }

  /**
   * Background pre-warmer for upcoming Pak Guru Ilyas & Bu Guru Rahma narrations so they play at exact 0.1s with zero wait.
   */
  public prefetch(text: string, personaOverride?: 'rahma' | 'ilyas') {
    const targetPersona =
      personaOverride ?? (this.persona === 'muted' ? null : this.persona);
    if (!targetPersona || typeof window === 'undefined') return;
    if (Date.now() < this.studioQuotaCooldownUntil) return;
    const cleanText = text.replace(/["[\]]/g, '').trim();
    const key = this.getStudioCacheKey(targetPersona, cleanText);
    if (
      !cleanText ||
      this.studioAudioCache.has(key) ||
      this.studioPrefetchInFlight.has(key) ||
      this.studioPrefetchPromises.has(key)
    ) {
      return;
    }
    this.studioPrefetchInFlight.add(key);
    void this.fetchStudioAudioUrl(targetPersona, cleanText).finally(() => {
      this.studioPrefetchInFlight.delete(key);
    });
  }

  /**
   * Plays a studio WAV blob URL via Web AudioContext if HTMLAudioElement playback is blocked or fails.
   * Ensures only the new studio voice is played and never falls back to browser speechSynthesis.
   */
  private async playWavUrlViaAudioContext(
    audioUrl: string,
    activePersona: 'rahma' | 'ilyas',
    session: number
  ): Promise<boolean> {
    if (session !== this.speechSessionId || this.persona !== activePersona) return false;
    const ctx = this.getNarrationAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const res = await fetch(audioUrl);
      const arrayBuf = await res.arrayBuffer();
      if (session !== this.speechSessionId || this.persona !== activePersona) return false;

      let rawBytes = new Uint8Array(arrayBuf);
      if (
        rawBytes.length >= 44 &&
        rawBytes[0] === 0x52 &&
        rawBytes[1] === 0x49 &&
        rawBytes[2] === 0x46 &&
        rawBytes[3] === 0x46
      ) {
        rawBytes = rawBytes.subarray(44);
      }
      const sampleCount = rawBytes.length >> 1;
      if (sampleCount <= 0) return false;

      const floatSamples = new Float32Array(sampleCount);
      const dv = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
      for (let i = 0; i < sampleCount; i++) {
        floatSamples[i] = dv.getInt16(i * 2, true) / 32768;
      }

      const audioBuf = ctx.createBuffer(1, sampleCount, 24000);
      audioBuf.copyToChannel(floatSamples, 0);

      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(ctx.destination);

      this.activePcmSources.push(src);
      this.setVoiceStatus('speaking');
      const durationMs = Math.ceil(audioBuf.duration * 1000);
      this.speakingUntil = Date.now() + durationMs + 300;

      src.onended = () => {
        const idx = this.activePcmSources.indexOf(src);
        if (idx >= 0) this.activePcmSources.splice(idx, 1);
        if (session === this.speechSessionId && this.activePcmSources.length === 0) {
          this.speakingUntil = 0;
          this.setVoiceStatus('idle');
        }
      };

      src.start(0);
      const safetyTimer = window.setTimeout(() => {
        if (session === this.speechSessionId) {
          this.activePcmSources = [];
          this.speakingUntil = 0;
          this.setVoiceStatus('idle');
        }
      }, durationMs + 600);
      this.speechTimers.push(safetyTimer);
      return true;
    } catch {
      return false;
    }
  }

  private async playCachedWavUrl(
    audioUrl: string,
    _cleanText: string,
    activePersona: 'rahma' | 'ilyas',
    session: number,
    totalWords: number
  ) {
    if (session !== this.speechSessionId || this.persona !== activePersona) return;
    if (typeof Audio === 'undefined') {
      const played = await this.playWavUrlViaAudioContext(audioUrl, activePersona, session);
      if (!played && session === this.speechSessionId) {
        this.setVoiceStatus('idle');
      }
      return;
    }

    const audio = new Audio(audioUrl);
    this.activeNarrationAudio = audio;
    audio.volume = 1.0;

    let finished = false;
    const finishPlayback = () => {
      if (finished || session !== this.speechSessionId) return;
      finished = true;
      if (this.activeNarrationAudio === audio) {
        this.activeNarrationAudio = null;
      }
      this.speakingUntil = 0;
      this.setVoiceStatus('idle');
    };

    audio.onended = finishPlayback;
    audio.onerror = () => {
      if (finished || session !== this.speechSessionId) return;
      finished = true;
      if (this.activeNarrationAudio === audio) {
        this.activeNarrationAudio = null;
      }
      void this.playWavUrlViaAudioContext(audioUrl, activePersona, session).then((ok) => {
        if (!ok && session === this.speechSessionId) {
          this.speakingUntil = 0;
          this.setVoiceStatus('idle');
        }
      });
    };

    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.speakingUntil = Date.now() + Math.ceil(audio.duration * 1000) + 500;
        const safetyEndTimer = window.setTimeout(
          finishPlayback,
          Math.ceil(audio.duration * 1000) + 2500
        );
        this.speechTimers.push(safetyEndTimer);
      }
    };

    const fallbackSafetyTimer = window.setTimeout(
      finishPlayback,
      Math.max(8000, totalWords * 750 + 4000)
    );
    this.speechTimers.push(fallbackSafetyTimer);

    this.setVoiceStatus('speaking');
    try {
      await audio.play();
    } catch {
      if (session === this.speechSessionId && !finished) {
        finished = true;
        if (this.activeNarrationAudio === audio) {
          this.activeNarrationAudio = null;
        }
        const ok = await this.playWavUrlViaAudioContext(audioUrl, activePersona, session);
        if (!ok && session === this.speechSessionId) {
          this.speakingUntil = 0;
          this.setVoiceStatus('idle');
        }
      }
    }
  }

  private async streamAndPlayStudioSpeech(
    cleanText: string,
    activePersona: 'rahma' | 'ilyas',
    delayMs: number,
    startedAtMs: number,
    session: number,
    totalWords: number,
    abortController: AbortController
  ) {
    const signal = abortController.signal;
    const cacheKey = this.getStudioCacheKey(activePersona, cleanText);
    const finishIdle = () => {
      if (session === this.speechSessionId) {
        this.speakingUntil = 0;
        this.setVoiceStatus('idle');
      }
    };

    if (Date.now() < this.studioQuotaCooldownUntil) {
      finishIdle();
      return;
    }

    // If a background prefetch for this exact text is already in flight, await it up to 25s
    const inFlightPrefetch = this.studioPrefetchPromises.get(cacheKey);
    if (inFlightPrefetch) {
      const prefetchedUrl = await Promise.race<string | null>([
        inFlightPrefetch,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 25000)),
      ]);
      if (session !== this.speechSessionId || this.persona !== activePersona || signal.aborted) return;
      if (prefetchedUrl) {
        const remainingWait = Math.max(0, startedAtMs + delayMs - performance.now());
        const t = window.setTimeout(() => {
          void this.playCachedWavUrl(prefetchedUrl, cleanText, activePersona, session, totalWords);
        }, remainingWait);
        this.speechTimers.push(t);
        return;
      }
    }

    let firstChunkReceived = false;
    const ttfbTimeoutId = window.setTimeout(() => {
      if (!firstChunkReceived && !signal.aborted) {
        abortController.abort();
        finishIdle();
      }
    }, 25000);
    this.speechTimers.push(ttfbTimeoutId);

    try {
      const response = await fetch('/api/tts/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, persona: activePersona }),
        signal,
      });

      if (session !== this.speechSessionId || this.persona !== activePersona) {
        window.clearTimeout(ttfbTimeoutId);
        return;
      }

      if (response.status === 429 || response.status === 503) {
        this.studioQuotaCooldownUntil = Date.now() + 30_000;
      }

      if (!response.ok) {
        window.clearTimeout(ttfbTimeoutId);
        finishIdle();
        return;
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        window.clearTimeout(ttfbTimeoutId);
        finishIdle();
        return;
      }
      if (contentType.includes('audio/wav')) {
        firstChunkReceived = true;
        window.clearTimeout(ttfbTimeoutId);
        const blob = await response.blob();
        if (session !== this.speechSessionId || this.persona !== activePersona) return;
        const cachedUrl = this.cacheStudioBlob(activePersona, cleanText, blob);
        const remainingWait = Math.max(0, startedAtMs + delayMs - performance.now());
        const t = window.setTimeout(() => {
          void this.playCachedWavUrl(cachedUrl, cleanText, activePersona, session, totalWords);
        }, remainingWait);
        this.speechTimers.push(t);
        return;
      }

      const reader = response.body?.getReader();
      const ctx = this.getNarrationAudioContext();
      if (!reader || !ctx) {
        window.clearTimeout(ttfbTimeoutId);
        finishIdle();
        return;
      }

      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // Ignore resume failure; state checked below
        }
        if (session !== this.speechSessionId || this.persona !== activePersona) {
          window.clearTimeout(ttfbTimeoutId);
          return;
        }
        if ((ctx.state as string) !== 'running') {
          window.clearTimeout(ttfbTimeoutId);
          try {
            await reader.cancel();
          } catch {
            // Ignore cancel errors
          }
          finishIdle();
          return;
        }
      }

      let leftoverByte: number | null = null;
      let isFirstPcm = true;
      let nextPlayTime = 0;
      let totalSamples = 0;
      const collectedPcmParts: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (session !== this.speechSessionId || this.persona !== activePersona) {
          window.clearTimeout(ttfbTimeoutId);
          try {
            await reader.cancel();
          } catch {
            // Ignore cancel errors
          }
          return;
        }
        if (done) break;
        if (!value || value.length === 0) continue;

        if (!firstChunkReceived) {
          firstChunkReceived = true;
          window.clearTimeout(ttfbTimeoutId);
        }

        let rawChunk: Uint8Array = value;
        if (leftoverByte !== null) {
          const merged = new Uint8Array(1 + rawChunk.length);
          merged[0] = leftoverByte;
          merged.set(rawChunk, 1);
          rawChunk = merged;
          leftoverByte = null;
        }

        if (isFirstPcm && rawChunk.length >= 44) {
          if (
            rawChunk[0] === 0x52 &&
            rawChunk[1] === 0x49 &&
            rawChunk[2] === 0x46 &&
            rawChunk[3] === 0x46
          ) {
            rawChunk = rawChunk.subarray(44);
          }
        }

        if (rawChunk.length === 0) continue;
        if (rawChunk.length % 2 === 1) {
          leftoverByte = rawChunk[rawChunk.length - 1];
          rawChunk = rawChunk.subarray(0, rawChunk.length - 1);
        }
        if (rawChunk.length < 2) continue;

        const alignedChunk = new Uint8Array(rawChunk);
        collectedPcmParts.push(alignedChunk);

        const sampleCount = alignedChunk.length >> 1;
        const floatSamples = new Float32Array(sampleCount);
        const dv = new DataView(alignedChunk.buffer, alignedChunk.byteOffset, alignedChunk.byteLength);
        for (let i = 0; i < sampleCount; i++) {
          floatSamples[i] = dv.getInt16(i * 2, true) / 32768;
        }

        const audioBuf = ctx.createBuffer(1, sampleCount, 24000);
        audioBuf.copyToChannel(floatSamples, 0);

        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(ctx.destination);

        if (isFirstPcm) {
          isFirstPcm = false;
          const remainingDelaySec = Math.max(0.02, (startedAtMs + delayMs - performance.now()) / 1000);
          nextPlayTime = ctx.currentTime + remainingDelaySec;
          const statusDelayMs = Math.max(0, Math.round(remainingDelaySec * 1000));
          const speakTimer = window.setTimeout(() => {
            if (session === this.speechSessionId && this.persona === activePersona) {
              this.setVoiceStatus('speaking');
            }
          }, statusDelayMs);
          this.speechTimers.push(speakTimer);
        } else if (nextPlayTime < ctx.currentTime + 0.01) {
          nextPlayTime = ctx.currentTime + 0.01;
        }

        this.activePcmSources.push(src);
        src.onended = () => {
          const idx = this.activePcmSources.indexOf(src);
          if (idx >= 0) this.activePcmSources.splice(idx, 1);
        };

        src.start(nextPlayTime);
        nextPlayTime += audioBuf.duration;
        totalSamples += sampleCount;

        const remainingPlayMs = Math.max(500, Math.ceil((nextPlayTime - ctx.currentTime) * 1000) + 300);
        this.speakingUntil = Date.now() + remainingPlayMs;
      }

      window.clearTimeout(ttfbTimeoutId);

      if (totalSamples === 0) {
        finishIdle();
        return;
      }

      if (collectedPcmParts.length > 0) {
        const wavBlob = this.buildWavBlobFromPcmChunks(collectedPcmParts, 24000);
        this.cacheStudioBlob(activePersona, cleanText, wavBlob);
      }

      const endDelayMs = Math.max(80, Math.ceil((nextPlayTime - ctx.currentTime) * 1000) + 120);
      const endTimer = window.setTimeout(() => {
        if (session === this.speechSessionId) {
          this.activePcmSources = [];
          this.speakingUntil = 0;
          this.setVoiceStatus('idle');
        }
      }, endDelayMs);
      this.speechTimers.push(endTimer);
    } catch {
      window.clearTimeout(ttfbTimeoutId);
      if (session === this.speechSessionId && this.persona === activePersona && !signal.aborted) {
        finishIdle();
      }
    }
  }

  /**
   * Speaks narration text ONLY AFTER the text has appeared on screen first
   * ("TULISAN MUNCUL 0,1 DETIK, DISUSUL SUARA NARATOR MEMBACA").
   * Exclusively plays the new studio voices for Pak Guru Ilyas and Bu Guru Rahma.
   */
  public speak(text: string, initialDelayMs = 100) {
    this.stopSpeech();
    if (this.persona === 'muted' || typeof window === 'undefined') return;

    const cleanText = text.replace(/["[\]]/g, '').trim();
    if (!cleanText) return;
    this.lastSpokenText = cleanText;

    const session = this.speechSessionId;
    const activePersona = this.persona;
    const delayMs = Math.max(50, initialDelayMs);

    // Phase 1: Tulisan muncul dulu 0,1 detik, status menunggu suara narator menyusul
    this.setVoiceStatus('waiting');
    const totalWords = cleanText.split(/\s+/).length;
    this.speakingUntil = Date.now() + delayMs + Math.min(22000, totalWords * 500 + 3000);

    const cacheKey = this.getStudioCacheKey(activePersona, cleanText);
    const cachedUrl = this.studioAudioCache.get(cacheKey);
    if (cachedUrl) {
      const startTimer = window.setTimeout(() => {
        void this.playCachedWavUrl(cachedUrl, cleanText, activePersona, session, totalWords);
      }, delayMs);
      this.speechTimers.push(startTimer);
      return;
    }

    if (Date.now() < this.studioQuotaCooldownUntil) {
      this.speakingUntil = 0;
      this.setVoiceStatus('idle');
      return;
    }

    const abortController = new AbortController();
    this.narrationAbortController = abortController;
    const startedAtMs = performance.now();
    void this.streamAndPlayStudioSpeech(
      cleanText,
      activePersona,
      delayMs,
      startedAtMs,
      session,
      totalWords,
      abortController
    );
  }

  // --- SECTION VII: WEB AUDIO API SYNTHESIZER ---

  /** Langkah Kaki (Rumput/Tanah - L1 & L5): Band-pass filtered noise (400-800 Hz, -18 dB, 0.04s) */
  public playFootstepGrass() {
    const ctx = this.getContext();
    if (!ctx) return;
    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.value = 0.12; // ~ -18 dB

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  /** Langkah Kaki (Trotoar/Aspal - L4 & Lobby): Triangle/sine 160 Hz -> 80 Hz, 0.04s */
  public playFootstepAsphalt() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.04);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  /** Lompat (Jump): Sine sweep 180 Hz -> 420 Hz, 0.15s */
  public playJump() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.15);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Mendarat (Land): Low-sine 90 Hz, decay 0.08s */
  public playLand() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /** Daun Toleransi Gugur: Descending triangle wave 440 Hz -> 180 Hz, 0.3s */
  public playLeafLost() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.3);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  /** Tabung Dual-Gauge Naik: Arpeggio lonceng cerah C5-E5-G5, 0.2s */
  public playGaugeUp() {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    });
  }

  /** Navigasi Klik: Ketukan pop kayu taktil (600 Hz, 0.05s) */
  public playClickWood() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.05);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  /** Tombol Fullscreen Profesional: Dual sine chime 700 Hz & 950 Hz, 0.04s */
  public playClickFullscreen() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [700, 950].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.02);
      gain.gain.setValueAtTime(0.16, now + i * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.02 + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.02);
      osc.stop(now + i * 0.02 + 0.045);
    });
  }

  /** Tuts Mesin Tik: White noise tap with high-pass filter, 0.02s */
  public playTypewriterTick() {
    const ctx = this.getContext();
    if (!ctx) return;
    const bufferSize = Math.floor(ctx.sampleRate * 0.018);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  /** Sampah Masuk Tong Organik/Anorganik: Soft hollow thud sine 180 Hz, decay 0.1s */
  public playBinThud() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.1);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /** Benda Logam/B3 Masuk Tong: Metallic clink-clank square wave 780 Hz & 1240 Hz, 0.15s */
  public playBinMetallicB3() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [780, 1240].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.12, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.1);
    });
  }

  /** Balok Huruf Terpasang (Level 2): Woodblock hit 450-540 Hz, 0.06s */
  public playWoodTileSnap() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [450, 540].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.025);
      gain.gain.setValueAtTime(0.22, now + idx * 0.025);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.025 + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.025);
      osc.stop(now + idx * 0.025 + 0.06);
    });
  }

  /** Mesin Capit 3R (Level 3): Motor 90 Hz & Cakar Jepit 1200 Hz */
  public playClawAction(type: 'motor' | 'lock') {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (type === 'motor') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  }

  /** Konfirmasi Pilih Bahan/Item Benar: Chime naik E5->A5 yang ringan & jelas */
  public playSelectionConfirm() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [659.25, 880.0].forEach((freq, idx) => {
      const t = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.008, t + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  /** Aksi Benar / Jawaban Tepat: Arpeggio mayor cerah C5-E5-G5-C6 + kilau harmonik */
  public playSuccessChord() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(idx === notes.length - 1 ? 0.22 : 0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.008, t + (idx === notes.length - 1 ? 0.34 : 0.22));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  /** Pengingat Lembut Saat Jawaban Belum Pas: Nada segitiga hangat E4 -> C4 yang menuntun tanpa menyalahkan */
  public playErrorBuzz() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const steps = [
      { freq: 329.63, delay: 0, dur: 0.13 },
      { freq: 261.63, delay: 0.12, dur: 0.22 },
    ];
    steps.forEach(({ freq, delay, dur }) => {
      const t = now + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.008, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  }

  /** Bencana & Krisis (Intro L5): Rumble low-pass noise 60 Hz, 0.3s */
  public playEarthTremor() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.3);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  /** Gemuruh Bumi Mendalam (Pembukaan Peta Retak Level 6): Sub-bass rumble + filtered seismic noise, 1.8s */
  public playEarthRumbleLong() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep sub-bass quake oscillator
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(64, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 1.65);

    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.setValueAtTime(140, now);

    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.linearRampToValueAtTime(0.28, now + 0.18);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.75);

    subOsc.connect(lowFilter);
    lowFilter.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.8);

    // Crackle seismic earth fissure noise
    const durSec = 1.4;
    const bufferSize = Math.floor(ctx.sampleRate * durSec);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandFilter = ctx.createBiquadFilter();
    bandFilter.type = 'lowpass';
    bandFilter.frequency.setValueAtTime(220, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.18, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + durSec);

    noise.connect(bandFilter);
    bandFilter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
  }

  /** Semua 5 Menara Radar Terhubung Cahaya ke Tengah (Level 6) */
  public playTowerNetworkComplete() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [392.0, 493.88, 587.33, 783.99, 987.77];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.006, t + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.8);
    });
  }

  /** Pemulihan Alam (Level 5 & 6): Filtered chirp + resonant victory gong */
  public playNatureHealed() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Resonant gong chord
    [261.63, 392.0, 523.25, 659.25].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.95);
    });
    // Bird chirp
    const chirp = ctx.createOscillator();
    const cGain = ctx.createGain();
    chirp.type = 'sine';
    chirp.frequency.setValueAtTime(1400, now + 0.15);
    chirp.frequency.exponentialRampToValueAtTime(2200, now + 0.28);
    cGain.gain.setValueAtTime(0.1, now + 0.15);
    cGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    chirp.connect(cGain);
    cGain.connect(ctx.destination);
    chirp.start(now + 0.15);
    chirp.stop(now + 0.32);
  }

  /** Piagam Ikrar Autentik (Halaman 4): Crystal glass chime 1800 Hz */
  public playCrystalSeal() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }
}

export const audioEngine = new ProceduralAudioEngine();
