export const GENRES = ['Electronic', 'Alternative', 'Ambient', 'Dance', 'Indie', 'Soul', 'Pop', 'Hip-Hop', 'Rock', 'Experimental', 'Other'];
export const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
