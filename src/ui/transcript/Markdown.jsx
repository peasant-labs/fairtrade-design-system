import MermaidBlock from './MermaidBlock.jsx'
import FencedCode from './FencedCode.jsx'
import { MarkdownContext } from './markdown-context.js'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { memo, useContext } from 'react'

/* Markdown is the transcript's untrusted-content boundary. The parser deliberately has no
   rehype-raw plugin, so source HTML stays text instead of becoming executable DOM. GFM supplies
   the structures that agent output commonly uses, while remark-breaks makes each ordinary source
   newline visible without changing block parsing. */

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const URL_BASE = 'https://fairtrade.invalid'
const ENCODED_CONTROL_CHARACTER = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i

/**
 * Keep URL handling fail-closed at the renderer boundary. Relative links and fragments remain
 * useful for host-owned navigation; explicitly-protocol links are limited to protocols that do
 * not execute transcript content in the browser.
 *
 * @param {unknown} value
 * @returns {string}
 */
function safeUrlTransform(value) {
  if (typeof value !== 'string') return ''
  const url = value.trim()
  if (!url) return ''

  try {
    const parsed = new URL(url, URL_BASE)
    const protocols = [parsed.protocol.toLowerCase()]

    /* micromark percent-encodes control characters in link destinations before this hook sees
       them. Parse that decoded form too, so a hidden scheme cannot bypass this boundary if a later
       URL consumer decodes the character before navigation. */
    if (ENCODED_CONTROL_CHARACTER.test(url)) {
      protocols.push(new URL(decodeURIComponent(url), URL_BASE).protocol.toLowerCase())
    }

    if (protocols.some((protocol) => !SAFE_PROTOCOLS.has(protocol))) return ''
    return url
  } catch {
    return ''
  }
}

/** @param {string | undefined} base @param {string | undefined} existing */
function classNames(base, existing) {
  return [base, existing].filter(Boolean).join(' ')
}

const markdownComponents = {
  /** @param {object} props */
  p: ({ children, node: _node, ...props }) => <p className="txn-md-prose" {...props}>{children}</p>,
  /** @param {object} props */
  ul: ({ children, className, node: _node, ...props }) => (
    <ul className={classNames('txn-md-list txn-md-list-ul', className)} {...props}>{children}</ul>
  ),
  /** @param {object} props */
  ol: ({ children, className, node: _node, ...props }) => (
    <ol className={classNames('txn-md-list txn-md-list-ol', className)} {...props}>{children}</ol>
  ),
  /** @param {object} props */
  li: ({ children, node: _node, ...props }) => <li className="txn-md-list-item" {...props}>{children}</li>,
  /** @param {object} props */
  blockquote: ({ children, node: _node, ...props }) => <blockquote className="txn-md-blockquote" {...props}>{children}</blockquote>,
  /** @param {object} props */
  table: ({ children, node: _node, ...props }) => (
    <div className="txn-md-table-wrap" tabIndex={0} role="region" aria-label="message table">
      <table className="txn-md-table" {...props}>{children}</table>
    </div>
  ),
  /** @param {object} props */
  thead: ({ children, node: _node, ...props }) => <thead {...props}>{children}</thead>,
  /** @param {object} props */
  tbody: ({ children, node: _node, ...props }) => <tbody {...props}>{children}</tbody>,
  /** @param {object} props */
  tr: ({ children, node: _node, ...props }) => <tr {...props}>{children}</tr>,
  /** @param {object} props */
  th: ({ children, node: _node, ...props }) => <th {...props}>{children}</th>,
  /** @param {object} props */
  td: ({ children, node: _node, ...props }) => <td {...props}>{children}</td>,
  /** @param {object} props */
  pre: ({ children, node: _node, ...props }) => {
    const code = _node?.children?.length === 1 ? _node.children[0] : null
    if (code?.tagName === 'code' && code.properties?.className?.includes('language-mermaid')) {
      const source = code.children?.map((child) => child.type === 'text' ? child.value : '').join('') ?? ''
      return <MermaidBlock source={source} />
    }
    if (code?.tagName === 'code' && code.children?.every((child) => child.type === 'text')) {
      const source = code.children.map((child) => child.value).join('')
      const classes = Array.isArray(code.properties?.className) ? code.properties.className : []
      const language = classes.find((name) => typeof name === 'string' && name.startsWith('language-'))?.slice(9) ?? ''
      return <FencedCode source={source} language={language} className={classes.join(' ')} preProps={props} />
    }
    return (
    <div className="txn-md-code-wrap" tabIndex={0} role="region" aria-label="message code">
      <pre className="txn-md-code" {...props}>{children}</pre>
    </div>
    )
  },
  /** @param {object} props */
  code: ({ children, className, node: _node, ...props }) => (
    <code className={classNames('txn-inlinecode', className)} {...props}>{children}</code>
  ),
  /** @param {object} props */
  a: ({ children, href, node: _node, ...props }) => {
    const safeHref = safeUrlTransform(href)
    if (!safeHref) {
      return <span className="txn-md-link-blocked" data-txn-link-blocked="true">{children}</span>
    }
    /* Untrusted transcript links stay same-tab, but always carry rel="noreferrer" as defense in
       depth: even a safe-protocol destination must not leak the transcript URL to the author's
       chosen host through the Referer header. Applied after spread props so a parsed attribute
       cannot weaken it. */
    return <a className="txn-md-link" href={safeHref} {...props} rel="noreferrer">{children}</a>
  },
  /** @param {object} props */
  hr: ({ node: _node, ...props }) => <hr className="txn-md-rule" {...props} />,
  /** @param {object} props */
  del: ({ children, node: _node, ...props }) => <del className="txn-md-del" {...props}>{children}</del>,
}

