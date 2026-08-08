import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mediaUrl } from "../lib/catalog";
import { AudioProvider, useAudio } from "./AudioProvider";

vi.mock("../lib/catalog", () => ({ mediaUrl: vi.fn() }));
vi.mock("../playlists/PlaylistProvider", () => ({ AddToPlaylistButton: () => null }));

const tracks = [
  { id: "one", title: "First", artistName: "Nova", status: "ready", storagePath: "one.mp3", access: "public" },
  { id: "two", title: "Second", artistName: "Nova", status: "ready", storagePath: "two.mp3", access: "public" },
];

function Harness({ items = tracks }) {
  const audio = useAudio();
  return <><button onClick={() => audio.playTracks(items)}>Start queue</button><output data-testid="state">{audio.track?.id}:{audio.playing ? "playing" : "paused"}</output></>;
}

describe("AudioProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mediaUrl.mockImplementation((path) => Promise.resolve(`https://media.test/${path}`));
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
  });

  test("pause controls the real audio element and play resumes it", async () => {
    render(<AudioProvider><Harness /></AudioProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Start queue" }));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("one:paused");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("one:playing"));
  });

  test("next and previous stop at queue boundaries", async () => {
    render(<AudioProvider><Harness /></AudioProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Start queue" }));
    expect(await screen.findByRole("button", { name: "Previous track" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("two:playing"));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Next track" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous track" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("one:playing"));
  });

  test("private previews request authenticated blob access and volume persists without replaying", async () => {
    const privateTrack = [{ ...tracks[0], access: "private-preview" }];
    render(<AudioProvider><Harness items={privateTrack} /></AudioProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Start queue" }));
    await waitFor(() => expect(mediaUrl).toHaveBeenCalledWith("one.mp3", { privateAccess: true }));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "0.4" } });
    expect(window.localStorage.getItem("showmaster.player.volume.v1")).toBe("0.4");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  test("mute and volume controls update the real audio element", async () => {
    const { container } = render(<AudioProvider><Harness /></AudioProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Start queue" }));
    await screen.findByRole("button", { name: "Mute" });
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    await waitFor(() => expect(screen.getByRole("slider", { name: "Volume" })).toHaveValue("0"));
    expect(container.querySelector("audio").volume).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(Number(screen.getByRole("slider", { name: "Volume" }).value)).toBeGreaterThan(0));
    expect(container.querySelector("audio").volume).toBeGreaterThan(0);
  });

  test("rapid selection detaches the old source and ignores a stale URL response", async () => {
    let resolveFirst;
    let resolveSecond;
    mediaUrl.mockImplementation((path) => new Promise((resolve) => {
      if (path === "one.mp3") resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    const { container } = render(<AudioProvider><Harness /></AudioProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Start queue" }));
    await waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    fireEvent.pause(container.querySelector("audio"));
    expect(screen.getByTestId("state")).toHaveTextContent("two:playing");
    await waitFor(() => expect(resolveSecond).toBeTypeOf("function"));
    resolveSecond("https://media.test/two.mp3");
    await waitFor(() => expect(container.querySelector("audio").src).toContain("two.mp3"));
    resolveFirst("https://media.test/one.mp3");
    await waitFor(() => expect(container.querySelector("audio").src).toContain("two.mp3"));
  });

  test("single-track Now Playing has useful controls without an empty queue", async () => {
    render(<AudioProvider><Harness items={[tracks[0]]} /></AudioProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Start queue" }));
    await screen.findByRole("button", { name: "Open Now Playing" });
    fireEvent.click(screen.getByRole("button", { name: "Open Now Playing" }));
    expect(screen.getByRole("dialog", { name: "Music player" })).toBeInTheDocument();
    expect(screen.getByText("Now Playing")).toBeInTheDocument();
    expect(screen.getByText("Single track")).toBeInTheDocument();
    expect(screen.queryByLabelText("Playback queue")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Minimize player" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Music player" })).not.toBeInTheDocument());
    expect(screen.getByTestId("state")).toHaveTextContent("one:playing");
  });

  test("multi-track Now Playing exposes the queue", async () => {
    render(<AudioProvider><Harness /></AudioProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Start queue" }));
    await screen.findByRole("button", { name: "Open Now Playing" });
    fireEvent.click(screen.getByRole("button", { name: "Open Now Playing" }));
    expect(screen.getByLabelText("Playback queue")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 · Queue")).toBeInTheDocument();
  });
});
