import { useRef } from 'react'
import './timelinePrimitives.css'

/* The ranked entry list's rank-mode segmented control
   (relevance | debt | churn), wired to the frozen `set-rank-mode` action.
   A native <button role="radio"> group inside a `role="radiogroup"`. The active
   mode is the single tab stop; arrow keys wrap, Home/End jump to the bounds,
   and moving focus activates the focused mode. */

const MODES = /** @type {const} */ (['relevance', 'debt', 'churn'])

/**
 * @param {object} props
 * @param {'relevance'|'debt'|'churn'} props.rankMode
 * @param {(rankMode: 'relevance'|'debt'|'churn') => void} props.onChange
 * @param {string} [props.className]
 */
export default function RankModeControl({ rankMode, onChange, className = '', ...rest }) {
  const buttonsRef = useRef([])

  const moveTo = (index) => {
    const mode = MODES[index]
    if (!mode) return
    onChange(mode)
    buttonsRef.current[index]?.focus()
  }

  const handleKeyDown = (event, index) => {
    let nextIndex
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % MODES.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + MODES.length) % MODES.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = MODES.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    moveTo(nextIndex)
  }

  return (
    <span className={`tlp-rank-mode${className ? ` ${className}` : ''}`} role="radiogroup" aria-label="rank mode" {...rest}>
      {MODES.map((mode, index) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={rankMode === mode}
          tabIndex={rankMode === mode ? 0 : -1}
          ref={(element) => {
            buttonsRef.current[index] = element
          }}
          className={`tlp-rank-mode-btn${rankMode === mode ? ' tlp-rank-mode-btn-active' : ''}`}
          onClick={() => onChange(mode)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {mode}
        </button>
      ))}
      <span className="tlp-sr" role="status" aria-live="polite">{`rank mode: ${rankMode}`}</span>
    </span>
  )
}

export { MODES as RANK_MODE_CONTROL_MODES }
