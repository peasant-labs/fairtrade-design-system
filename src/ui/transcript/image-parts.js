// @ts-check
/* image-parts — the pure rules behind one turn's ordered content parts.

   A turn's `contentParts` is the producer's ordered list of text and image blocks. The
   transcript renders EVERY block in source order, so an image that sat between two
   paragraphs reads where it was recorded rather than after the text. `content` remains the
   concatenated text fallback: a turn with no parts (every producer before content_parts_v1)
   renders exactly as it did.

   An image part may carry bytes (`ref` + `mediaType` + `byteSize`), or an omission reason
   saying why it cannot: too large, an unsupported source type, a missing file, or withheld
   from a published transcript. The renderer decides what a reader sees from the part's own
   recorded shape; it never re-derives a producer decision.

   Pure: no JSX, no DOM, no state. The component and the gates read the same rules. */

/** @typedef {import('./view-model.js').ContentPartVM} ContentPartVM */
/** @typedef {import('./view-model.js').ImagePartVM} ImagePartVM */
/** @typedef {import('@peasant-labs/schema').ImagePart} ImagePart */

/**
 * The producer's accepted per-image size limit, restated for the reader. This is COPY, not a
 * rule: the producer refuses an oversized image and records the omission; the transcript only
 * says why the bytes are missing. It decides nothing.
 * @type {number}
 */
export const IMAGE_BYTES_LIMIT = 16 * 1024 * 1024

/**
 * The omission reasons in the order the reader-facing copy names them.
 * @type {Readonly<Record<string, string>>}
 */
const OMISSION_COPY = Object.freeze({
  too_large: 'image too large',
  unsupported: 'image type not supported',
  missing: 'image unavailable',
  not_published: 'image not published',
})

/**
 * The text a reader sees in place of an image's bytes. A part with a ref and no omission
 * reason is present; every other shape explains itself without inventing evidence.
 * @param {ImagePart | null | undefined} image
 * @returns {{ present: boolean, title: string, detail: string }}
 */
export function imagePartNotice(image) {
  const part = image ?? {}
  const reason = typeof part.omittedReason === 'string' ? part.omittedReason : ''
  if (reason === '') return { present: true, title: '', detail: '' }
  const title = OMISSION_COPY[reason] ?? 'image unavailable'
  return { present: false, title, detail: imageOmissionDetail(part) }
}

/**
 * The recorded metadata line under an image, e.g. `image/png, 1200 by 800 pixels, 4 MiB`.
 * Facts only, in the recorded case: a media type and dimensions are evidence.
 * @param {ImagePart | null | undefined} image
 * @returns {string}
 */
export function imagePartMetadata(image) {
  const part = image ?? {}
  const width = part.width ?? 0
  const height = part.height ?? 0
  const byteSize = part.byteSize ?? 0
  /** @type {string[]} */
  const facts = []
  if (part.mediaType) facts.push(part.mediaType)
  if (width > 0 && height > 0) facts.push(`${width} by ${height} pixels`)
  if (byteSize > 0) facts.push(formatImageBytes(byteSize))
  return facts.join(', ')
}

/**
 * The size copy for an omission reason. `too_large` never records the byte size, so the
 * placeholder states the producer's limit instead of guessing the measurement.
 * @param {ImagePart | null | undefined} image
 * @returns {string}
 */
export function imageOmissionDetail(image) {
  const part = image ?? {}
  const recorded = imagePartMetadata(part)
  if (part.omittedReason === 'too_large') {
    return recorded === '' ? `over the ${formatImageBytes(IMAGE_BYTES_LIMIT)} limit` : `${recorded} (over the ${formatImageBytes(IMAGE_BYTES_LIMIT)} limit)`
  }
  return recorded
}

/**
 * A byte count as a reader reads it: whole MiB above a mebibyte, whole KiB above a kibibyte,
 * bytes below that. Tabular-friendly and never a long decimal.
 * @param {number} bytes
 * @returns {string}
 */
export function formatImageBytes(bytes) {
  const value = typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0 ? bytes : 0
  if (value >= 1024 * 1024) return `${Math.round(value / (1024 * 1024))} MiB`
  if (value >= 1024) return `${Math.round(value / 1024)} KiB`
  return `${value} bytes`
}

/**
 * The image's alt text. A wire image carries no author-written description, so the text
 * states the recorded facts a reader can use: its place in the turn and the metadata the
 * producer kept. Never empty, so the image is never announced as an unnamed graphic.
 * @param {ImagePart | null | undefined} image
 * @param {number} position  1-based position among the turn's images
 * @param {number} total     how many images the turn carries
 * @returns {string}
 */
export function imageAltText(image, position, total) {
  const where = total > 1 ? `image ${position} of ${total}` : `image ${position}`
  const metadata = imagePartMetadata(image)
  return metadata === '' ? where : `${where}, ${metadata}`
}

/**
 * The turn's parts that are images, in source order.
 * @param {ContentPartVM[] | null | undefined} parts
 * @returns {ImagePartVM[]}
 */
export function imageParts(parts) {
  return (parts ?? []).filter((part) => part?.type === 'image')
}

/**
 * Whether a cooked turn carries an image part. Used where a turn must not be dropped or
 * collapsed as if it held no content of its own.
 * @param {{ contentParts?: ContentPartVM[] } | null | undefined} turn
 * @returns {boolean}
 */
export function hasImageParts(turn) {
  return imageParts(turn?.contentParts).length > 0
}

/**
 * The images in a turn that can actually be loaded: a present inline image whose host supplied
 * a URL. Used to count what a reader could see, never to drop a recorded part.
 * @param {ContentPartVM[] | null | undefined} parts
 * @param {(ref: string) => string | null | undefined} [attachmentUrl]
 * @returns {number}
 */
export function renderableImageCount(parts, attachmentUrl) {
  if (typeof attachmentUrl !== 'function') return 0
  return imageParts(parts).filter((part) => {
    const image = part.image
    const ref = typeof image?.ref === 'string' ? image.ref : ''
    return ref !== '' && !image?.omittedReason && !!attachmentUrl(ref)
  }).length
}
