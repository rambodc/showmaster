import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import AuthLayout from './AuthLayout';

afterEach(() => {
  delete window.visualViewport;
  document.documentElement.style.removeProperty('--auth-viewport-height');
  document.documentElement.style.removeProperty('--auth-viewport-offset');
  vi.useRealTimers();
});

test('tracks the mobile keyboard viewport and keeps the focused auth field visible', () => {
  vi.useFakeTimers();
  const listeners = {};
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: 430, offsetTop: 16, addEventListener: vi.fn((name, handler) => { listeners[name] = handler; }), removeEventListener: vi.fn() } });
  Element.prototype.scrollIntoView = vi.fn();
  render(<MemoryRouter><AuthLayout eyebrow="Welcome" title="Log in" description="Continue" alternate="New?" alternateTo="/register" alternateLabel="Register"><form className="auth-form"><label>Email<input aria-label="Email" /></label></form></AuthLayout></MemoryRouter>);
  const input = screen.getByLabelText('Email');
  input.focus();
  act(() => { listeners.resize(); vi.advanceTimersByTime(90); });
  expect(document.documentElement.style.getPropertyValue('--auth-viewport-height')).toBe('430px');
  expect(document.documentElement.style.getPropertyValue('--auth-viewport-offset')).toBe('16px');
  expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
});