/* A source heading is nested beneath its containing turn. ARIA permits levels deeper than six;
   using a named heading rather than another h6 preserves hierarchy inside a deeply nested pane. */
function sourceHeading(depth, turnHeadingLevel) {
  return function MarkdownHeading({ children, node: _node, ...props }) {
    const level = turnHeadingLevel == null ? depth : turnHeadingLevel + depth
    const Heading = level <= 6 ? `h${level}` : 'div'
    return <Heading className={`txn-md-heading txn-md-heading-${depth}`} {...(level > 6 ? { role: 'heading', 'aria-level': level } : {})} {...props}>{children}</Heading>
  }
}

function imageComponent(allowImages) {
  return function MarkdownImage({ node: _node, src, alt, ...props }) {
    if (!allowImages || !src) return <span className="txn-md-image-blocked" data-txn-image-blocked="true">{allowImages ? 'image unavailable' : 'image not loaded in local preview'}{alt ? `: ${alt}` : ''}</span>
    return <img src={src} alt={alt ?? ''} {...props} />
  }
}

/* Only viewer levels 1..4 plus the standalone renderer are possible. These maps contain no
   transcript content and stay stable across the viewer's frequent chrome re-renders. */
const componentMaps = new Map()
function componentsFor(allowImages, turnHeadingLevel) {
  const key = `${allowImages ? 'images' : 'no-images'}:${turnHeadingLevel ?? 'standalone'}`
  if (!componentMaps.has(key)) componentMaps.set(key, {
    ...markdownComponents,
    h1: sourceHeading(1, turnHeadingLevel), h2: sourceHeading(2, turnHeadingLevel),
    h3: sourceHeading(3, turnHeadingLevel), h4: sourceHeading(4, turnHeadingLevel),
    h5: sourceHeading(5, turnHeadingLevel), h6: sourceHeading(6, turnHeadingLevel),
    img: imageComponent(allowImages),
  })
  return componentMaps.get(key)
}

/**
 * Render a cooked transcript body as safe, structured Markdown.
 *
 * `text` is the established public prop used by TurnCard. `source` is accepted as a compatible
 * alias for hosts that already describe the same value as a source string; when both are supplied,
 * the established `text` prop wins. The component remains intentionally wire-agnostic.
 *
 * @param {object} props
 * @param {string} [props.text]   the cooked markdown body (e.g. `TurnVM.content`)
 * @param {string} [props.source] a source alias for the cooked markdown body
 */
export default function Markdown({ text, source }) {
  const value = typeof text === 'string' ? text : typeof source === 'string' ? source : ''
  const { allowImages, turnHeadingLevel } = useContext(MarkdownContext)

  return (
    <div className="body txn-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={safeUrlTransform}
        components={componentsFor(allowImages, turnHeadingLevel)}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

// Reader chrome changes frequently while the transcript text stays unchanged.
// Avoid reparsing every mounted turn on width, rail and scroll updates.
export const MemoMarkdown = memo(Markdown)
