import { fireEvent, render, screen } from '@testing-library/react';
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
