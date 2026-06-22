import { expect, within, userEvent, waitFor } from 'storybook/test'
import DiffView from './DiffView.jsx'
import { frame } from './story-frame.jsx'

/* DiffView story. CSF3, title 'in use/DiffView'. two shapes on one chassis:
   - Default: a realistic 2-hunk Go diff (add a null-guard in a handler, convert a buffered
     loader to a streaming read) with context lines around each change.
   - Redaction: 3 matches (api key, email, bearer token) each redacted to a placeholder,
     each carrying a category·confidence badge + a keep/revert button.

   the theme toolbar flips data-theme; the LightTheme story pins light. classes + diff
   tokens come from src/index.css; the dv-* rules come from DiffView.css. */

// ── Default: a 2-hunk Go diff ───────────────────────────────────────────────
// hunk 1 — add a null-guard before dereferencing the looked-up session.
// hunk 2 — replace a buffered ReadAll loader with a streaming io.Copy.
const goHunks = [
  {
    header: '-18,7 +18,10 @@ func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {',
    lines: [
      { type: 'ctx', oldNo: 18, newNo: 18, text: '\tid := chi.URLParam(r, "id")' },
      { type: 'ctx', oldNo: 19, newNo: 19, text: '\tsess := h.store.Lookup(id)' },
      { type: 'del', oldNo: 20, text: '\treturn sess.Render(w)' },
      { type: 'add', newNo: 20, text: '\tif sess == nil {' },
      { type: 'add', newNo: 21, text: '\t\thttp.Error(w, "not found", http.StatusNotFound)' },
      { type: 'add', newNo: 22, text: '\t\treturn nil' },
      { type: 'add', newNo: 23, text: '\t}' },
      { type: 'add', newNo: 24, text: '\treturn sess.Render(w)' },
      { type: 'ctx', oldNo: 21, newNo: 25, text: '}' },
    ],
  },
  {
    header: '-41,8 +44,9 @@ func loadTranscript(path string) (*Transcript, error) {',
    lines: [
      { type: 'ctx', oldNo: 41, newNo: 44, text: '\tf, err := os.Open(path)' },
      { type: 'ctx', oldNo: 42, newNo: 45, text: '\tif err != nil {' },
      { type: 'ctx', oldNo: 43, newNo: 46, text: '\t\treturn nil, err' },
      { type: 'ctx', oldNo: 44, newNo: 47, text: '\t}' },
      { type: 'del', oldNo: 45, text: '\tbuf, err := io.ReadAll(f)' },
      { type: 'del', oldNo: 46, text: '\treturn parse(buf)' },
      { type: 'add', newNo: 48, text: '\tdefer f.Close()' },
      { type: 'add', newNo: 49, text: '\treturn parseStream(bufio.NewReader(f))' },
      { type: 'ctx', oldNo: 47, newNo: 50, text: '}' },
    ],
  },
]

// ── Redaction: 3 matches → placeholders ──────────────────────────────────────
const redactionMatches = [
  {
    id: 'r1',
    category: 'api-key',
    confidence: 0.98,
    oldNo: 12,
    newNo: 12,
    original: 'const STRIPE_KEY = "sk_live_4eC39HqLyjWDarjtT1zdp7dc"',
    replacement: 'const STRIPE_KEY = "sk_live_••••••••••••••••••••dc"',
  },
  {
    id: 'r2',
    category: 'email',
    confidence: 0.91,
    oldNo: 27,
    newNo: 27,
    original: '// reported by vitor.hw@outlook.com on the 0.4 rollout',
    replacement: '// reported by ‹redacted-email› on the 0.4 rollout',
  },
  {
    id: 'r3',
    category: 'bearer-token',
    confidence: 0.64,
    oldNo: 53,
    newNo: 53,
    original: '\tAuthorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"',
    replacement: '\tAuthorization: "Bearer ‹redacted-token›"',
  },
]

const meta = {
  title: 'in use/DiffView',
  component: DiffView,
  tags: ['autodocs'],
  decorators: frame('wide'),
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'redaction'] },
    file: { control: 'text' },
    hunks: { control: false },
    matches: { control: false },
  },
}
export default meta

export const Default = {
  args: {
    file: 'internal/server/handler.go',
    variant: 'default',
    hunks: goHunks,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the file header carries the path + the +N/−N churn (7 adds, 3 dels here).
    expect(canvas.getByText('internal/server/handler.go')).toBeInTheDocument()
    expect(canvas.getByText('+7')).toBeInTheDocument()
    expect(canvas.getByText('−3')).toBeInTheDocument()

    // both hunk ranges render verbatim, not lowercased.
    expect(canvas.getByText(/func \(h \*Handler\) Session/)).toBeInTheDocument()

    // an added line keeps its case (code content is never lowercased).
    expect(canvas.getByText(/http\.StatusNotFound/)).toBeInTheDocument()
  },
}

export const Redaction = {
  args: {
    file: 'config/secrets.go',
    variant: 'redaction',
    matches: redactionMatches,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the header tallies the redacted count.
    expect(canvas.getByText('redacted')).toBeInTheDocument()

    // each match shows its category · confidence badge.
    expect(canvas.getByText('api-key')).toBeInTheDocument()
    expect(canvas.getByText('0.98')).toBeInTheDocument()
    expect(canvas.getByText('bearer-token')).toBeInTheDocument()

    // keep/revert: pressing "keep" un-redacts the first match and flags it.
    const keepButtons = canvas.getAllByRole('button', { name: /keep/i })
    expect(keepButtons[0]).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(keepButtons[0])
    await waitFor(() => {
      expect(keepButtons[0]).toHaveAttribute('aria-pressed', 'true')
    })
    expect(canvas.getByText('un-redacted')).toBeInTheDocument()
  },
}

export const Empty = {
  args: {
    file: 'docs/README.md',
    variant: 'default',
    hunks: [],
  },
}

export const RedactionEmpty = {
  args: {
    file: 'config/clean.go',
    variant: 'redaction',
    matches: [],
  },
}

export const LightTheme = {
  args: {
    file: 'internal/server/handler.go',
    variant: 'default',
    hunks: goHunks,
  },
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}
