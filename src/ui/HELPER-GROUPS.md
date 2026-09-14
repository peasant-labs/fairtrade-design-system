# helper groups

Import `HelperGroup`, `HelperGroupListItem`, and `HelperThreadRow` from
`@peasant-labs/fairtrade/ui`, with the package's tokens, base, and components CSS.

These components render authorized list results. They do not parse a wire payload,
infer membership, fetch data, or hold a group selection. The host validates its
released schema read DTO, retains its original route-specific row, and supplies
fetching, routing, authorization, eligibility, and explicit selection callbacks.

## composition

- A `HelperGroupListItem` is ONE tree: the ordinary row a host retains as `owner`,
  then the immediate `HelperGroup` children that hang off it. Its selection and
  ordinary child exits stay intact. Keep distinct unresolved containers keyed by
  their distinct backend group IDs.
- The owner row anchors the tree: its checkbox, its verbatim title, and its mono
  facts line with middot separators. Ticking the owner is the tree's default
  auto-select: it selects the owner and every helper member disclosed under it;
  unticking the owner clears the owner and those members.
- Each `HelperGroup` steps ONE indent (`--sp-7`) inside the tree, and its count
  chip sits inside that step, between the owner row and the members it discloses.
  The chip carries no checkbox of its own and reads like the session-group
  disclosure the product already uses: full-width, a comfortable target, a leading
  chevron, the count in tabular mono, `, N selected` when members are selected,
  and `show`/`hide` on the trailing edge.
- Member rows render only while a chip is open, separated from it by a top rule.
  Each is a row like the owner's: title, middot facts, an individual checkbox, and
  host-authorized navigation. There is no left vertical rule and no corner glyph.
- ONE continuous connector (`.helper-tree-rail`) traces the centre of every
  MOUNTED row checkbox, so a row the host never mounted is never traced. It is
  measured from the mounted anchors after mount, expand/collapse, a row that gains
  or loses its checkbox, and resize; verticals run in the parent's column and a
  single square step lands in the indentation gutter. The connector carries no
  meaning the rows and checkboxes do not already carry.
- Copy `groupId`, `memberScope`, and `helperThreadCount` from the group summary.
  The displayed quantity is saved helper threads, never messages or review attempts.
- Pass the complete authorized member set for the exact scope as `members`.
  `getMemberKey(row)` returns the stable individual transcript ID.
  `renderMember(row)` renders one `HelperThreadRow` per member. Compose the
  original row's status, usage, and existing actions as children. No universal row
  conversion discards collective, pending, share, sync, or search fields.
- If a helper itself owns helpers, render those immediate groups in that member's
  own children, not under the root ancestor. The nested chip steps in again and
  the same connector continues through it at the deeper column.
- A host that pages a group passes its controls as `memberFooter`. That is THE
  canonical position for paging: the slot renders inside the open body,
  immediately after the member rows (or after the "no saved helpers" notice when
  the page holds none). A group renders the slot only while it is open and not
  scope-expired, so page controls never outlive the rows they page. It is
  optional: a host that passes nothing keeps exactly the DOM it had before the
  slot existed.

## host state and callbacks

The host owns fetching, paging, and error/loading presentation for its own list;
the group never fetches. Pass the members already resolved for `memberScope`
and keep `helperThreadCount` as the saved-thread total, not a page length. The
control states the count with the noun singularized ("1 helper thread"), and a
changed scope token resets uncontrolled disclosure; it never inherits the old
query's open state.

Paging stays host-owned end to end. The host fetches the page it needs and passes
only the LOADED page as `members`, with the server total as `helperThreadCount`;
the group holds no page number, limit, or scope token, and never derives a total
from the rows it was handed. State the server total and the loaded slice
separately, so "how many saved threads exist" and "how many this page shows"
never blur: the count chip carries the total, and the host's `memberFooter`
carries the page indicator and previous/next. Two groups in one tree each keep
their own page state, so paging one never moves the other; the nested example
below proves it.

A group starts closed, so supply `isMemberSelected(row)` whenever
`renderMember` draws per-member checkboxes. The predicate lets the CLOSED
control append `, N selected` so a selection the viewer cannot see is never
silent. The group only counts the rows it holds; it never stores selection.

## selection policy

`useHelperSelection` (exported from the same barrel) is the canonical policy for
a helper tree. Selection state stays host-owned: call the hook in the component
that owns the selection, then pass its `isSelected` and `onSelect` to the rows;
the owner row also reads `ownerState`. `helperOwnerState` exposes the same rollup
to a host that keeps its own state store, and `helperOwnerToggle` and
`helperMemberToggle` are the pure reducers the hook applies.

