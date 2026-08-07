import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "./App";
import { useAuth } from "../auth/AuthProvider";

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../lib/catalog", () => ({
    getPublicReleases: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  getArtistBySlug: vi.fn().mockResolvedValue(null),
  getRelease: vi.fn().mockResolvedValue(null),
  getArtist: vi.fn(),
  getArtistReleases: vi.fn().mockResolvedValue([]),
  getReleaseTracks: vi.fn().mockResolvedValue([]),
  mediaUrl: vi.fn().mockResolvedValue(""),
}));

const signedOut = {
  user: null,
  profile: null,
  profileError: "",
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};
const verified = {
  ...signedOut,
  user: {
    uid: "abc",
    email: "alex@example.com",
    displayName: "Alex",
    emailVerified: true,
  },
  profile: {
    uid: "abc",
    email: "alex@example.com",
    displayName: "Alex",
    artistId: null,
    storageBytes: 0,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ ...signedOut, login: vi.fn(), logout: vi.fn() });
});
const renderAt = (path) =>
  render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  );

test("redirects a signed-out visitor from the app to login", () => {
  renderAt("/app");
  expect(
    screen.getByRole("heading", { name: /log in to showmaster/i }),
  ).toBeInTheDocument();
});
test("shows artist onboarding without requiring email verification", () => {
  useAuth.mockReturnValue({
    ...verified,
    user: { ...verified.user, emailVerified: false },
    refreshProfile: vi.fn(),
  });
  renderAt("/app");
  expect(
    screen.getByRole("heading", { name: /introduce your virtual artist/i }),
  ).toBeInTheDocument();
});
test("renders the public music library without authentication", async () => {
  renderAt("/library");
  expect(
    screen.getByRole("heading", {
      name: /discover music from imagined worlds/i,
    }),
  ).toBeInTheDocument();
  expect(await screen.findByText(/no published music/i)).toBeInTheDocument();
});
test("submits email and password to Firebase login", async () => {
  const login = vi.fn().mockResolvedValue({});
  useAuth.mockReturnValue({ ...signedOut, login });
  renderAt("/login");
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: "secret1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^log in/i }));
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith("alex@example.com", "secret1"),
  );
});
test("shows a friendly invalid-credentials error", async () => {
  const login = vi.fn().mockRejectedValue({ code: "auth/invalid-credential" });
  useAuth.mockReturnValue({ ...signedOut, login });
  renderAt("/login");
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^log in/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect/i);
});
