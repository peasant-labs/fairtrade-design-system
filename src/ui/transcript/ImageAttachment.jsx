import { ImageOff } from 'lucide-react'
import { useId, useState } from 'react'
import Dialog from '../Dialog.jsx'
import { imageAltText, imageOmissionDetail, imagePartNotice } from './image-parts.js'
import { useImageUrl } from './image-url.js'

/* TranscriptImageAttachment — one recorded image block, inline in the turn's source order.

   The producer's part decides what a reader sees:
     • a present inline image (a content reference, no omission reason) draws as a bounded
       thumbnail, loaded lazily, and opens a larger view from the same control by mouse or
       keyboard (the trigger is a real button, so Enter and Space already work);
     • an omitted image (too large, an unsupported source type, a missing file, or withheld from
       a published transcript) draws a placeholder that names the reason and the recorded
       metadata. No URL is requested for it, so a published transcript never probes for bytes it
       was told are absent;
     • a present image the host cannot resolve (no `imageUrl`, or no URL for the ref) reads
       as unavailable rather than as a broken image glyph, and a load failure falls back the
       same way.

   DUMB: it renders one cooked part and never builds a URL itself. The host owns the route. */

/** @typedef {import('./view-model.js').ImagePartVM} ImagePartVM */

/**
 * @typedef {object} TranscriptImageAttachmentBaseProps
 * @property {ImagePartVM} [part]            the cooked image part
 * @property {number} [position=1]           1-based position among the turn's images
 * @property {number} [total=1]              how many images the turn carries
 */
/** @param {TranscriptImageAttachmentBaseProps & import('./image-url.js').ImageUrlProps} props */
export default function TranscriptImageAttachment({ part, position = 1, total = 1, imageUrl, attachmentUrl }) {
  const resolvedImageUrl = useImageUrl(imageUrl, attachmentUrl)
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState(false)
  const dialogTitleId = useId()
  if (!part) return null
  const image = part.image ?? {}
  const notice = imagePartNotice(image)
  const ref = typeof image.ref === 'string' ? image.ref : ''
  const url = notice.present && ref !== '' && typeof resolvedImageUrl === 'function' ? resolvedImageUrl(ref) : ''
  const alt = imageAltText(image, position, total)

  if (!notice.present || failed || !url) {
    /* a failed load and an unresolvable ref both mean the same to a reader: the image is not here */
    const title = notice.present || failed ? 'image unavailable' : notice.title
    const detail = notice.present ? '' : imageOmissionDetail(image)
    return (
      <div className="txn-image-omitted" data-image-omitted={notice.present ? 'unavailable' : (image.omittedReason ?? 'unavailable')}>
        <ImageOff size={14} aria-hidden="true" />
        <span className="txn-image-omitted-title">{title}</span>
        {detail !== '' && <span className="txn-image-omitted-detail">{detail}</span>}
      </div>
    )
  }

  const caption = total > 1 ? `image ${position} of ${total}` : 'image'
  return (
    <figure className="txn-image">
      <button
        type="button"
        className="txn-image-open"
        data-image-open={position}
        aria-label={`expand ${alt}`}
        onClick={() => setExpanded(true)}
      >
        <img
          className="txn-image-thumb"
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </button>
      <figcaption className="txn-image-caption tnum">{caption}</figcaption>
      <Dialog open={expanded} onClose={() => setExpanded(false)} title={caption} labelId={dialogTitleId} size="wide">
        <img className="txn-image-full" src={url} alt={alt} />
      </Dialog>
    </figure>
  )
}
