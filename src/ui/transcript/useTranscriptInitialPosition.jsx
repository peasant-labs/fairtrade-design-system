import { useLayoutEffect, useRef } from 'react'
import {
  advanceTranscriptInitialPositionConsumption,
  normalizeTranscriptInitialPosition,
  resolveTranscriptInitialPosition,
  shouldApplyTranscriptInitialPosition,
  transcriptInitialPositionToken,
} from './initial-position.js'

/**
 * Canonical layout consumer for transcript initial positions. It owns the
 * legacy mount snapshot, explicit-contract latch, null reset, token, consumed
 * state, StrictMode replay guard, readiness retries, and terminal consumption.
 *
 * @param {{
 *   sessionId?: string,
 *   initialPosition?: import('./state-capabilities.js').TranscriptInitialPosition | null,
 *   fallbackInitialPosition?: import('./state-capabilities.js').TranscriptInitialPosition | null,
 *   legacyInitialPosition?: import('./state-capabilities.js').TranscriptInitialPosition | null,
 *   readiness: readonly unknown[],
 *   apply: (position: import('./state-capabilities.js').TranscriptInitialPosition) => 'pending' | 'applied' | 'discarded',
 * }} options
 * @returns {{position: import('./state-capabilities.js').TranscriptInitialPosition | null, token: string | null}}
 */
export default function useTranscriptInitialPosition(options) {
  const legacySnapshotRef = useRef(undefined)
  if (legacySnapshotRef.current === undefined) {
    legacySnapshotRef.current = normalizeTranscriptInitialPosition(options.legacyInitialPosition)
  }

  const explicitContractUsedRef = useRef(false)
  const fallbackContractUsedRef = useRef(false)
  const resolved = resolveTranscriptInitialPosition({
    initialPosition: options.initialPosition,
    fallbackInitialPosition: options.fallbackInitialPosition,
    legacyInitialPosition: legacySnapshotRef.current,
    explicitUsed: explicitContractUsedRef.current,
    fallbackUsed: fallbackContractUsedRef.current,
  })
  explicitContractUsedRef.current = resolved.explicitUsed
  fallbackContractUsedRef.current = resolved.fallbackUsed
  const position = resolved.position
  const token = transcriptInitialPositionToken(options.sessionId, position)
  const consumedTokenRef = useRef(null)

  useLayoutEffect(() => {
    if (token == null || position == null) {
      consumedTokenRef.current = null
      return
    }
    if (!shouldApplyTranscriptInitialPosition(consumedTokenRef.current, token)) return
    const result = options.apply(position)
    consumedTokenRef.current = advanceTranscriptInitialPositionConsumption(consumedTokenRef.current, token, result)
  }, [token, position, options.apply, ...options.readiness])

  return { position, token }
}
