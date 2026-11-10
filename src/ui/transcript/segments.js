/* Transcript segments — the loaded-region model the reader surface renders.

   The transcript is a document cut into ~1 MiB segments on clean turn boundaries.
   A host loads one segment at a time (or a window's covering run) and this module
   turns those loaded pieces into everything the viewer needs to be honest about
   what it has read:

     • the loaded turn ranges (regions), with adjacent segments merged;
     • one boundary per unloaded edge, naming the turns, segments and bytes it
       stands in front of;
     • a bounded scrubber sample of `min(200, totalSegments)` ticks;
     • the scope sentence the filters rail and the Files tab state;
     • the covering-segment set a window descriptor still needs.

   Every function is pure. Nothing here fetches, and nothing here parses wire:
   the host cooks wire turns into `TurnVM`s before handing a segment over, exactly
   as it does for a whole-transcript view model.

   `TurnVM` carries `segmentIndex`, `truncated` and `byteLength` when it came from
   a segment read; the truncation notice and the mounted-card bound read them. */

import { buildFiles, buildToolGroupCounts } from './adapter.js'

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/** The scrubber's fixed sample size; the mounted tick count is `min(this, totalSegments)`. */
export const SEGMENT_SCRUBBER_TICKS = 200

/** Extra turns a mounted region may draw beyond the turns it was given. The viewer
    never invents turn content, so the overscan budget stays zero and the bound is the
    loaded segments' own turns. Named so a surface cannot quietly grow it. */
export const SEGMENT_OVERSCAN_TURNS = 0

/**
 * One segment reference from the directory.
 * @typedef {object} SegmentRefVM
 * @property {number} index
 * @property {number} firstTurn
 * @property {number} lastTurn
 * @property {number} byteLength
 */

/**
 * The transcript's only global index.
 * @typedef {object} SegmentDirectoryVM
 * @property {string} [sessionId]
 * @property {string} [revision]
 * @property {number} totalTurns
 * @property {number} totalSegments
 * @property {SegmentRefVM[]} [segments]
 * @property {number} [directoryPage]
 * @property {number} [directoryPerPage]
 */

/**
 * One loaded segment, already cooked to `TurnVM`s.
 * @typedef {object} SegmentVM
 * @property {number} index
 * @property {number} firstTurn
 * @property {number} lastTurn
 * @property {number} byteLength
 * @property {boolean} [hasOlder]
 * @property {boolean} [hasNewer]
 * @property {TurnVM[]} turns
 */

/**
 * A window descriptor. It carries no turn content: only where the window is and
 * which segments cover it.
 * @typedef {object} SegmentWindowVM
 * @property {string} [sessionId]
 * @property {string} [revision]
 * @property {number} requestedAnchor
 * @property {number} anchorTurn
 * @property {number} span
 * @property {number} firstTurn
 * @property {number} lastTurn
 * @property {number[]} segments
 * @property {boolean} [hasOlder]
 * @property {boolean} [hasNewer]
 */

/**
 * One contiguous run of loaded segments.
 * @typedef {object} SegmentRegionVM
 * @property {string} key
 * @property {number} firstSegment
 * @property {number} lastSegment
 * @property {number} firstTurn
 * @property {number} lastTurn
 * @property {SegmentRefVM[]} refs
 * @property {TurnVM[]} turns
 */

/**
 * One unloaded edge in front of a rendered region.
 * @typedef {object} SegmentBoundaryVM
 * @property {string} key
 * @property {'older' | 'newer' | 'between' | 'all'} side
 * @property {number} firstTurn
 * @property {number} lastTurn
 * @property {number[]} segmentIndexes
 * @property {number} segmentCount
 * @property {number} byteLength
 * @property {number} loadSegment   the segment a load-more on this edge appends/prepends
 */

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

/** Turn a host's loaded segments into a sorted list. Accepts an array, a record keyed by
    segment index, or a `Map`; each segment keeps all of its own fields. */
export function normaliseSegments(segments) {
  if (segments == null) return []
  const list = segments instanceof Map
    ? [...segments.values()]
    : Array.isArray(segments)
      ? segments
      : Object.values(segments)
  return list
    .filter((segment) => segment != null && isFiniteNumber(segment.index))
    .map((segment) => ({ ...segment, turns: Array.isArray(segment.turns) ? segment.turns : [] }))
    .sort((a, b) => a.index - b.index)
}

/** The loaded turns, in identity order, without duplicates. A turn is the transport
    unit's content, so the same identity must never render twice when two loads
    overlap at a region edge. */
export function turnsFromSegments(segments) {
  const seen = new Set()
  const turns = []
  for (const segment of normaliseSegments(segments)) {
    for (const turn of segment.turns) {
      if (!isFiniteNumber(turn?.index) || seen.has(turn.index)) continue
      seen.add(turn.index)
      turns.push({ ...turn, segmentIndex: turn.segmentIndex ?? segment.index })
    }
  }
  return turns.sort((a, b) => a.index - b.index)
}

