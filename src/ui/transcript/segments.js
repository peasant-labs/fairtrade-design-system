/* Transcript segments — the loaded-region model the reader surface renders.

   The transcript is a document cut into ~1 MiB segments on clean turn boundaries.
   A host loads one segment at a time (or a window's covering run) and this module
   turns those loaded pieces into everything the viewer needs to be honest about
   what it has read:

     • the loaded turn ranges (regions), with adjacent segments merged;
     • one boundary per unloaded edge, naming the conversation turns it stands in
       front of when the directory carries positions, and its segments and bytes
       when it does not;
     • a bounded scrubber sample of `min(200, totalSegments)` ticks;
     • the scope sentence the filters rail and the Files tab state;
     • the covering-segment set a window descriptor still needs.

   Every function is pure. Nothing here fetches, and nothing here parses wire:
   the host cooks wire turns into `TurnVM`s before handing a segment over, exactly
   as it does for a whole-transcript view model.

   `TurnVM` carries `segmentIndex`, `truncated` and `byteLength` when it came from
   a segment read; the truncation notice and the mounted-card bound read them. */

import { isConversationTurn } from '@peasant-labs/schema'
import { buildFiles, buildToolGroupCounts } from './adapter.js'
import { formatInteger } from '../format.js'
import { hasImageParts } from './image-parts.js'

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/** The scrubber's fixed sample size; the mounted tick count is `min(this, totalSegments)`. */
export const SEGMENT_SCRUBBER_TICKS = 200

/** Extra turns a mounted region may draw beyond the turns it was given. The viewer
    never invents turn content, so the overscan budget stays zero and the bound is the
    loaded segments' own turns. Named so a surface cannot quietly grow it. */
export const SEGMENT_OVERSCAN_TURNS = 0

/**
 * Where one segment sits in the session's conversation turns. Counts, never identities.
 * @typedef {object} ConversationTurnSpanVM
 * @property {number} before   conversation turns in every earlier segment of the session
 * @property {number} count    conversation turns in this segment; may be 0
 */

/**
 * A run of conversation turns stated against the session total. A reader's range is
 * `before + 1` through `before + count`.
 * @typedef {object} ConversationPositionVM
 * @property {number} before
 * @property {number} count
 * @property {number} total
 */

/**
 * One segment reference from the directory.
 * @typedef {object} SegmentRefVM
 * @property {number} index
 * @property {number} firstTurn
 * @property {number} lastTurn
 * @property {number} byteLength
 * @property {ConversationTurnSpanVM} [conversationTurns]
 */

/**
 * The transcript's only global index.
 * @typedef {object} SegmentDirectoryVM
 * @property {string} [sessionId]
 * @property {string} [revision]
 * @property {number} totalTurns
 * @property {number} totalSegments
 * @property {number} [totalConversationTurns]  the total a position is stated against. A host passes a directory its server validated; absent means no position is shown
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
 * @property {ConversationPositionVM | null} position   the conversation turns behind this edge, or null when the directory does not carry them for every segment of the gap
 */

/**
 * One entry of the scrubber's segment sample.
 * @typedef {object} ScrubberTick
 * @property {string} key
 * @property {number} index
 * @property {number} firstTurn
 * @property {number} lastTurn
 * @property {string} label       the tick's title: its conversation turns, or its segment ordinal
 * @property {string} valueText   the slider's value text while this tick is active
 * @property {number} leftPct
 * @property {ConversationPositionVM | null} position
 */

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

/** The directory's conversation-turn total, or null when it sent none. Every position
    is stated against it, so without it no surface names a position. */
const conversationTotal = (directory) => (isFiniteNumber(directory?.totalConversationTurns) ? directory.totalConversationTurns : null)

/** Whether a ref carries its span. Presence only: the counts are the producer's, and
    are trusted exactly as `index` and `byteLength` are. */
const hasSpan = (ref) => isFiniteNumber(ref?.conversationTurns?.before) && isFiniteNumber(ref?.conversationTurns?.count)

/** The conversation turns a run of refs covers, from its first and last span. No count
    is summed. The caller has already checked that every ref of the run carries a span. */
function positionOf(total, refs) {
  const first = refs[0].conversationTurns
  const last = refs[refs.length - 1].conversationTurns
  return { before: first.before, count: last.before + last.count - first.before, total }
}

/** The unit beside a turn count: the singular for exactly one. Every turn-count sentence
 * takes its unit here, from the number it sits beside (the total in an "of" pair). */
export function turnUnit(count) {
  return count === 1 ? 'turn' : 'turns'
}