The owner checkbox is a TWO-STATE CYCLE between the tree's manual selection and a
select-all override:

    manual (the configured and hand-picked rows)  <->  all (owner + every member)

- Pressing the owner from the manual side (nothing selected, a partial tree, or a
  tree the host configured) selects the owner and every helper member. Pressing it
  again from the all side RESTORES the manual selection; it never clears a row the
  viewer picked by hand. The checkbox's off position is that manual/restore state,
  which is why the explicit "none" step of the tree's keyboard select-all ring is
  not surfaced here.
- Ticking a member edits only that member. It never widens to the owner or to a
  sibling, and it writes the manual side and ends any all-selection, so the manual
  pick survives every later owner press.
- The owner checkbox states the rollup of what is DISPLAYED: `checked` when the
  whole tree is selected, `unchecked` when none of it is, and `partial` when it is
  mixed. Render `partial` through `HelperThreadRow`'s `indeterminate` prop, which
  draws the mixed mark and reports `aria-checked="mixed"`, so the state is never
  carried by the mark alone.
- `initialSelectedIds` seeds the manual side. A changed `ownerId` or member set is
  a different tree and resets to that tree's configured selection.

Worked example (owner P1, members G1 and G2), starting from nothing selected:

| press | displayed | owner |
|---|---|---|
| G1 | G1 | partial |
| P1 | P1, G1, G2 | checked |
| P1 | G1 | partial |
| P1 | P1, G1, G2 | checked |
| G2 | P1, G1 | partial |
| P1 | P1, G1, G2 | checked |
| P1 | P1, G1 | partial |

The row after the manual `G2` untick restores `P1, G1`, the manual selection,
rather than clearing the tree. The mount, the fixtures, and the story exercise
this exact sequence.

Display-only contexts leave `onSelect`, `href`, and `onOpen` off; every row then
renders as an ordinary row and, with no checkboxes mounted, no connector is drawn.

On a scope-expiry response, pass `scopeExpired` and keep `members` untouched.
The group renders no member rows fail-closed and offers only `onRefreshList()`,
which must refresh the originating list with its original filters. Do not fetch
all group members as a fallback. Selection remains exclusively in host state and
must be rechecked by the mutation path.

Disclosure defaults collapsed. For Back restoration, pass controlled `expanded`
and `onExpandedChange(boolean)`; the host restores disclosure from route state.
Opening retains trigger focus. Unrelated background updates do not move focus.

`HelperThreadRow` accepts individual display props `id`, `title`, `provider`,
`inputSubmissionCount`, and `turnCount`. Titles remain verbatim; they truncate
visually with the full text intact in the DOM. Absent input count shows
`unknown input submissions`; measured zero stays zero; a count of one
singularizes (`1 input submission`, `1 turn`). No count is inferred. An
authorized `href` renders a real link. `onOpen(id, event)` can prevent its
default navigation for an SPA. Without an href, an `onOpen` callback renders a
button; without either, the title is noninteractive. `onSelect(id, checked)` is
optional; when present, `selected`, `indeterminate`, and `selectionDisabled`
control only that individual row. A rolled-up owner passes `indeterminate` for
its mixed state; an ordinary member leaves it off.

## examples and verification

The mounted in-use demo is
`?app=commons&helpers=three-independent-counts#inuse`. Other named examples include
`helper-only-search`, `unresolved-independent`, `identical-independent-helpers`,
`trunk-append`, `trunk-replacement`, `scope-expired`, `unavailable-owner`,
`measured-zero`, `unknown-input-count`, `ordinary-child-exit`, and
`two-live-paging-states` (the two-deep tree with two independent live page
states). The same
examples are in Storybook under `lists/helper groups`, plus a `plain`
display-only variant with selection and navigation both off. The demo's fixture
selection is not a host backend integration test.

Run `pnpm test:helper-groups` for fixture-backed public-barrel mounted callbacks.
The YAML fixtures carry the rail oracle per case (`expectedAnchorCounts`: the
mounted checkboxes while collapsed and while expanded), and the suite reads it
back through `data-anchor-count` on the mounted connector. After `pnpm build`,
run `node scripts/helper-groups.probe.mjs` with `CHROME_PATH` set to Chrome for
exact built-demo keyboard, computed-style, connector-geometry, and both-theme
captures.
