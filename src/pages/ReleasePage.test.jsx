import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, test, vi } from 'vitest';
import ReleasePage from './ReleasePage';

const { getRelease, getArtist, getReleaseTracks } = vi.hoisted(() => ({
  getRelease: vi.fn(), getArtist: vi.fn(), getReleaseTracks: vi.fn(),
}));

vi.mock('../lib/catalog', () => ({ getRelease, getArtist, getReleaseTracks, mediaUrl: vi.fn().mockResolvedValue('') }));
vi.mock('../music/AudioProvider', () => ({ useAudio: () => ({ track: null, playing: false, isTrackActive: () => false, toggle: vi.fn(), playTracks: vi.fn() }) }));
vi.mock('../playlists/PlaylistProvider', () => ({ AddToPlaylistButton: () => null }));

beforeEach(() => {
  getRelease.mockResolvedValue({ id: 'release-1', artistId: 'artist-1', status: 'published', title: 'Ramalbam', type: 'album', genre: 'Electronic', description: 'Release description' });
  getArtist.mockResolvedValue({ id: 'artist-1', name: 'North Man', slug: 'north-man', status: 'active' });
  getReleaseTracks.mockResolvedValue([
    { id: 'track-1', title: 'Deep emotions,', status: 'ready', durationSeconds: 112, storagePath: 'audio/1.mp3' },
    { id: 'track-2', title: 'Endless Glow', status: 'ready', durationSeconds: 239, storagePath: 'audio/2.mp3' },
    { id: 'track-3', title: 'I Wanna Feel', status: 'ready', durationSeconds: 479, storagePath: 'audio/3.mp3' },
  ]);
});

test('renders complete anonymous release rows without relying on a playlist button', async () => {
  render(<MemoryRouter initialEntries={['/release/release-1']}><Routes><Route path="/release/:releaseId" element={<ReleasePage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Deep emotions,')).toBeVisible();
  expect(screen.getByText('Endless Glow')).toBeVisible();
  expect(screen.getByText('I Wanna Feel')).toBeVisible();
  expect(screen.getAllByRole('button', { name: /^Play (Deep emotions,|Endless Glow|I Wanna Feel)$/ })).toHaveLength(3);
  expect(document.querySelectorAll('.public-track-row__main')).toHaveLength(3);
});
