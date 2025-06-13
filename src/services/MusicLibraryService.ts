import * as musicMetadata from 'music-metadata';
import { Track, Artist } from '../types/music';

export class MusicLibraryService {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  async parseAudioFile(file: File): Promise<Track | null> {
    try {
      const metadata = await musicMetadata.parseBlob(file);
      
      const track: Track = {
        id: `${file.name}-${file.lastModified}`,
        title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""),
        artist: metadata.common.artist || 'Unknown Artist',
        album: metadata.common.album || 'Unknown Album',
        trackNumber: metadata.common.track?.no || 0,
        duration: metadata.format.duration || 0,
        filePath: file.name,
        file: file
      };

      return track;
    } catch (error) {
      console.error('Error parsing audio file:', error);
      return null;
    }
  }

  async parseMultipleFiles(files: FileList): Promise<Track[]> {
    const tracks: Track[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (this.isAudioFile(file)) {
        const track = await this.parseAudioFile(file);
        if (track) {
          tracks.push(track);
        }
      }
    }

    return tracks;
  }

  organizeTracksIntoLibrary(tracks: Track[]): Artist[] {
    const artistMap = new Map<string, Artist>();

    tracks.forEach(track => {
      const artistName = track.artist;
      const albumTitle = track.album;

      if (!artistMap.has(artistName)) {
        artistMap.set(artistName, {
          id: artistName.toLowerCase().replace(/\s+/g, '-'),
          name: artistName,
          albums: []
        });
      }

      const artist = artistMap.get(artistName)!;
      let album = artist.albums.find(a => a.title === albumTitle);

      if (!album) {
        album = {
          id: `${artistName}-${albumTitle}`.toLowerCase().replace(/\s+/g, '-'),
          title: albumTitle,
          artist: artistName,
          tracks: []
        };
        artist.albums.push(album);
      }

      album.tracks.push(track);
    });

    // Sort tracks within albums by track number
    artistMap.forEach(artist => {
      artist.albums.forEach(album => {
        album.tracks.sort((a, b) => a.trackNumber - b.trackNumber);
      });
      artist.albums.sort((a, b) => a.title.localeCompare(b.title));
    });

    return Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async extractAlbumArt(file: File): Promise<string | null> {
    try {
      const metadata = await musicMetadata.parseBlob(file);
      const picture = metadata.common.picture?.[0];
      
      if (picture) {
        const blob = new Blob([picture.data], { type: picture.format });
        return URL.createObjectURL(blob);
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting album art:', error);
      return null;
    }
  }

  private isAudioFile(file: File): boolean {
    const audioExtensions = ['.flac', '.mp3', '.wav', '.ogg', '.m4a'];
    const fileName = file.name.toLowerCase();
    return audioExtensions.some(ext => fileName.endsWith(ext));
  }

  createAudioUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  revokeAudioUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}

export const musicLibraryService = new MusicLibraryService();