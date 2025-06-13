import { Track, Album, PlaybackState } from '../types/music';

export class AudioPlayerService {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private nextAudio: HTMLAudioElement | null = null;
  private currentTrackIndex: number = 0;
  private currentAlbum: Album | null = null;
  private playbackState: PlaybackState = {
    isPlaying: false,
    currentTrack: null,
    currentAlbum: null,
    position: 0,
    duration: 0
  };
  private listeners: ((state: PlaybackState) => void)[] = [];

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  }

  addStateListener(listener: (state: PlaybackState) => void) {
    this.listeners.push(listener);
    // Immediately notify with current state
    listener(this.playbackState);
  }

  removeStateListener(listener: (state: PlaybackState) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyStateChange() {
    this.listeners.forEach(listener => listener({ ...this.playbackState }));
  }

  private updatePlaybackState(updates: Partial<PlaybackState>) {
    this.playbackState = { ...this.playbackState, ...updates };
    this.notifyStateChange();
  }

  async playAlbum(album: Album, startTrackIndex: number = 0) {
    if (album.tracks.length === 0) return;

    this.currentAlbum = album;
    this.currentTrackIndex = startTrackIndex;

    this.updatePlaybackState({
      currentAlbum: album,
      currentTrack: album.tracks[startTrackIndex]
    });

    await this.playCurrentTrack();
  }

  private async playCurrentTrack() {
    if (!this.currentAlbum || this.currentTrackIndex >= this.currentAlbum.tracks.length) {
      return;
    }

    const track = this.currentAlbum.tracks[this.currentTrackIndex];
    
    // Stop current audio if playing
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
    }

    // Create new audio element
    this.currentAudio = new Audio();
    this.currentAudio.src = URL.createObjectURL(track.file);
    
    // Set up event listeners
    this.setupAudioEventListeners(this.currentAudio, track);

    // Preload next track for gapless playback
    this.preloadNextTrack();

    try {
      await this.currentAudio.play();
      this.updatePlaybackState({
        isPlaying: true,
        currentTrack: track,
        duration: track.duration
      });
    } catch (error) {
      console.error('Error playing track:', error);
      this.updatePlaybackState({ isPlaying: false });
    }
  }

  private setupAudioEventListeners(audio: HTMLAudioElement, track: Track) {
    audio.addEventListener('loadedmetadata', () => {
      this.updatePlaybackState({ duration: audio.duration });
    });

    audio.addEventListener('timeupdate', () => {
      this.updatePlaybackState({ position: audio.currentTime });
    });

    audio.addEventListener('ended', () => {
      this.handleTrackEnd();
    });

    audio.addEventListener('error', (error) => {
      console.error('Audio playback error:', error);
      this.updatePlaybackState({ isPlaying: false });
    });
  }

  private preloadNextTrack() {
    if (!this.currentAlbum || this.currentTrackIndex >= this.currentAlbum.tracks.length - 1) {
      return;
    }

    const nextTrack = this.currentAlbum.tracks[this.currentTrackIndex + 1];
    
    if (this.nextAudio) {
      this.nextAudio.src = '';
    }

    this.nextAudio = new Audio();
    this.nextAudio.src = URL.createObjectURL(nextTrack.file);
    this.nextAudio.preload = 'auto';
  }

  private handleTrackEnd() {
    if (!this.currentAlbum) return;

    // Move to next track
    this.currentTrackIndex++;
    
    if (this.currentTrackIndex < this.currentAlbum.tracks.length) {
      // Use preloaded next track for gapless playback
      if (this.nextAudio) {
        this.currentAudio = this.nextAudio;
        this.nextAudio = null;
        
        const nextTrack = this.currentAlbum.tracks[this.currentTrackIndex];
        this.setupAudioEventListeners(this.currentAudio, nextTrack);
        
        this.currentAudio.play().then(() => {
          this.updatePlaybackState({
            currentTrack: nextTrack,
            duration: nextTrack.duration
          });
          this.preloadNextTrack();
        }).catch(error => {
          console.error('Error playing next track:', error);
        });
      } else {
        // Fallback to regular track loading
        this.playCurrentTrack();
      }
    } else {
      // Album finished
      this.updatePlaybackState({
        isPlaying: false,
        position: 0
      });
    }
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.updatePlaybackState({ isPlaying: false });
    }
  }

  resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().then(() => {
        this.updatePlaybackState({ isPlaying: true });
      }).catch(error => {
        console.error('Error resuming playback:', error);
      });
    }
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.src = '';
    }
    
    if (this.nextAudio) {
      this.nextAudio.src = '';
    }

    this.updatePlaybackState({
      isPlaying: false,
      currentTrack: null,
      currentAlbum: null,
      position: 0,
      duration: 0
    });

    this.currentAlbum = null;
    this.currentTrackIndex = 0;
  }

  getCurrentState(): PlaybackState {
    return { ...this.playbackState };
  }

  // Deliberately no seek or skip methods to maintain vinyl experience
}

export const audioPlayerService = new AudioPlayerService();