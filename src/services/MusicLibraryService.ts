import { Track, Artist, ScanProgress } from '../types/music';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export class MusicLibraryService {
  async fetchMusicLibrary(): Promise<Artist[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/library`);
      if (!response.ok) {
        throw new Error(`Failed to fetch music library: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.artists || [];
    } catch (error) {
      console.error('Error fetching music library:', error);
      throw error;
    }
  }

  async fetchMusicLibraryWithProgress(
    onProgress: (progress: ScanProgress) => void
  ): Promise<Artist[]> {
    // Check if EventSource is available (not available in Node.js test environment)
    if (typeof EventSource === 'undefined') {
      // Fallback to the regular method without progress for tests
      return this.fetchMusicLibrary();
    }
    
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`${API_BASE_URL}/library/scan`);
      
      eventSource.onopen = () => {
        console.log('SSE connection opened');
      };

      eventSource.addEventListener('start', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        onProgress({
          type: 'directory',
          message: data.message
        });
      });

      eventSource.addEventListener('progress', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        onProgress(data);
      });

      eventSource.addEventListener('complete', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        onProgress({
          type: 'processed',
          message: data.message,
          totalFiles: data.totalTracks,
          processedFiles: data.totalTracks,
          artistCount: data.artistCount,
          albumCount: data.albumCount
        });
        
        eventSource.close();
        resolve(data.artists || []);
      });

      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          eventSource.close();
          reject(new Error(data.message || 'Failed to scan music library'));
        } catch (parseError) {
          eventSource.close();
          reject(new Error('Failed to scan music library'));
        }
      });

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        reject(new Error('Connection error while scanning music library'));
      };
    });
  }

  getAudioUrl(track: Track): string {
    return `${API_BASE_URL}/audio/${encodeURIComponent(track.relativePath)}`;
  }

  getAlbumArtUrl(track: Track): string {
    return `${API_BASE_URL}/albumart/${encodeURIComponent(track.relativePath)}`;
  }

  async extractAlbumArt(track: Track): Promise<string | null> {
    try {
      const albumArtUrl = this.getAlbumArtUrl(track);
      const response = await fetch(albumArtUrl);
      
      if (!response.ok) {
        // Silently handle 404s and other expected failures - no console warnings needed
        return null;
      }
      
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      // Only log unexpected errors, not network failures for missing album art
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network error - likely server not available, don't spam console
        return null;
      } else {
        // Only log truly unexpected errors
        console.warn('Unexpected error extracting album art:', error);
      }
      return null;
    }
  }

  // Legacy method for compatibility - now just returns the audio URL
  createAudioUrl(track: Track): string {
    return this.getAudioUrl(track);
  }

  revokeAudioUrl(url: string): void {
    // Only revoke blob URLs (album art), not API URLs
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}

export const musicLibraryService = new MusicLibraryService();