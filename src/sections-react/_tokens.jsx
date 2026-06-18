import { Clipboard } from 'lucide-react'

/* ONE shared helper for the copy-token table cluster (color / spacing / controls / tokens).
   the four sections render byte-faithful .dtable markup from these primitives instead of
   each owning a hand-written <table>. no new CSS: every className, the square corners and the
   data-copy delegation hook are exactly what the static src/sections/*.html partials emit.

   the copy affordance MUST keep data-copy so App.jsx's delegated rootClick ([data-copy] ->
   navigator.clipboard.writeText + toast) copies the token; labelIconA11y also reads data-copy. */

/* the icon-only copy button. renders EXACTLY the partials' button:
     <button class="copy-token" data-copy="--x" aria-label="copy --x"><i data-lucide="clipboard"></i></button>
   with the lucide-react <Clipboard/> standing in for <i data-lucide="clipboard"> (App paints
   the partials' <i> via paintIcons; in JSX the component renders the same svg.lucide directly).
   `extra` carries the tokens-section inline copy spacing (style={{marginLeft:'var(--sp-2)'}}). */
export function CopyBtn({ token, ...extra }) {
  return (
    <button className="copy-token" data-copy={token} aria-label={'copy ' + token} {...extra}>
      <Clipboard aria-hidden="true" />
    </button>
  )
}

/* a literal-hex color chip. `c` is the raw value (e.g. '#cba35c'), never a themed var, so the
   swatch shows the actual color a row documents in both themes. matches <span class="dt-sw"
   style="--c:#cba35c"></span>. */
export function Swatch({ c }) {
  return <span className="dt-sw" style={{ '--c': c }} />
}

/* ---------------------------------------------------------------------------------------------
   TokenTable: one flexible .dtable all four cluster sections express declaratively.

   columns: array describing the <thead> and how each row cell renders. each column is:
     { key, header, className, tnum, swatch, style }
       key       row-object property to read the cell value from (also the cell identity)
       header    <th> text ('' for the trailing copy column header, like the partials)
       className base cell class: 'dt-name' | 'dt-val' | 'dt-role' (omit for a plain <td>)
       tnum      true -> append ' tnum' to className (tabular numerals)
       swatch    true -> this cell renders a leading <Swatch c={row.c}/> before its value
                 (color + the swatch rows in the controls token table)
       style     optional inline style object applied to every cell in the column
                 (tokens section's value column uses {width:'1%',whiteSpace:'nowrap'})
       copyInline true -> append CopyBtn for row.token INSIDE this cell, after the value,
                 with marginLeft var(--sp-2) (the tokens section's inline-in-value copy)

   rows: array of plain objects. each supplies the column `key` values, plus:
     c       hex for a swatch column (literal, passed to <Swatch/>)
     token   the value to copy; used by a trailing copy column or any copyInline column.
             defaults to row's name cell when omitted, but pass it explicitly when the copied
             token differs from the displayed text (spacing's `radius` row copies '0').

   copy: how/whether the copy affordance appears.
     'trailing'  -> append a trailing <th></th> + a <td><CopyBtn token={row.token}/></td>
                    column to every row (color / spacing / controls token tables).
     false/undefined -> no copy column at all (the controls "specs" table).
     for the tokens section's inline copy, set copy:false (no trailing column) and mark the
     value column copyInline:true instead.

   key: optional row-key extractor (row -> string); defaults to row.token ?? the first cell. */
export function TokenTable({ columns, rows, copy = false, rowKey }) {
  const keyOf = rowKey || ((r) => r.token ?? r[columns[0].key])
  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={col.key ?? 'col' + i}>{col.header ?? ''}</th>
            ))}
            {copy === 'trailing' && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyOf(row)}>
              {columns.map((col, i) => {
                const cls = (col.className || '') + (col.tnum ? ' tnum' : '')
                return (
                  <td key={col.key ?? 'col' + i} className={cls.trim() || undefined} style={col.style}>
                    {col.swatch && <Swatch c={row.c} />}
                    {col.swatch ? <span className="dt-name">{row[col.key]}</span> : row[col.key]}
                    {col.copyInline && (
                      <>
                        {' '}
                        <CopyBtn token={row.token ?? row[col.key]} style={{ marginLeft: 'var(--sp-2)' }} />
                      </>
                    )}
                  </td>
                )
              })}
              {copy === 'trailing' && (
                <td>
                  <CopyBtn token={row.token ?? row[columns[0].key]} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
