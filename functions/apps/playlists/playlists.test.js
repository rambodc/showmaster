import test from "node:test";
import assert from "node:assert/strict";
import { PLAYLIST_LIMITS } from "./playlists.js";

test("private playlist limits match the product contract", () => {
  assert.deepEqual(PLAYLIST_LIMITS, { playlistsPerUser: 20, tracksPerPlaylist: 200 });
});
