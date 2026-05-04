import type Phaser from 'phaser';
import { ASSET_KEYS } from '@/config';
import type { AudioSettings } from '@/state/PersistentState';

type MusicTrack = 'menu' | 'town' | 'dungeon';

const MUSIC_KEYS: Record<MusicTrack, string> = {
  menu: ASSET_KEYS.audio.musicMenu,
  town: ASSET_KEYS.audio.musicTown,
  dungeon: ASSET_KEYS.audio.musicDungeon,
};

/**
 * Centralised music + SFX manager. Volume is computed per-bus:
 *   final = master * (music | sfx)
 * Settings are applied live; updating them reflects immediately.
 */
export class AudioManager {
  private music?: Phaser.Sound.BaseSound;
  private currentTrack: MusicTrack | null = null;

  constructor(
    private readonly sound: Phaser.Sound.BaseSoundManager,
    private settings: AudioSettings,
  ) {}

  applySettings(settings: AudioSettings): void {
    this.settings = settings;
    this.refreshMusicVolume();
  }

  playMusic(track: MusicTrack): void {
    if (this.currentTrack === track && this.music?.isPlaying) return;
    this.stopMusic();
    this.currentTrack = track;
    const key = MUSIC_KEYS[track];
    if (!this.sound.get(key)) {
      // Asset failed to load — silent stub. Fall back to no music.
      return;
    }
    this.music = this.sound.add(key, { loop: true, volume: this.musicVolume() });
    try {
      this.music.play();
    } catch {
      // WAV stubs may fail to play in some browsers; ignore.
    }
  }

  stopMusic(): void {
    if (this.music) {
      this.music.stop();
      this.music.destroy();
      this.music = undefined;
      this.currentTrack = null;
    }
  }

  playSfx(key: string): void {
    if (!this.sound.get(key)) {
      // Asset not loaded — try to add ad hoc.
    }
    try {
      this.sound.play(key, { volume: this.sfxVolume() });
    } catch {
      // ignore failures from silent stubs
    }
  }

  private refreshMusicVolume(): void {
    if (this.music && 'setVolume' in this.music) {
      (this.music as Phaser.Sound.WebAudioSound).setVolume(this.musicVolume());
    }
  }

  private musicVolume(): number {
    return this.settings.master * this.settings.music;
  }

  private sfxVolume(): number {
    return this.settings.master * this.settings.sfx;
  }
}
