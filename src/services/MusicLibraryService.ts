import { Track, Artist } from '../types/music';

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
        return null;
      }
      
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error extracting album art:', error);
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