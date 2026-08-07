import { beforeEach, expect, test, vi } from 'vitest';

const { task, prepareImageUpload } = vi.hoisted(() => ({
  task: { on: vi.fn(), cancel: vi.fn() },
  prepareImageUpload: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => 'storage-reference'),
  uploadBytesResumable: vi.fn(() => task),
}));
vi.mock('../core/firebase', () => ({ storage: {} }));
vi.mock('./api', () => ({
  prepareImageUpload,
  prepareTrackUpload: vi.fn(),
}));

import { uploadImage } from './uploads';

beforeEach(() => {
  vi.clearAllMocks();
  prepareImageUpload.mockResolvedValue({ storagePath: 'users/u/media/1/artwork.jpg' });
  task.on.mockImplementation((_event, progress, error, complete) => {
    if (progress) progress({ bytesTransferred: 5, totalBytes: 10 });
    if (complete) complete();
  });
});

test('image uploads expose progress and a cancellable task', async () => {
  const onProgress = vi.fn();
  const onTask = vi.fn();
  const file = new File(['image'], 'cover.jpg', { type: 'image/jpeg' });
  const result = await uploadImage({ targetType: 'release', targetId: 'release-1', file, onProgress, onTask });
  expect(onProgress).toHaveBeenCalledWith(50);
  expect(onTask).toHaveBeenCalledWith(task);
  expect(result.storagePath).toBe('users/u/media/1/artwork.jpg');
});
