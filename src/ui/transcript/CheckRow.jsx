/* CheckRow — a single labelled filter checkbox row, lifted verbatim from the canonical
   mockup (src/mockups/inuse/TranscriptApp.jsx:1791). DUMB + fully controlled: the caller
   owns `checked` and handles `onChange`. An optional trailing `count` shows the match tally.
   Exported as `TranscriptCheckRow`; assembled by the FiltersRail but reusable on its own for
   peasant/village filter shells.

   (No `@types/react` in this project — JSDoc stays React-agnostic, matching the other /ui
   components: children is `*`, the change handler a plain `Function`.) */

/**
 * @param {object} props
 * @param {boolean} [props.checked]
 * @param {Function} [props.onChange]   fired with the native change event
 * @param {*} [props.children]          the row label (text, or icon + text)
 * @param {number} [props.count]        optional trailing match count
 * @param {boolean} [props.disabled]
 */
export default function CheckRow({ checked = false, onChange = () => {}, children, count, disabled = false }) {
  return (
    <label className="txn-checkrow">
      <input type="checkbox" className="check-box" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="txn-cr-label">{children}</span>
      {count != null && <span className="txn-cr-count tnum">{count}</span>}
    </label>
  )
}
