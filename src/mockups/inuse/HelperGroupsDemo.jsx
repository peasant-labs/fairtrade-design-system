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
  // Every helper member the owner anchors across this result's groups. The DS
  // owns the cascade policy; this host owns the selection state.
  const memberIds = useMemo(() => fixture.owner
    ? [...new Set(fixture.groups.flatMap((group) => group.members))] : [], [fixture])
  const { selectedIds, isSelected, onSelect, ownerState } = useHelperSelection({ ownerId: fixture.owner, memberIds })
  const [opened, setOpened] = useState(() => {
    const id = new URLSearchParams(window.location.search).get('helper')
    return Object.hasOwn(fixtures.rows, id) ? id : null
  })
  const [refreshed, setRefreshed] = useState(false)
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
    return <HelperThreadRow {...fixtures.rows[id]} {...(fixture.update?.id === id ? fixture.update : {})}
      {...navigation} {...selection}>
      <div className="helper-thread-route">saved transcript <span>{id}</span></div>
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
            helperThreadCount={group.count} members={group.members}
            renderMember={renderRow} getMemberKey={(id) => id}
            isMemberSelected={plain ? undefined : isSelected}
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
