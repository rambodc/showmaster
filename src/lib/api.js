import { httpsCallable } from 'firebase/functions';
import { functions } from '../core/firebase';

const call = (name) => { const callable = httpsCallable(functions, name); return async (data = {}) => (await callable(data)).data; };

export const fetchMyProfile = call('getMyProfile');
export const createVirtualArtist = call('createVirtualArtist');
export const updateVirtualArtist = call('updateVirtualArtist');
export const deleteVirtualArtist = call('deleteVirtualArtist');
export const createRelease = call('createRelease');
export const updateRelease = call('updateRelease');
export const publishRelease = call('publishRelease');
export const unpublishRelease = call('unpublishRelease');
export const deleteRelease = call('deleteRelease');
export const prepareTrackUpload = call('prepareTrackUpload');
export const prepareImageUpload = call('prepareImageUpload');
export const deleteTrack = call('deleteTrack');
export const updateTrack = call('updateTrack');
export const reorderTracks = call('reorderTracks');
export const createPlaylist = call('createPlaylist');
export const renamePlaylist = call('renamePlaylist');
export const deletePlaylist = call('deletePlaylist');
export const addTrackToPlaylist = call('addTrackToPlaylist');
export const removeTrackFromPlaylist = call('removeTrackFromPlaylist');
export const reorderPlaylistTracks = call('reorderPlaylistTracks');

export function friendlyError(error) {
  const message = error?.message?.replace(/^Firebase:\s*/i, '').replace(/\s*\(functions\/[^)]+\)\.?$/, '');
  return message || 'Something went wrong. Please try again.';
}