/** A segment ref from a loaded segment when the directory does not carry one. */
function refOfSegment(segment) {
  return {
    index: segment.index,
    firstTurn: isFiniteNumber(segment.firstTurn) ? segment.firstTurn : Math.min(...segment.turns.map((turn) => turn.index)),
    lastTurn: isFiniteNumber(segment.lastTurn) ? segment.lastTurn : Math.max(...segment.turns.map((turn) => turn.index)),
    byteLength: isFiniteNumber(segment.byteLength) ? segment.byteLength : 0,
  }
}

/** Every ref the directory knows, sorted, extended with loaded segments the directory
    did not name (a window beside a paged-out directory row still renders). */
function refsOf(directory, segments) {
  const byIndex = new Map()
  for (const ref of directory?.segments ?? []) {
    if (ref != null && isFiniteNumber(ref.index)) byIndex.set(ref.index, ref)
  }
  for (const segment of segments) {
    if (!byIndex.has(segment.index)) byIndex.set(segment.index, refOfSegment(segment))
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index)
}

/** Merge adjacent loaded segments into rendered regions. A segment load that touches a
    region extends it; a load that does not stays a separate region. */
export function loadedRegions(directory, segments) {
  const list = normaliseSegments(segments)
  const loaded = new Map(list.map((segment) => [segment.index, segment]))
  /** @type {SegmentRegionVM[]} */
  const regions = []
  let current = null
  for (const ref of refsOf(directory, list)) {
    const segment = loaded.get(ref.index)
    if (!segment) {
      if (current) { regions.push(current); current = null }
      continue
    }
    if (!current) {
      current = {
        key: `segment-region-${ref.index}`,
        firstSegment: ref.index,
        lastSegment: ref.index,
        firstTurn: isFiniteNumber(ref.firstTurn) ? ref.firstTurn : Math.min(...segment.turns.map((turn) => turn.index)),
        lastTurn: isFiniteNumber(ref.lastTurn) ? ref.lastTurn : Math.max(...segment.turns.map((turn) => turn.index)),
        refs: [ref],
        turns: [],
      }
    } else {
      current.lastSegment = ref.index
      current.lastTurn = isFiniteNumber(ref.lastTurn) ? ref.lastTurn : current.lastTurn
      current.refs.push(ref)
    }
    for (const turn of segment.turns) {
      if (!current.turns.some((existing) => existing.index === turn.index)) {
        current.turns.push({ ...turn, segmentIndex: turn.segmentIndex ?? ref.index })
      }
    }
  }
  if (current) regions.push(current)
  for (const region of regions) region.turns.sort((a, b) => a.index - b.index)
  return regions
}

/**
 * One boundary per unloaded edge adjacent to a rendered region, in document order.
 * A gap between two regions gets one boundary with one load-more control (the
 * proposal's boundary carries one control, not a pager); the control advances the
 * older region into the gap.
 *
 * @param {SegmentDirectoryVM | null | undefined} directory
 * @param {SegmentRegionVM[]} regions
 * @returns {SegmentBoundaryVM[]}
 */
export function regionBoundaries(directory, regions) {
  const byIndex = new Map()
  for (const ref of refsOf(directory, [])) byIndex.set(ref.index, ref)
  for (const region of regions) for (const ref of region.refs) if (!byIndex.has(ref.index)) byIndex.set(ref.index, ref)
  const refs = [...byIndex.values()].sort((a, b) => a.index - b.index)
  const total = Math.max(0, isFiniteNumber(directory?.totalSegments) ? directory.totalSegments : refs.length)
  if (total === 0) return []
  const gapRefs = (from, to) => {
    const list = []
    for (let index = from; index <= to; index += 1) {
      const ref = byIndex.get(index)
      if (ref) list.push(ref)
    }
    return list
  }
  const make = (side, list, loadSegment) => {
    const first = list[0]
    const last = list[list.length - 1]
    if (!first || !last) return null
    return {
      key: `segment-boundary-${side}-${first.index}-${last.index}`,
      side,
      firstTurn: first.firstTurn,
      lastTurn: last.lastTurn,
      segmentIndexes: list.map((ref) => ref.index),
      segmentCount: list.length,
      byteLength: list.reduce((sum, ref) => sum + (isFiniteNumber(ref.byteLength) ? ref.byteLength : 0), 0),
      loadSegment,
    }
  }
  if (regions.length === 0) {
    const all = gapRefs(0, total - 1)
    const boundary = make('all', all, all[0]?.index ?? 0)
    return boundary ? [boundary] : []
  }
  /** @type {SegmentBoundaryVM[]} */
  const boundaries = []
  const first = regions[0]
  if (first.firstSegment > 0) {
    const boundary = make('older', gapRefs(0, first.firstSegment - 1), first.firstSegment - 1)
    if (boundary) boundaries.push(boundary)
  }
  for (let i = 1; i < regions.length; i += 1) {
    const previous = regions[i - 1]
    const next = regions[i]
    if (next.firstSegment > previous.lastSegment + 1) {
      const boundary = make('between', gapRefs(previous.lastSegment + 1, next.firstSegment - 1), previous.lastSegment + 1)
      if (boundary) boundaries.push(boundary)
    }
  }
  const last = regions[regions.length - 1]
  if (last.lastSegment < total - 1) {
    const boundary = make('newer', gapRefs(last.lastSegment + 1, total - 1), last.lastSegment + 1)
    if (boundary) boundaries.push(boundary)
  }
  return boundaries
}

