import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import RouteScrollRestoration from "./RouteScrollRestoration";

function Page({ destination, label }) {
  const navigate = useNavigate();
  return <><h1>{label}</h1><button onClick={() => navigate(destination)}>Navigate</button></>;
}

beforeEach(() => {
  window.scrollTo = vi.fn();
});

test("resets the page to the top whenever the pathname changes", () => {
  render(<MemoryRouter initialEntries={["/library"]}>
    <RouteScrollRestoration />
    <Routes>
      <Route path="/library" element={<Page destination="/release/release-1" label="Library" />} />
      <Route path="/release/:releaseId" element={<Page destination="/artist/nova" label="Release" />} />
      <Route path="/artist/:slug" element={<h1>Artist</h1>} />
    </Routes>
  </MemoryRouter>);
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Navigate" }));
  expect(screen.getByRole("heading", { name: "Release" })).toBeInTheDocument();
  expect(window.scrollTo).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Navigate" }));
  expect(screen.getByRole("heading", { name: "Artist" })).toBeInTheDocument();
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" });
});
