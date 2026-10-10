import { createRoot } from 'react-dom/client'
import './site.css'
// The graph (.gmp-*, .tb-*) and analytics (.gan-*) surfaces style themselves ONLY from their
// shipped surface sheets; index.css carries none of their rules, so the app loads both sheets the
// same way a consumer imports graph.css and analytics.css.
import './lib-graph.css'
import './lib-analytics.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
