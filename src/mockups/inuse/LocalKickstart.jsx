import { useMemo, useState } from 'react'
import { Button, SelectionTree, StepWizardFrame } from '../../ui'
import { KICKSTART_FOREST, KICKSTART_PREVIEWS, KICKSTART_SELECTION_STOP, KICKSTART_STOPS } from './kickstart-fixture.js'

/* The local app's setup wizard for the in-use graph demo (`?app=graph&view=kickstart`). Peasant
   serves it at /kickstart, outside the section registry, so the demo reaches it by route and keeps
   the registry unchanged. The frame is fairtrade's StepWizardFrame over peasant's ten stops; the
   selection stop is fairtrade's SelectionTree beside a preview of the row whose title was clicked.

   In peasant the server computes each row's tri-state from the selection. Here the demo stands in
   for the server: it rolls the selected session ids up into the row states it hands the tree. The
   tree itself never rolls state up. */

const SESSION = 'session'

/** Every row's children, in the order the server sent them. */
function childrenOf(forest) {
  const byParent = new Map()
  for (const row of forest) {
    if (!row.parentId) continue
    const list = byParent.get(row.parentId) ?? []
    list.push(row)
    byParent.set(row.parentId, list)
  }
  return byParent
}

const CHILDREN = childrenOf(KICKSTART_FOREST)
const INITIAL_SELECTION = KICKSTART_FOREST.filter((row) => row.kind === SESSION && row.state === 'all').map((row) => row.id)

/** The server's part, played by the demo: each row's state from the selected session ids. */
function withStates(selected) {
  const stateOf = (row) => {
    if (row.locked) return row.state
    if (row.kind === SESSION) return selected.has(row.id) ? 'all' : 'none'
    const states = (CHILDREN.get(row.id) ?? []).filter((child) => !child.locked).map(stateOf)
    if (states.length === 0) return 'none'
    if (states.every((state) => state === 'all')) return 'all'
    if (states.every((state) => state === 'none')) return 'none'
    return 'some'
  }
  return KICKSTART_FOREST.map((row) => ({ ...row, state: stateOf(row) }))
}

function PreviewPane({ previewId }) {
  const row = previewId === null ? null : KICKSTART_FOREST.find((node) => node.id === previewId) ?? null
  const lines = row === null ? null : KICKSTART_PREVIEWS[row.id] ?? []
  return (
    <aside className="iu-ks-preview" aria-label="preview">
      <h4 className="iu-ks-preview-title">{row === null ? 'preview a row' : <span className="iu-ks-preview-name">{row.label}</span>}</h4>
      {row === null ? (
        <p className="iu-ks-help">click a title to read the start of it. previewing does not select it. use its checkbox to import it.</p>
      ) : (
        <ul className="iu-ks-lines" aria-label="preview lines">
          {lines.map((line, index) => (
            <li key={`${index}:${line.label}`} className="iu-ks-line">
              <span className="iu-ks-line-label">{line.label}</span>
              <span className="iu-ks-line-text">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function SelectionStop() {
  const [selected, setSelected] = useState(INITIAL_SELECTION)
  const [previewId, setPreviewId] = useState(null)
  const nodes = useMemo(() => withStates(new Set(selected)), [selected])
  const sessions = KICKSTART_FOREST.filter((row) => row.kind === SESSION).length
  return (
    <div className="iu-ks-field">
      <p className="iu-ks-help">peasant imports the sessions you tick. a project or branch row ticks every session under it.</p>
      <div className="iu-ks-select">
        <div className="iu-ks-tree">
          <SelectionTree
            nodes={nodes}
            value={selected}
            onSelectionChange={setSelected}
            onPreview={setPreviewId}
            previewId={previewId}
            ariaLabel="sessions to import"
          />
        </div>
        <PreviewPane previewId={previewId} />
      </div>
      <p className="iu-ks-counts">
        <span className="tnum">{sessions}</span> sessions found, <span className="tnum">{selected.length}</span> chosen
      </p>
    </div>
  )
}

/** The setup wizard, opened on the selection stop with the connection stop answered. */
export default function KickstartView() {
  const [current, setCurrent] = useState(KICKSTART_SELECTION_STOP)
  const index = KICKSTART_STOPS.findIndex((stop) => stop.id === current)
  const completed = useMemo(() => new Set(KICKSTART_STOPS.slice(0, index).map((stop) => stop.id)), [index])
  const reachable = useMemo(() => new Set(KICKSTART_STOPS.slice(0, index + 1).map((stop) => stop.id)), [index])
  const stop = KICKSTART_STOPS[index]
  const last = index === KICKSTART_STOPS.length - 1
  return (
    <div className="iu-page iu-ks">
      <header className="iu-page-head">
        <h2 className="iu-page-title">set up peasant</h2>
      </header>
      <StepWizardFrame
        steps={KICKSTART_STOPS}
        current={current}
        completed={completed}
        reachable={reachable}
        onJump={setCurrent}
        aria-label="set up peasant"
        footStart={(
          <Button variant="ghost" disabled={index === 0} onClick={() => setCurrent(KICKSTART_STOPS[index - 1].id)}>
            back
          </Button>
        )}
        footEnd={(
          <Button variant="primary" disabled={last} onClick={() => setCurrent(KICKSTART_STOPS[index + 1].id)}>
            continue
          </Button>
        )}
      >
        <h3 className="iu-ks-stop">{stop.label}</h3>
        {current === KICKSTART_SELECTION_STOP
          ? <SelectionStop />
          : <p className="iu-ks-help">peasant asks this stop's question here. the demo draws the selection stop.</p>}
      </StepWizardFrame>
    </div>
  )
}
