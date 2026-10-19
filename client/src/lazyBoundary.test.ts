import { test } from "node:test";
import assert from "node:assert/strict";
import { LazyBoundary } from "./LazyBoundary";

test("gagal memuat bagian 3D (chunk 404 setelah redeploy): tampilkan pengganti & panggil onError, bukan halaman putih", () => {
  assert.deepEqual(LazyBoundary.getDerivedStateFromError(new Error("Failed to fetch dynamically imported module")), { failed: true });
  const errors: unknown[] = [];
  const b = new LazyBoundary({ onError: (e) => errors.push(e), fallback: null, children: null });
  b.componentDidCatch(new Error("x"));
  assert.equal(errors.length, 1);
});
