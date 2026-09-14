import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import YAML from 'yaml'
import { HelperGroup, HelperGroupListItem, HELPER_OWNER_STATE, HelperThreadRow, useHelperSelection } from '../../ui/index.js'
import fixtureSource from '../../../scripts/testdata/helper_group_listing.yaml?raw'

// The demo owns its fixture selection just as a host owns its API.
// Production components never import these examples or parse their data.
const fixtures = YAML.parse(fixtureSource)

export default function HelperGroupsDemo({ scenario = 'three-independent-counts', plain = false }) {
  const fixture = fixtures.cases.find((item) => item.name === scenario)
  if (!fixture) throw new Error('HelperGroupsDemo could not render the requested example. Choose a named helper-list fixture in the helpers query parameter.')
  // A group may hang inside a member row that itself owns helpers. The demo maps
  // that member to its nested group just as a host maps a row to its own query.
  const nestedByOwner = useMemo(
    () => new Map((fixture.nested || []).map((entry) => [entry.owner, entry.group])), [fixture])
  // Every helper member the owner anchors across this result's groups, top-level
  // and nested. The DS owns the cascade policy; this host owns the selection state.
  const memberIds = useMemo(() => fixture.owner
    ? [...new Set([...fixture.groups, ...(fixture.nested || []).map((entry) => entry.group)]
      .flatMap((group) => group.members))] : [], [fixture])
  const { selectedIds, isSelected, onSelect, ownerState } = useHelperSelection({ ownerId: fixture.owner, memberIds })
  const [opened, setOpened] = useState(() => {
    const id = new URLSearchParams(window.location.search).get('helper')
    return Object.hasOwn(fixtures.rows, id) ? id : null
  })
  const [refreshed, setRefreshed] = useState(false)
  // Host-owned paging: one page per group, keyed by the backend group ID. The DS
  // never sees this state; each group receives only the loaded page as `members`
  // and the full saved-thread count as `helperThreadCount`.
  const [pageByGroup, setPageByGroup] = useState({})
  const limit = fixture.paging?.limit
  const pageOf = (group) => pageByGroup[group.id] ?? 1
  const pageCountOf = (group) => Math.max(1, Math.ceil(group.count / limit))
  const loadedMembers = (group) => limit
    ? group.members.slice((pageOf(group) - 1) * limit, pageOf(group) * limit)
    : group.members
  const setPage = (group, page) => setPageByGroup((previous) => ({
    ...previous, [group.id]: Math.min(Math.max(1, page), pageCountOf(group)),
  }))
  // The canonical paging slot content: the page indicator and previous/next. The
  // count chip above states the server total; this line states how much of it the
  // current page loaded, so total and loaded never blur together.
  const renderPaging = (group) => {
    if (!limit) return undefined
    const page = pageOf(group)
    const pages = pageCountOf(group)
    const from = (page - 1) * limit + 1
    const to = Math.min(page * limit, group.count)
    return <div className="helper-demo-paging" data-helper-paging={group.id} data-helper-page={page}>
      <span className="helper-demo-page">page {page} of {pages}</span>
      <span className="helper-demo-loaded">showing {from}-{to} of {group.count}</span>
      <button type="button" className="helper-group-action" data-helper-prev
        disabled={page === 1} onClick={() => setPage(group, page - 1)}>previous</button>
      <button type="button" className="helper-group-action" data-helper-next
        disabled={page === pages} onClick={() => setPage(group, page + 1)}>next</button>
    </div>
  }
  const renderRow = (id) => {
    const navigation = plain ? {} : {
      href: `?app=commons&helpers=${encodeURIComponent(scenario)}&helper=${encodeURIComponent(id)}#inuse`,
      onOpen: (identity, event) => { event.preventDefault(); setOpened(identity) },
    }
    // The owner checkbox states the tree rollup (checked / mixed / unchecked);
    // a member checkbox states only its own row.
    const selection = plain ? {} : id === fixture.owner
      ? { selected: ownerState === HELPER_OWNER_STATE.CHECKED,
          indeterminate: ownerState === HELPER_OWNER_STATE.PARTIAL, onSelect }
      : { selected: isSelected(id), onSelect }
    // A helper that itself owns helpers renders those immediate groups in ITS
    // own children, one level deeper in the same tree. Each nested group carries
    // its own host page state through the same canonical memberFooter slot.
    const nested = nestedByOwner.get(id)
    return <HelperThreadRow {...fixtures.rows[id]} {...(fixture.update?.id === id ? fixture.update : {})}
      {...navigation} {...selection}>
      <div className="helper-thread-route">saved transcript <span>{id}</span></div>
      {nested && <HelperGroup groupId={nested.id} memberScope={nested.scope}
        helperThreadCount={nested.count} members={loadedMembers(nested)}
        renderMember={renderRow} getMemberKey={(row) => row}
        isMemberSelected={plain ? undefined : isSelected}
        memberFooter={renderPaging(nested)} />}
      {fixture.ordinaryChild && id === fixture.owner && <button type="button" className="helper-group-action"
        onClick={() => setOpened(fixture.ordinaryChild)}>open ordinary child</button>}
    </HelperThreadRow>
  }

  const scopeExpired = !!fixture.scopeExpired && !refreshed
  return <div className="helper-demo" data-helper-demo={scenario}>
    <div hidden={opened !== null}>
      <h2>saved sessions</h2>
      <p className="helper-demo-description">saved threads hang in one tree under their immediate owner. the connector traces every row the tree holds, and the control between the owner and its members states how many threads it holds and how many are selected.</p>
      {fixture.groups.map((group) => (
        <HelperGroupListItem key={group.id}
          owner={fixture.owner ? renderRow(fixture.owner) : undefined} ownerStatus={fixture.ownerStatus}>
          <HelperGroup groupId={group.id} memberScope={refreshed ? `${group.scope}-refreshed` : group.scope}
            helperThreadCount={group.count} members={loadedMembers(group)}
            renderMember={renderRow} getMemberKey={(id) => id}
            isMemberSelected={plain ? undefined : isSelected}
            memberFooter={renderPaging(group)}
            scopeExpired={scopeExpired} onRefreshList={() => setRefreshed(true)} />
        </HelperGroupListItem>
      ))}
      <p className="helper-demo-summary" role="status">selected transcripts: {selectedIds.length ? selectedIds.join(', ') : 'none'}</p>
    </div>
    {opened !== null && <div>
      <button type="button" className="helper-group-action" onClick={() => setOpened(null)}>
        <ChevronLeft aria-hidden="true" /> back to results
      </button>
      <h2>saved transcript</h2>
      {renderRow(opened)}
      <p className="helper-group-notice">this example opened the individual saved identity. returning to results preserves disclosure and explicit selection.</p>
    </div>}
  </div>
}
