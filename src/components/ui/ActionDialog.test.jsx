import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';
import { ActionDialog } from './ActionDialog';
import { LoadingButton } from './LoadingButton';

test('requires the exact destructive confirmation before submitting', () => {
  const confirm = vi.fn();
  render(<ActionDialog open onOpenChange={() => {}} title="Delete playlist" description="Permanent action" label="Confirmation" confirmationText="DELETE PLAYLIST" confirmLabel="Delete" destructive onConfirm={confirm} />);
  const button = screen.getByRole('button', { name: 'Delete' });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'delete playlist' } });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'DELETE PLAYLIST' } });
  fireEvent.click(button);
  expect(confirm).toHaveBeenCalledWith('DELETE PLAYLIST');
});

test('shows an accessible pending state and prevents another click', () => {
  const click = vi.fn();
  render(<LoadingButton loading loadingLabel="Saving…" onClick={click}>Save</LoadingButton>);
  const button = screen.getByRole('button', { name: 'Saving…' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(button);
  expect(click).not.toHaveBeenCalled();
});

test('tracks the mobile visual viewport and restores page position', () => {
  const listeners = {};
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: 420, offsetTop: 18, addEventListener: vi.fn((name, callback) => { listeners[name] = callback; }), removeEventListener: vi.fn() } });
  window.scrollTo = vi.fn();
  const { unmount } = render(<ActionDialog open onOpenChange={() => {}} title="Create playlist" label="Playlist name" confirmLabel="Create" onConfirm={() => {}} />);
  expect(document.documentElement.style.getPropertyValue('--dialog-viewport-height')).toBe('420px');
  expect(document.documentElement.style.getPropertyValue('--dialog-viewport-offset')).toBe('18px');
  unmount();
  expect(document.documentElement.style.getPropertyValue('--dialog-viewport-height')).toBe('');
  expect(window.scrollTo).toHaveBeenCalled();
  delete window.visualViewport;
});

test('restores focus to the opener when the dialog closes', async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open playlist dialog</button><ActionDialog open={open} onOpenChange={setOpen} title="Add to playlist" label="Playlist name" onConfirm={() => {}} /></>;
  }
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Open playlist dialog' });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
  await waitFor(() => expect(opener).toHaveFocus());
});
