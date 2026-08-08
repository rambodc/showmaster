import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, test, vi } from "vitest";
import { useAuth } from "../auth/AuthProvider";
import MusicShell from "./MusicShell";

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../components/ui/Toast", () => ({ useToast: () => ({ error: vi.fn() }) }));

beforeEach(() => {
  useAuth.mockReturnValue({
    user: { uid: "user-1", displayName: "Alex", email: "alex@example.com" },
    profile: { artistId: "artist-1", storageBytes: 0 },
    logout: vi.fn(),
  });
});

test("shows four primary mobile destinations plus a separate menu", () => {
  render(
    <MemoryRouter initialEntries={["/app"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route element={<MusicShell />}><Route path="/app" element={<div>Overview page</div>} /></Route></Routes>
    </MemoryRouter>,
  );
  const mobileNav = screen.getByRole("navigation", { name: "Primary mobile navigation" });
  expect(mobileNav.querySelectorAll("a")).toHaveLength(4);
  expect(within(mobileNav).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/app");
  expect(within(mobileNav).getByRole("link", { name: "My Profile" })).toHaveAttribute("href", "/app/profile");
  expect(within(mobileNav).getByRole("link", { name: "My Playlists" })).toHaveAttribute("href", "/app/playlists");
  expect(within(mobileNav).getByRole("link", { name: "Public Library" })).toHaveAttribute("href", "/library");
  const menu = screen.getByRole("button", { name: "Open navigation" });
  expect(menu).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(menu);
  expect(screen.getByRole("button", { name: "Close navigation", expanded: true })).toHaveAttribute("aria-expanded", "true");
});
