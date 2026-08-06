import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useAuth } from './auth/AuthContext';

jest.mock('./auth/AuthContext', () => ({ useAuth: jest.fn() }));

const signedOut = { user: null, profile: null, profileError: '', loading: false, login: jest.fn(), register: jest.fn(), logout: jest.fn() };
const signedIn = { ...signedOut, user: { uid: 'abc', email: 'alex@example.com', displayName: 'Alex' }, profile: { uid: 'abc', email: 'alex@example.com', displayName: 'Alex' } };

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ ...signedOut, login: jest.fn(), logout: jest.fn() });
});

test('redirects a signed-out visitor from the app to login', () => {
  render(<MemoryRouter initialEntries={['/app']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /log in to showmaster/i })).toBeInTheDocument();
});

test('redirects a signed-in user away from login and supports logout', () => {
  const logout = jest.fn();
  useAuth.mockReturnValue({ ...signedIn, logout });
  render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /good to see you, alex/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /log out/i }));
  expect(logout).toHaveBeenCalledTimes(1);
});

test('submits email and password to Firebase login', async () => {
  const login = jest.fn().mockResolvedValue({});
  useAuth.mockReturnValue({ ...signedOut, login });
  render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'alex@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret1' } });
  fireEvent.click(screen.getByRole('button', { name: /^log in/i }));
  await waitFor(() => expect(login).toHaveBeenCalledWith('alex@example.com', 'secret1'));
});

test('shows a friendly invalid-credentials error', async () => {
  const login = jest.fn().mockRejectedValue({ code: 'auth/invalid-credential' });
  useAuth.mockReturnValue({ ...signedOut, login });
  render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'alex@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong' } });
  fireEvent.click(screen.getByRole('button', { name: /^log in/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect/i);
});
