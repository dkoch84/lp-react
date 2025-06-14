import { AudioPlayerService } from '../AudioPlayerService';
import { Album, Track } from '../../types/music';

// Mock the MusicLibraryService
jest.mock('../MusicLibraryService', () => ({
  musicLibraryService: {
    getAudioUrl: (track: any) => `http://localhost:3001/audio/${track.relativePath}`
  }
}));

/**
 * COMPREHENSIVE GAPLESS PLAYBACK DIAGNOSTIC TEST
 * 
 * This test creates a detailed timeline of preloading events to help diagnose
 * why gapless playback may not be working in the browser environment.
 * 
 * Expected behavior for gapless playback:
 * 1. Track 1 begins playing immediately
 * 2. Track 2 preloading starts within ~20ms of Track 1 starting
 * 3. Track 2 should begin buffering while Track 1 is playing
 * 4. When Track 1 ends, Track 2 should be ready for immediate playback
 */

// Enhanced MockAudio that more closely simulates real browser behavior
class DiagnosticMockAudio {
  src = '';
  preload = '';
  paused = true;
  currentTime = 0;
  duration = 0;
  error: any = null;
  readyState = 0; // Start as HAVE_NOTHING
  buffered = {
    length: 0,
    start: () => 0,
    end: () => 0
  };
  
  private listeners: { [key: string]: EventListener[] } = {};
  private loadingStarted = false;
  private bufferingProgress = 0;
  private trackName = '';
  
  constructor() {
    this.setupRealisticLoading();
  }
  
  private setupRealisticLoading() {
    // Watch for src changes and simulate realistic loading behavior
    let lastSrc = '';
    const checkSrc = () => {
      if (this.src !== lastSrc && this.src) {
        lastSrc = this.src;
        this.trackName = this.src.includes('track1') ? 'Track1' : 
                        this.src.includes('track2') ? 'Track2' : 
                        this.src.includes('track3') ? 'Track3' : 'Unknown';
        
        console.log(`[DIAGNOSTIC] ${this.trackName}: Source set to ${this.src}`);
        
        // Don't automatically start loading - wait for explicit load() call or play()
        this.readyState = 1; // HAVE_METADATA (simulated)
        
        // Simulate metadata loading after a brief delay
        setTimeout(() => {
          if (this.src === lastSrc) {
            this.duration = 180; // 3 minutes
            this.dispatchEvent('loadedmetadata');
            console.log(`[DIAGNOSTIC] ${this.trackName}: Metadata loaded (duration: ${this.duration}s)`);
          }
        }, 5);
      }
    };
    
    // Check periodically for src changes
    setInterval(checkSrc, 1);
  }
  
  addEventListener(event: string, listener: EventListener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }
  
