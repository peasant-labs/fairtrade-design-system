// @ts-check

import { resolveTranscriptInitialPosition } from './initial-position.js'

const resolved = resolveTranscriptInitialPosition({
  initialPosition: null,
  fallbackInitialPosition: undefined,
  legacyInitialPosition: undefined,
  explicitUsed: false,
  fallbackUsed: false,
})

/** @type {import('./state-capabilities.js').TranscriptInitialPosition | null} */
const nullablePosition = resolved.position

/** @type {import('./state-capabilities.js').TranscriptInitialPosition} */
// @ts-expect-error The runtime can return null after an explicit removal.
const nonNullablePosition = resolved.position

void nullablePosition
void nonNullablePosition