/** A position's range in a reader's one-based numbering, without its total. */
function positionRange(position) {
  if (position.count === 0) return 'no conversation turns'
  const first = `${turnUnit(position.count)} ${formatInteger(position.before + 1)}`
  return position.count === 1 ? first : `${first}–${formatInteger(position.before + position.count)}`
}

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
  const conversationTurns = conversationTotal(directory)
  /* One pass over the gap: the refs the directory has received for it, and whether every
     segment of the gap has one that carries a span. A gap that reaches into a directory
     page not yet received, or a ref without a span, names no position. */
  const gapRefs = (from, to) => {
    const list = []
    let positioned = conversationTurns != null
    for (let index = from; index <= to; index += 1) {
      const ref = byIndex.get(index)
      if (ref) list.push(ref)
      if (!hasSpan(ref)) positioned = false
    }
    return { list, positioned }
  }
  const make = (side, { list, positioned }, loadSegment) => {
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
      position: positioned ? positionOf(conversationTurns, list) : null,
    }
  }
  if (regions.length === 0) {
    const all = gapRefs(0, total - 1)
    const boundary = make('all', all, all.list[0]?.index ?? 0)
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

/** The boundary's caption: the conversation turns behind that edge against the session
    total. A gap that holds none, and a directory that sent no positions, name the
    unloaded extent in segments and bytes. */
export function boundaryCaption(boundary) {
  const segments = `${boundary.segmentCount} ${boundary.segmentCount === 1 ? 'segment' : 'segments'}`
  const extent = `${segments}, ${formatByteExtent(boundary.byteLength)}`
  const position = boundary.position
  if (position == null) return extent
  if (position.count === 0) return `${positionRange(position)}, ${extent}`
  return `${positionRange(position)} of ${formatInteger(position.total)}`
}

/** The jump-failure sentence. It names the conversation turns of the segments the failed
    window covers, or of the segment that holds the anchor when no descriptor arrived.
    Without a position it names no number: a turn identity is not a reader's position. */
export function windowFailureCaption(directory, failure) {
  const refs = refsOf(directory, [])
  const covering = Array.isArray(failure?.segments) && failure.segments.length > 0
    ? failure.segments.map((index) => refs.find((ref) => ref.index === index))
    : [refs.find((ref) => isFiniteNumber(failure?.anchor) && ref.firstTurn <= failure.anchor && failure.anchor <= ref.lastTurn)]
  const total = conversationTotal(directory)
  const position = total != null && covering.every(hasSpan) ? positionOf(total, covering) : null
  return position != null && position.count > 0
    ? `could not load the window around ${positionRange(position)}.`
    : 'could not load that part of the transcript.'
}

/**
 * The fixed scrubber sample over the directory. Never one tick per turn.
 * @param {SegmentDirectoryVM | null | undefined} directory
 * @returns {ScrubberTick[]}
 */
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
  const conversationTurns = conversationTotal(directory)
  const byIndex = new Map(refs.map((ref) => [ref.index, ref]))
  return [...indexes].sort((a, b) => a - b).map((index) => {
    const ref = byIndex.get(index) ?? { index, firstTurn: index, lastTurn: index, byteLength: 0 }
    const position = conversationTurns != null && hasSpan(ref) ? positionOf(conversationTurns, [ref]) : null
    const ordinal = `segment ${formatInteger(index + 1)} of ${formatInteger(total)}`
    return {
      key: `segment-tick-${index}`,
      index,
      firstTurn: ref.firstTurn,
      lastTurn: ref.lastTurn,
      label: position ? positionRange(position) : ordinal,
      valueText: position == null
        ? ordinal
        : position.count === 0 ? `${positionRange(position)}, ${ordinal}` : `${positionRange(position)} of ${formatInteger(position.total)}`,
      leftPct: total > 1 ? (index / (total - 1)) * 100 : 0,
      position,
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
  /* With a directory total the sentence is in conversation turns, the unit the header
     and every boundary use. The held count is never compared with the total. */
  const totalConversationTurns = conversationTotal(directory)
  const loadedConversationTurns = regions.reduce((sum, region) => sum + region.turns.filter(isConversationTurn).length, 0)
  const segmentPart = complete
    ? `all ${totalSegments} ${totalSegments === 1 ? 'segment' : 'segments'} loaded`
    : `${loadedSegments} of ${totalSegments} ${totalSegments === 1 ? 'segment' : 'segments'} loaded`
  return {
    loadedSegments,
    totalSegments,
    loadedTurns,
    totalTurns,
    complete,
    loadedConversationTurns,
    totalConversationTurns,
    filesText: totalConversationTurns == null
      ? complete
        ? `derived from all ${formatInteger(loadedTurns)} loaded ${turnUnit(loadedTurns)}`
        : `derived from ${formatInteger(loadedTurns)} of ${formatInteger(totalTurns)} ${turnUnit(totalTurns)}, ${segmentPart}`
      : complete
        ? `derived from all ${formatInteger(totalConversationTurns)} loaded ${turnUnit(totalConversationTurns)}`
        : `derived from ${formatInteger(loadedConversationTurns)} of ${formatInteger(totalConversationTurns)} ${turnUnit(totalConversationTurns)}, ${segmentPart}`,
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
  // An image is content of its own. A turn that carries one is not a continuation of
  // model actions from an unloaded segment, even when its text is empty.
  return !!turn && turn.role === 'assistant' && !hasImageParts(turn) && String(turn.displayContent ?? turn.content ?? '').trim() === ''
}
