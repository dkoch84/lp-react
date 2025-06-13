import React from 'react';
import { Artist } from '../types/music';
import AlbumCard from './AlbumCard';
import './ArtistLibrary.css';

interface ArtistLibraryProps {
  artists: Artist[];
  onAlbumSelect: (album: any) => void;
}

const ArtistLibrary: React.FC<ArtistLibraryProps> = ({ artists, onAlbumSelect }) => {
  if (artists.length === 0) {
    return (
      <div className="empty-library">
        <div className="empty-message">
          <h3>Your Music Library is Empty</h3>
          <p>Add some music files to get started with your vinyl experience.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="artist-library">
      <div className="library-header">
        <h2>Music Library</h2>
        <p>{artists.length} artist{artists.length !== 1 ? 's' : ''}</p>
      </div>
      
      {artists.map(artist => (
        <div key={artist.id} className="artist-section">
          <h3 className="artist-name">{artist.name}</h3>
          <div className="albums-grid">
            {artist.albums.map(album => (
              <AlbumCard
                key={album.id}
                album={album}
                onSelect={() => onAlbumSelect(album)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ArtistLibrary;