  removeEventListener(event: string, listener: EventListener) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(listener);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }
  
  dispatchEvent(event: string) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => {
        try {
          listener(new Event(event));
        } catch (error) {
          // Ignore errors in tests
        }
      });
    }
  }
  
  async play() {
    if (!this.src) {
      console.log(`[DIAGNOSTIC] ${this.trackName}: Play failed - no source`);
      return Promise.reject(new Error('No source'));
    }
    
    console.log(`[DIAGNOSTIC] ${this.trackName}: Play() called`);
    
    // If not already loading, start the buffering process
    if (!this.loadingStarted) {
      this.startBuffering();
    }
    
    // Wait for enough buffering to allow playback
    if (this.readyState < 3) {
      console.log(`[DIAGNOSTIC] ${this.trackName}: Waiting for buffering before playback can start`);
      return new Promise((resolve, reject) => {
        const checkReady = () => {
          if (this.readyState >= 3) {
            this.paused = false;
            console.log(`[DIAGNOSTIC] ${this.trackName}: Playback started successfully`);
            resolve(undefined);
          } else {
            setTimeout(checkReady, 10);
          }
        };
        checkReady();
      });
    } else {
      this.paused = false;
      console.log(`[DIAGNOSTIC] ${this.trackName}: Playback started immediately (already buffered)`);
      return Promise.resolve();
    }
  }
  
  pause() {
    this.paused = true;
    console.log(`[DIAGNOSTIC] ${this.trackName}: Paused`);
  }
  
  load() {
    console.log(`[DIAGNOSTIC] ${this.trackName}: load() explicitly called`);
    if (this.src && !this.loadingStarted) {
      this.startBuffering();
    }
  }
  
  private startBuffering() {
    if (this.loadingStarted) return;
    
    this.loadingStarted = true;
    this.bufferingProgress = 0;
    console.log(`[DIAGNOSTIC] ${this.trackName}: Starting buffering process`);
    
    // Dispatch loadstart
    setTimeout(() => {
      this.dispatchEvent('loadstart');
      console.log(`[DIAGNOSTIC] ${this.trackName}: Load started`);
      
      // Simulate progressive buffering
      this.simulateBuffering();
    }, 10);
  }
  
  private simulateBuffering() {
    const bufferStep = () => {
      this.bufferingProgress += 25;
      
      // Update buffered ranges
      const bufferedEnd = (this.bufferingProgress / 100) * this.duration;
      this.buffered = {
        length: 1,
        start: () => 0,
        end: () => bufferedEnd
      };
      
      console.log(`[DIAGNOSTIC] ${this.trackName}: Buffering ${this.bufferingProgress}% (${bufferedEnd.toFixed(1)}s of ${this.duration}s)`);
      
      // Update ready state based on buffering progress
      if (this.bufferingProgress >= 25) {
        this.readyState = Math.max(this.readyState, 2); // HAVE_CURRENT_DATA
      }
      if (this.bufferingProgress >= 50) {
        this.readyState = Math.max(this.readyState, 3); // HAVE_FUTURE_DATA
        this.dispatchEvent('canplay');
        console.log(`[DIAGNOSTIC] ${this.trackName}: Can play (ready state: ${this.readyState})`);
      }
      if (this.bufferingProgress >= 100) {
        this.readyState = 4; // HAVE_ENOUGH_DATA
        this.dispatchEvent('canplaythrough');
        console.log(`[DIAGNOSTIC] ${this.trackName}: Fully buffered (ready state: ${this.readyState})`);
      } else {
        // Continue buffering
        setTimeout(bufferStep, 50); // Slower buffering to simulate real conditions
      }
      
      // Dispatch progress events
      this.dispatchEvent('progress');
    };
    
    setTimeout(bufferStep, 20);
  }
  
  // Test helper methods
  simulateEnd() {
    console.log(`[DIAGNOSTIC] ${this.trackName}: Simulating track end`);
    this.currentTime = this.duration;
    this.dispatchEvent('ended');
  }
}

// Replace global Audio with our diagnostic mock
(global as any).Audio = DiagnosticMockAudio;
(global as any).AudioContext = class MockAudioContext {};
(global as any).webkitAudioContext = class MockWebkitAudioContext {};

