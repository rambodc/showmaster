import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import PlaylistsPage from './PlaylistsPage';

const mocks = vi.hoisted(() => ({
  getPlaylist: vi.fn(), getPlaylistEntries: vi.fn(), getMyPlaylists: vi.fn(),
  reorder: vi.fn(), remove: vi.fn(), rename: vi.fn(), removePlaylist: vi.fn(), create: vi.fn(),
  playTracks: vi.fn(), toggle: vi.fn(), openAdd: vi.fn(), refreshPlaylists: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { uid: 'owner-1' } }) }));
vi.mock('../lib/catalog', () => ({ getPlaylist: mocks.getPlaylist, getPlaylistEntries: mocks.getPlaylistEntries, getMyPlaylists: mocks.getMyPlaylists }));
vi.mock('../lib/api', () => ({
  createPlaylist: mocks.create, deletePlaylist: mocks.removePlaylist, removeTrackFromPlaylist: mocks.remove,
  renamePlaylist: mocks.rename, reorderPlaylistTracks: mocks.reorder, friendlyError: (error) => error?.message || 'Failed',
}));
vi.mock('../music/AudioProvider', () => ({ useAudio: () => ({ isTrackActive: () => false, playing: false, loading: false, playTracks: mocks.playTracks, toggle: mocks.toggle }) }));
vi.mock('../playlists/PlaylistProvider', () => ({ usePlaylists: () => ({ openAddToPlaylist: mocks.openAdd, load: mocks.refreshPlaylists }) }));
vi.mock('../components/ui/Toast', () => ({ useToast: () => ({ success: mocks.toastSuccess, error: mocks.toastError }) }));
vi.mock('../playlists/PlaylistArtwork', () => ({ default: () => <div data-testid="playlist-artwork" /> }));

const tracks = [
  { entryId: 'entry-1', id: 'track-1', title: 'First Song', artistName: 'Nova', releaseTitle: 'One', durationSeconds: 90, status: 'ready', storagePath: 'one.mp3' },
  { entryId: 'entry-2', id: 'track-2', title: 'Second Song', artistName: 'Nova', releaseTitle: 'Two', durationSeconds: 120, status: 'ready', storagePath: 'two.mp3' },
];

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset?.());
  mocks.getPlaylist.mockResolvedValue({ id: 'playlist-1', name: 'Favorites' });
  mocks.getPlaylistEntries.mockResolvedValue(tracks);
  mocks.reorder.mockResolvedValue({});
  mocks.remove.mockResolvedValue({});
  mocks.refreshPlaylists.mockResolvedValue(undefined);
});

function renderPage() {
  return render(<MemoryRouter initialEntries={['/app/playlists/playlist-1']}><Routes><Route path="/app/playlists/:playlistId" element={<PlaylistsPage />} /></Routes></MemoryRouter>);
}

const openMenu = (button) => { button.focus(); fireEvent.keyDown(button, { key: 'Enter' }); };

test('uses one header options menu and two separated controls per track', async () => {
  renderPage();
  expect(await screen.findByRole('button', { name: 'Play all' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: /^More options for / })).toHaveLength(2);
  openMenu(screen.getByRole('button', { name: 'Playlist options' }));
  expect(await screen.findByRole('menuitem', { name: 'Rename playlist' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Delete playlist' })).toBeInTheDocument();
});

test('moves a track from its menu and saves the complete order', async () => {
  renderPage();
  const more = await screen.findByRole('button', { name: 'More options for First Song' });
  openMenu(more);
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Move to bottom' }));
  await waitFor(() => expect(mocks.reorder).toHaveBeenCalledWith({ playlistId: 'playlist-1', entryIds: ['entry-2', 'entry-1'] }));
  expect(mocks.toastSuccess).toHaveBeenCalledWith('Playlist order updated.');
});

test('opens add-to-another while excluding the current playlist', async () => {
  renderPage();
  openMenu(await screen.findByRole('button', { name: 'More options for First Song' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Add to another playlist' }));
  expect(mocks.openAdd).toHaveBeenCalledWith(tracks[0], { excludePlaylistId: 'playlist-1' });
});
