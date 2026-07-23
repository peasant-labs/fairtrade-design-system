// @ts-check

/** @typedef {{type:'open-change', change:{id:string, branch:string|null}} | {type:'open-session', sessionId:string, source:{kind:'commit', commit:{id:string, branch:string|null}}|{kind:'unlinked'}|{kind:'outside-window'}} | {type:'open-map'} | {type:'show-older'}} TimelineNavigationAction */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param {Record<string, unknown>} value @param {string[]} expected @returns {boolean} */
function hasExactFields(value, expected) {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && expected.slice().sort().every((field, index) => field === actual[index])
}

/** @param {unknown} value @returns {value is string} */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

/** @param {unknown} value @returns {value is string | null} */
function isNullableNonEmptyString(value) {
  return value === null || isNonEmptyString(value)
}

/**
 * Fail closed at untyped JavaScript boundaries before a host interprets a timeline gesture.
 * The accepted object shapes are exact so additions require an explicit contract change.
 *
 * @param {unknown} value
 * @returns {asserts value is TimelineNavigationAction}
 */
export function assertTimelineNavigationAction(value) {
  let valid = false

  if (isRecord(value) && typeof value.type === 'string') {
    if (value.type === 'open-change' && hasExactFields(value, ['type', 'change']) && isRecord(value.change)) {
      valid = hasExactFields(value.change, ['id', 'branch'])
        && isNonEmptyString(value.change.id)
        && isNullableNonEmptyString(value.change.branch)
    } else if (value.type === 'open-session' && hasExactFields(value, ['type', 'sessionId', 'source']) && isNonEmptyString(value.sessionId) && isRecord(value.source)) {
      if (value.source.kind === 'commit' && hasExactFields(value.source, ['kind', 'commit']) && isRecord(value.source.commit)) {
        valid = hasExactFields(value.source.commit, ['id', 'branch'])
          && isNonEmptyString(value.source.commit.id)
          && isNullableNonEmptyString(value.source.commit.branch)
      } else if ((value.source.kind === 'unlinked' || value.source.kind === 'outside-window') && hasExactFields(value.source, ['kind'])) {
        valid = true
      }
    } else if ((value.type === 'open-map' || value.type === 'show-older') && hasExactFields(value, ['type'])) {
      valid = true
    }
  }

  if (!valid) {
    throw new TypeError([
      'Timeline navigation action rejected.',
      'What went wrong: the value is not an exact supported TimelineNavigationAction.',
      'Why it happened: an untyped caller supplied an unknown action, missing context, or extra fields.',
      'Where: assertTimelineNavigationAction in @peasant-labs/fairtrade/graph.',
      'When: while crossing a JavaScript timeline-navigation boundary.',
      'What it means: the host cannot safely choose a route for this user gesture.',
      'How to fix: emit one documented open-change, open-session, open-map, or show-older action with its exact required fields.',
    ].join('\n'))
  }
}
