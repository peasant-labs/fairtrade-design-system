// @ts-check

// Per-process Vite dependency cache.
//
// The parallel library gate runs several Vite-based tests at once. Vite's
// default cache is node_modules/.vite/deps, shared by every process in the
// worktree; two concurrent refreshes can fail with ENOTEMPTY while one removes
// the directory the other is writing. The lane runner sets
// FAIRTRADE_VITE_CACHE_DIR per gate, so sibling gates never share a cache; a
// direct test run falls back to a process-unique directory.

import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const FAIRTRADE_VITE_CACHE_DIR =
  process.env.FAIRTRADE_VITE_CACHE_DIR || join(tmpdir(), `fairtrade-vite-${process.pid}`)
