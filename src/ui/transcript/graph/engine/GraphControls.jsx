/* Monochrome zoom / fit / reset controls for the trajectory graph. Replaces the
   @xyflow default Controls component so the chrome stays inside the design
   system: lowercase labels, radius 0, token-driven surface and rule colours. */

import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'

/**
 * @typedef {object} GraphControlsProps
 * @property {string} [className]
 */

/**
 * The trajectory-graph viewport controls. Must render inside a `<ReactFlowProvider>`.
 * @param {GraphControlsProps} props
 * @returns {JSX.Element}
 */
export function GraphControls({ className = '' }) {
  const rf = useReactFlow()
  const cls = ['tb-graph-controls', className].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      <ControlButton label="zoom in" onClick={() => rf.zoomIn({ duration: 150 })}>
        <Plus size={12} strokeWidth={2} />
      </ControlButton>
      <ControlButton label="zoom out" onClick={() => rf.zoomOut({ duration: 150 })}>
        <Minus size={12} strokeWidth={2} />
      </ControlButton>
      <ControlButton label="fit view" onClick={() => rf.fitView({ padding: 0.1, duration: 250 })}>
        <Maximize2 size={11} strokeWidth={1.75} />
      </ControlButton>
      <ControlButton label="reset" onClick={() => rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 })}>
        <RotateCcw size={11} strokeWidth={1.75} />
      </ControlButton>
    </div>
  )
}

/**
 * @param {{ label: string, onClick: () => void, children: import('react').ReactNode }} props
 * @returns {JSX.Element}
 */
function ControlButton({ label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="tb-graph-controls-btn">
      {children}
    </button>
  )
}
