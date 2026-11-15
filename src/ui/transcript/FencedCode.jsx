import { Fragment, useEffect, useState } from 'react'
import { highlightCode } from './code-highlight.js'

/* Keep the original text on screen while the engine loads or whenever highlighting is unavailable.
   A completed request belongs to its exact source and language, not a later session's code block. */
export default function FencedCode({ source, language, className, preProps }) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    let active = true
    highlightCode(source, language).then((tokens) => {
      if (active) setResult({ source, language, tokens })
    })
    return () => { active = false }
  }, [source, language])
  const tokens = result?.source === source && result?.language === language ? result.tokens : null
  return (
    <div className="txn-md-code-wrap" tabIndex={0} role="region" aria-label="message code">
      <pre className="txn-md-code" {...preProps}>
        <code className={['txn-inlinecode', className].filter(Boolean).join(' ')} data-highlighted={tokens ? 'true' : undefined}>
          {tokens ? tokens.map((token, index) => token.className
            ? <span className={token.className} key={index}>{token.content}</span>
            : <Fragment key={index}>{token.content}</Fragment>) : source}
        </code>
      </pre>
    </div>
  )
}
