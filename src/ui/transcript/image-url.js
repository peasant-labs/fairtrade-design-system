import { useEffect } from 'react'

// JSDoc's @property syntax cannot attach @deprecated to one property in the
// generated declarations. This type-only shape keeps the annotation on the
// legacy property rather than deprecating the whole viewer props object.
class ImageUrlPropShape {
  /** Resolve a content reference to a browser-loadable image URL.
   * @type {((ref: string) => string | null | undefined) | undefined}
   */
  imageUrl

  /** @deprecated Use `imageUrl` instead.
   * @type {((ref: string) => string | null | undefined) | undefined}
   */
  attachmentUrl
}

/** @typedef {Partial<ImageUrlPropShape>} ImageUrlProps */

let warnedAboutBothResolvers = false

/**
 * Resolve at each public component boundary; composed children receive only
 * the canonical name. A failed resolution never falls back to the old prop.
 * @param {ImageUrlProps['imageUrl']} imageUrl
 * @param {ImageUrlProps['attachmentUrl']} attachmentUrl
 */
export function useImageUrl(imageUrl, attachmentUrl) {
  useEffect(() => {
    if (imageUrl == null || attachmentUrl == null || warnedAboutBothResolvers) return
    // Published library bundles preserve NODE_ENV for the consuming bundler.
    // A raw browser without that global safely remains silent.
    let development = false
    try { development = process.env.NODE_ENV !== 'production' } catch { /* no process global */ }
    if (development) {
      warnedAboutBothResolvers = true
      console.warn('Transcript image resolver: both imageUrl and deprecated attachmentUrl were supplied; imageUrl wins. Remove attachmentUrl.')
    }
  }, [imageUrl, attachmentUrl])
  return imageUrl ?? attachmentUrl
}
