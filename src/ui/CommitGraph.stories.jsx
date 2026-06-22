import { useState } from 'react'
import CommitGraph from './CommitGraph.jsx'
import { frame } from './story-frame.jsx'

/* CommitGraph story. CSF3 under 'in use/' — a realistic source-control history, newest at the
   top. Default carries a feature branch (lane 1) that forks off the main line (lane 0) and merges
   back, ~9 commits, a few with recorded sessions behind them (filled dots + sparkle), one merge
   commit. Linear is the single-lane case. classes + tokens come from CommitGraph.css (imported by
   the component) and src/index.css via .storybook/preview.jsx; the theme toolbar flips data-theme.
   Selection is wired through a small stateful wrapper so the amber active-row treatment is visible. */

/* A worked-on feature branch ("ingest pipeline") that forks at c8, runs on lane 1, then folds
   back into the main line at the merge commit c2. Newest first. Messages + branch names are USER
   CONTENT — their case is preserved; only the chrome around them is lowercase. */
const HISTORY = [
  {
    id: 'c1',
    lane: 0,
    parents: ['c2'],
    message: 'Bump pipeline schema to v3',
    branch: 'main',
    time: '4m ago',
  },
  {
    id: 'c2',
    lane: 0,
    parents: ['c3', 'c4'],
    message: 'Merge branch feat/ingest-loader',
    branch: 'main',
    merged: true,
    session: true,
    time: '22m ago',
  },
  {
    id: 'c4',
    lane: 1,
    parents: ['c5'],
    message: 'fix null-guard in typecheck',
    branch: 'feat/ingest-loader',
    tip: true,
    session: true,
    time: '38m ago',
  },
  {
    id: 'c5',
    lane: 1,
    parents: ['c6'],
    message: 'add sqlite pending store',
    branch: 'feat/ingest-loader',
    session: true,
    time: '1h ago',
  },
  {
    id: 'c6',
    lane: 1,
    parents: ['c8'],
    message: 'stream the ingest loader',
    branch: 'feat/ingest-loader',
    time: '2h ago',
  },
  {
    id: 'c3',
    lane: 0,
    parents: ['c8'],
    message: 'Tidy config defaults on main',
    branch: 'main',
    time: '3h ago',
  },
  {
    id: 'c8',
    lane: 0,
    parents: ['c9'],
    message: 'Extract the ingest interface',
    branch: 'main',
    session: true,
    time: '5h ago',
  },
  {
    id: 'c9',
    lane: 0,
    parents: ['c10'],
    message: 'Wire the worker queue',
    branch: 'main',
    time: 'yesterday',
  },
  {
    id: 'c10',
    lane: 0,
    parents: [],
    message: 'Initial commit',
    branch: 'main',
    time: '2d ago',
  },
]

const LINEAR = [
  {
    id: 'l1',
    lane: 0,
    parents: ['l2'],
    message: 'Release 1.4.0',
    branch: 'main',
    tip: true,
    time: '10m ago',
  },
  {
    id: 'l2',
    lane: 0,
    parents: ['l3'],
    message: 'add sqlite pending store',
    branch: 'main',
    session: true,
    time: '1h ago',
  },
  {
    id: 'l3',
    lane: 0,
    parents: ['l4'],
    message: 'fix null-guard in typecheck',
    branch: 'main',
    session: true,
    time: '3h ago',
  },
  {
    id: 'l4',
    lane: 0,
    parents: [],
    message: 'stream the ingest loader',
    branch: 'main',
    time: 'yesterday',
  },
]

/** Stateful wrapper so selecting a row lights the scarce amber treatment in the story canvas. */
function Demo({ commits, hasMore = false, initial }) {
  const [selectedId, setSelectedId] = useState(initial)
  return (
    <CommitGraph
      commits={commits}
      selectedId={selectedId}
      onSelect={(c) => setSelectedId(c.id)}
      hasMore={hasMore}
      onShowOlder={() => {}}
    />
  )
}

const meta = {
  title: 'in use/CommitGraph',
  component: CommitGraph,
  decorators: frame('wide'),
  parameters: { layout: 'centered' },
}

export default meta

export const Default = {
  render: () => <Demo commits={HISTORY} initial="c4" hasMore />,
}

export const Linear = {
  render: () => <Demo commits={LINEAR} initial="l2" />,
}