describe('Gapless Playback Diagnostics', () => {
  let audioPlayerService: AudioPlayerService;
  let mockAlbum: Album;
  let mockTracks: Track[];
  
  beforeEach(() => {
    audioPlayerService = new AudioPlayerService();
    
    mockTracks = [
      {
        id: 'track1',
        title: 'Track 1',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 180,
        filePath: '/path/to/track1.mp3',
        relativePath: 'track1.mp3',
        trackNumber: 1
      },
      {
        id: 'track2', 
        title: 'Track 2',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 200,
        filePath: '/path/to/track2.mp3',
        relativePath: 'track2.mp3',
        trackNumber: 2
      },
      {
        id: 'track3',
        title: 'Track 3', 
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 160,
        filePath: '/path/to/track3.mp3',
        relativePath: 'track3.mp3',
        trackNumber: 3
      }
    ];
    
    mockAlbum = {
      id: 'album1',
      title: 'Test Album',
      artist: 'Test Artist',
      tracks: mockTracks,
      year: 2023
    };
  });

  it('should demonstrate gapless playback timing in realistic conditions', async () => {
    console.log('\n🎵 === GAPLESS PLAYBACK DIAGNOSTIC TEST ===');
    console.log('This test simulates realistic browser buffering behavior');
    console.log('Expected: Track 2 should start buffering while Track 1 is playing\n');
    
    const timeline: { timestamp: number; event: string }[] = [];
    const startTime = Date.now();
    
    const logEvent = (event: string) => {
      const timestamp = Date.now() - startTime;
      timeline.push({ timestamp, event });
      console.log(`[${timestamp.toString().padStart(4, '0')}ms] ${event}`);
    };
    
    logEvent('🎬 Starting album playback test');
    
    // Start album playback
    await audioPlayerService.playAlbum(mockAlbum, 0);
    logEvent('📀 Album.playAlbum() completed');
    
    // Wait for Track 1 to start playing and Track 2 to start preloading
    await new Promise(resolve => setTimeout(resolve, 150));
    logEvent('⏱️  Waited 150ms for initial buffering');
    
    // Check current state
    const state = audioPlayerService.getCurrentState();
    console.log(`\n📊 Current playback state:`);
    console.log(`   - Playing: ${state.isPlaying}`);
    console.log(`   - Current track: ${state.currentTrack?.title}`);
    console.log(`   - Duration: ${state.duration}s`);
    
    // Access private properties for diagnostic purposes
    const currentAudio = (audioPlayerService as any).currentAudio as DiagnosticMockAudio;
    const nextAudio = (audioPlayerService as any).nextAudio as DiagnosticMockAudio;
    
    if (currentAudio) {
      console.log(`\n🎵 Track 1 status:`);
      console.log(`   - Ready state: ${currentAudio.readyState} (4=fully buffered)`);
      console.log(`   - Playing: ${!currentAudio.paused}`);
      console.log(`   - Buffered: ${currentAudio.buffered.length > 0 ? `${currentAudio.buffered.end(0).toFixed(1)}s` : '0s'}`);
    }
    
    if (nextAudio) {
      console.log(`\n🎵 Track 2 preload status:`);
      console.log(`   - Ready state: ${nextAudio.readyState} (4=fully buffered)`);
      console.log(`   - Buffered: ${nextAudio.buffered.length > 0 ? `${nextAudio.buffered.end(0).toFixed(1)}s` : '0s'}`);
      console.log(`   - Source set: ${nextAudio.src ? 'YES' : 'NO'}`);
    } else {
      console.log(`\n❌ Track 2 preload status: NOT STARTED`);
    }
    
    // Wait for more buffering
    await new Promise(resolve => setTimeout(resolve, 200));
    logEvent('⏱️  Waited additional 200ms for more buffering');
    
    // Simulate Track 1 ending to test transition
    logEvent('🔄 Simulating Track 1 ending to test gapless transition');
    if (currentAudio) {
      currentAudio.simulateEnd();
    }
    
    // Wait for transition
    await new Promise(resolve => setTimeout(resolve, 100));
    logEvent('✅ Transition completed');
    
    // Check final state
    const finalState = audioPlayerService.getCurrentState();
    console.log(`\n📊 Final playback state:`);
    console.log(`   - Playing: ${finalState.isPlaying}`);
    console.log(`   - Current track: ${finalState.currentTrack?.title}`);
    
    console.log('\n📈 === DIAGNOSTIC SUMMARY ===');
    
    // Analysis
    const track2PreloadEvent = timeline.find(e => e.event.includes('Track2'));
    if (track2PreloadEvent) {
      console.log(`✅ Track 2 preloading detected at ${track2PreloadEvent.timestamp}ms`);
    } else {
      console.log(`❌ Track 2 preloading NOT detected`);
    }
    
    // Key assertions for gapless playback
    expect(state.isPlaying).toBe(true);
    expect(state.currentTrack?.id).toBe('track1');
    
    if (nextAudio) {
      expect(nextAudio.src).toContain('track2');
      console.log(`✅ Track 2 is being preloaded`);
    } else {
      console.log(`❌ Track 2 preloading failed to start`);
    }
    
    // After transition
    expect(finalState.currentTrack?.id).toBe('track2');
    console.log(`✅ Successfully transitioned to Track 2`);
    
    console.log('\n🎯 For true gapless playback in browser:');
    console.log('   1. Track 2 buffering should start within 50ms of Track 1 starting');
    console.log('   2. Track 2 should reach ready state 3+ before Track 1 ends');
    console.log('   3. Transition should be immediate with no audio gap');
  });
});