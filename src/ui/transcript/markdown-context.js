import { createContext } from 'react'

/* Direct TranscriptMarkdown consumers retain their established behavior. The viewer supplies
   the policy once so it also reaches system, control, content-part and earlier-history bodies. */
export const MarkdownContext = createContext(Object.freeze({ allowImages: true, turnHeadingLevel: null }))
