import { render } from "@testing-library/react";
import { test, expect } from "vitest";
import PlaylistArtwork from "./PlaylistArtwork";

test("creates stable local artwork without storing random state", () => {
  const playlist = { id: "playlist-42", name: "Night Drive" };
  const { container, rerender } = render(<PlaylistArtwork playlist={playlist} />);
  const firstStyle = container.firstChild.getAttribute("style");
  rerender(<PlaylistArtwork playlist={{ ...playlist }} />);
  expect(container.firstChild.getAttribute("style")).toBe(firstStyle);
  expect(container).toHaveTextContent("PLAYLIST");
});
