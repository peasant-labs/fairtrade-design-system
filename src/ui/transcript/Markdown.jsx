import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

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
  h1: ({ children, node: _node, ...props }) => <h1 className="txn-md-heading txn-md-heading-1" {...props}>{children}</h1>,
  /** @param {object} props */
  h2: ({ children, node: _node, ...props }) => <h2 className="txn-md-heading txn-md-heading-2" {...props}>{children}</h2>,
  /** @param {object} props */
  h3: ({ children, node: _node, ...props }) => <h3 className="txn-md-heading txn-md-heading-3" {...props}>{children}</h3>,
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
    <div className="txn-md-table-wrap">
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
  pre: ({ children, node: _node, ...props }) => (
    <div className="txn-md-code-wrap">
      <pre className="txn-md-code" {...props}>{children}</pre>
    </div>
  ),
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
    return <a className="txn-md-link" href={safeHref} {...props}>{children}</a>
  },
  /** @param {object} props */
  hr: ({ node: _node, ...props }) => <hr className="txn-md-rule" {...props} />,
  /** @param {object} props */
  del: ({ children, node: _node, ...props }) => <del className="txn-md-del" {...props}>{children}</del>,
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

  return (
    <div className="body txn-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={safeUrlTransform}
        components={markdownComponents}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}
