import { createRoot } from 'react-dom/client'
import './index.css'
// The graph in-use surfaces (CodeMap/Changes/ChangeDetail, mounted by
// mockups/inuse/GraphApp.jsx) style themselves via `.gmp-*` rules that live in
// lib-graph.css, NOT index.css — unlike a self-contained component such as
// MapCanvas.jsx (which side-effect-imports its own MapCanvas.css), CodeMap/
// Changes/ChangeDetail carry no CSS import of their own, so nothing pulls this
// bundle in automatically. Without this import the graph in-use demo falls back
// to unstyled block/inline flow (e.g. the CodeMap legend loses its flex/gap
// layout) even though the SAME markup renders correctly in Storybook once this
// stylesheet is present. Storybook (.storybook/preview.jsx) has the identical
// gap — tracked as a follow-up (this app entry's missing import is the demo-side
// half of the dual-legend layout finding: same component, same CSS, only the
// dev harness and now this entry actually load it).
import './lib-graph.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
