export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  trackNumber: number;
  duration: number;
  filePath: string;
  relativePath: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year?: number;
  tracks: Track[];
  coverArt?: string;
}

export interface Artist {
  id: string;
  name: string;
  albums: Album[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTrack: Track | null;
  currentAlbum: Album | null;
  position: number;
  duration: number;
}

export interface ScanProgress {
  type: 'scanning' | 'processed' | 'directory' | 'error';
  message: string;
  file?: string;
  title?: string;
  artist?: string;
  album?: string;
  path?: string;
  error?: string;
  totalFiles?: number;
  processedFiles?: number;
  artistCount?: number;
  albumCount?: number;
}