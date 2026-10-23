# local village presentation adoption

`VillageObservations` is exported from `@peasant-labs/fairtrade/ui` and
`@peasant-labs/fairtrade/graph`. Its cooked presentation models are exported as
`VillageObservationsProps`, `ObservationDomain`, `ObservedCollective`,
`ContributionEvidenceCategory` and `ContributionEvidenceRow`. Styles ship in
`components.css`. This composition has no schema, authentication, network, storage,
retention or authorization behavior. The host validates and adapts wire results.

## host responsibilities

- Key the composition by the selected account/server scope. Clear old-scope data and ignore
  late old-scope reports in the host. Never pass credentials to the component.
- Display each domain's result, committed effect, last attempt and last completed date
  independently. Decode typed partial fetch reports even on non-success HTTP responses,
  then reload saved observations. A history failure must not hide a committed catalog.
- Supply one bounded page per evidence category. Keep each category's page, filter and opaque
  traversal token independently. `onPageChange(categoryId, page)` does not select a token;
  the host carries that category's token. Report-only changes must not reset pages.
- For a selected-category conflict, set its `conflict` and `issue`; `onRestart(categoryId)`
  requests an explicit restart of that category only. The component suppresses its rows and
  pager until the host supplies the restarted projection.
- Adapt remote attempts, confirmed receipts and operation diagnostics into labeled text
  details. Preserve attempt ordinal, creation date, decision date and actor capacity. Never
  relabel a receipt as approval or an uncertain diagnostic as a successful contribution.
- Pass safe retained details with explicit dated/invalidated/expired labels. Dates are
  displayed literally as ISO timestamps, including the timezone, without invented freshness.
  `onTrack(id, tracking)` changes only explicit tracking preference; it is not a join action.
- `onFetch()` requests metadata only. `fetching` prevents duplicate activation. Persistent
  `issue: {message,retry}` and `status` describe failures and corrective actions in place.
  `LocalOfflineBanner` remains a separate host notice for local-server outage, never Village
  unavailability. Optional content-metadata warnings must preserve independent content success.

The controlled `view` and `categoryId` props are optional. Without them only tab selection is
local state; pages and data are always host-owned. The component does not reset host pages when
fetch results change. Additional host-owned filters may sit beside the composition.

Controlled selection is request/host-commit: callbacks emit the requested identity once,
but the selected panel changes only after the host supplies the next controlled prop. An
unmapped controlled view/category throws an actionable error rather than displaying another
category's data. When changing scope, clear obsolete controlled selections together with data.
No callback or fetch fires merely because props mount, reorder or update.

The composition is a bounded reading surface: scope, fetch and view/category controls stay
outside its internally scrolling evidence panel, in ordinary DOM reading order. Its default
height is the viewport minus the product header; the canonical GraphAppShell supplies its
actual remaining height through `--vobs-height: 100%`. Other hosts can set `--vobs-height` to
their available content height instead of duplicating sticky controls or shell offsets.
The panel is keyboard focusable and uses native scrolling; busy or handlerless pagers are
native inert subtrees. Metadata explanations scroll with the evidence, while the compact
selected scope and tools remain available. Opaque token surfaces and normal flex layout avoid
overlapping shell navigation or focused controls; no second scroll-dependent scope is inferred.

## canonical navigation and release boundary

`LOCAL_APP_SECTIONS` lists home and settings in navigation; online (id `village`), analytics, changes
and map are route-only. (0.0.30 listed online in navigation; 0.0.34 moved it to route-only.) Registry and entries are frozen. `AppSection` remains open for custom
lists. Deprecated `GRAPH_APP_SECTIONS` retains its exact analytics/changes/map value.
The official demo mounts the real composition at `?app=graph&section=village#inuse`.

Audited default-checkout production importer: Peasant `web/src/lib/nav/sections.ts` consumes
the `/graph` registry, derives the header/palette and intentionally rejects unmapped IDs.
Its `LocalSectionId` and route map must add village -> `/village` together with the mounted
body in the same package adoption. Its section fixtures and navbar tests also import these
exports. The Fairtrade demo and public type tests consume the registry directly and are updated
here. No registry import was found in Village's frontend; its commons navigation is unchanged.
Any downstream user of default `GraphAppShell`/`GraphSectionNav` must provide a Village body
when upgrading. Custom section lists and old exact package pins remain unaffected.

This source change does not publish a package. Before Peasant re-pins, the supervisor must:

1. Complete independent review and package/prepack gates for this source.
2. Prepare the maintainer-authorized release PR with an actual version/changelog, following
   `AGENTS.md`. Let the merged release workflow create its tag and publish through OIDC.
3. Verify the published package exports both the new composition and registry entry, then
   adopt that exact published version coherently in Peasant. A source link or local tarball
   may test package mechanics but never substitutes for this shipping dependency.
4. Verify Peasant's full navigation/body journey and retained settings exits against the
   published artifact. Its canonical server/schema release dependencies remain separate.

No manual tag, npm publication, consumer pin, or commons navigation change is included here.