/** Human byte extent: the boundary caption's size, and the truncation notice's own. */
export function formatByteExtent(bytes) {
  if (!isFiniteNumber(bytes) || bytes <= 0) return '0 bytes'
  const units = ['bytes', 'KiB', 'MiB', 'GiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

/** The boundary's caption: the unloaded extent on that side, in turns, segments and bytes. */
export function boundaryCaption(boundary) {
  const turns = boundary.firstTurn === boundary.lastTurn
    ? `turn ${boundary.firstTurn}`
    : `turns ${boundary.firstTurn}–${boundary.lastTurn}`
  const segments = `${boundary.segmentCount} ${boundary.segmentCount === 1 ? 'segment' : 'segments'}`
  return `${turns}, ${segments}, ${formatByteExtent(boundary.byteLength)}`
}

/** The fixed scrubber sample over the directory. Never one tick per turn. */
export function scrubberTicks(directory) {
  const refs = refsOf(directory, [])
  const total = Math.max(refs.length, isFiniteNumber(directory?.totalSegments) ? directory.totalSegments : refs.length)
  if (total === 0) return []
  const sample = Math.min(SEGMENT_SCRUBBER_TICKS, total)
  const indexes = new Set()
  if (refs.length <= SEGMENT_SCRUBBER_TICKS) {
    for (const ref of refs) indexes.add(ref.index)
  } else {
    const last = total - 1
    for (let i = 0; i < sample; i += 1) indexes.add(Math.round((i / (sample - 1)) * last))
  }
  return [...indexes].sort((a, b) => a - b).map((index) => {
    const ref = refs.find((candidate) => candidate.index === index) ?? { index, firstTurn: index, lastTurn: index, byteLength: 0 }
    return {
      key: `segment-tick-${index}`,
      index,
      firstTurn: ref.firstTurn,
      lastTurn: ref.lastTurn,
      label: ref.firstTurn === ref.lastTurn ? `turn ${ref.firstTurn}` : `turns ${ref.firstTurn}–${ref.lastTurn}`,
      leftPct: total > 1 ? (index / (total - 1)) * 100 : 0,
    }
  })
}

/** What the trace count and the Files tab have actually read. */
export function loadedScope(directory, regions) {
  const totalSegments = Math.max(0, isFiniteNumber(directory?.totalSegments) ? directory.totalSegments : regions.length)
  const loadedSegments = regions.reduce((sum, region) => sum + region.refs.length, 0)
  const loadedTurns = regions.reduce((sum, region) => sum + region.turns.length, 0)
  const totalTurns = Math.max(loadedTurns, isFiniteNumber(directory?.totalTurns) ? directory.totalTurns : loadedTurns)
  const complete = totalSegments > 0 && loadedSegments >= totalSegments
  const segmentPart = complete
    ? `all ${totalSegments} ${totalSegments === 1 ? 'segment' : 'segments'} loaded`
    : `${loadedSegments} of ${totalSegments} ${totalSegments === 1 ? 'segment' : 'segments'} loaded`
  return {
    loadedSegments,
    totalSegments,
    loadedTurns,
    totalTurns,
    complete,
    filesText: complete
      ? `derived from all ${loadedTurns} loaded ${loadedTurns === 1 ? 'turn' : 'turns'}`
      : `derived from ${loadedTurns} of ${totalTurns} turns, ${segmentPart}`,
  }
}

/** Whether every covering segment a window descriptor names is in hand. */
export function windowCoverage(window, segments) {
  if (!window || !Array.isArray(window.segments) || window.segments.length === 0) {
    return { required: false, complete: true, missing: [], indexes: [] }
  }
  const loaded = new Set(normaliseSegments(segments).map((segment) => segment.index))
  const missing = window.segments.filter((index) => !loaded.has(index))
  return { required: true, complete: missing.length === 0, missing, indexes: [...window.segments] }
}

/** The mounted-card bound: the turns of the loaded segments, and nothing else. */
export function mountedCardBound(segments) {
  return normaliseSegments(segments).reduce((sum, segment) => sum + segment.turns.length, 0) + SEGMENT_OVERSCAN_TURNS
}

/** The Files tab derived from the turns in hand: file, read/edit/write counts, churn,
    and the first loaded turn that touched it. The one derivation lives in `adapter.js`,
    so a segmented viewer and a whole-transcript view model cannot disagree. */
export function loadedFiles(turns) {
  return buildFiles(turns ?? [])
}

/** Tool-group counts scoped to the turns the viewer actually holds. */
export function loadedToolGroupCounts(turns) {
  return buildToolGroupCounts(turns ?? [])
}

/** Whether a turn is a wordless assistant turn: a run of model actions that may have
    started in a segment the reader has not loaded. */
export function isWordlessAssistant(turn) {
  return !!turn && turn.role === 'assistant' && String(turn.displayContent ?? turn.content ?? '').trim() === ''
}
