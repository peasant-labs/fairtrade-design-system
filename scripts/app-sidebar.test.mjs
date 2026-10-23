#!/usr/bin/env node
/* Mounted-source gate for AppSidebar: links and buttons with aria-current on the current item, the
   icon or swatch, the external marker and its spoken suffix, the group landmarks and labels, the
   online / local / docs switcher, the collapse toggle, the remembered collapsed state and width
   (including a throwing store and a null key), the keyboard resize, the account row, the
   narrow-viewport menu (its button doubling as the close control, the drawer items in stagger
   order), the one sliding current-item indicator and a router link component. jsdom has no
   layout, so the indicator is checked for placement and for when it may slide, not for pixels.
   Cases: scripts/testdata/app-sidebar.yaml (+ .manifest.yaml).
   Run: node scripts/app-sidebar.test.mjs; mutations: node scripts/parts-mutations.mjs
   scripts/app-sidebar.test.mjs scripts/testdata/app-sidebar.manifest.yaml. */
import { loadFixturePair, withMountedSource, click, keydown, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/app-sidebar.yaml'
const MANIFEST = 'scripts/testdata/app-sidebar.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('app sidebar')

/* the accessible text of a node: its text without aria-hidden subtrees */
const spoken = (node) => {
  if (!node) return undefined
  const copy = node.cloneNode(true)
  copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove())
  return copy.textContent.replace(/\s+/g, ' ').trim()
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/* a Map-backed localStorage installed on globalThis for one case; `throws` makes every access throw */
function installStorage(initial = {}, { throws = false } = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const data = new Map(Object.entries(initial))
  const writes = []
  const store = {
    getItem(key) { if (throws) throw new Error('storage blocked'); return data.has(key) ? data.get(key) : null },
    setItem(key, value) { if (throws) throw new Error('storage blocked'); writes.push(key); data.set(key, String(value)) },
    removeItem(key) { data.delete(key) },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => store })
  return {
    data, writes,
    restore() {
      if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
      else delete globalThis.localStorage
    },
  }
}

await withMountedSource(async ({ load, mount, window, React }) => {
  const sidebar = await load('/src/ui/AppSidebar.jsx')
  const lucide = await load('lucide-react')
  const barrel = await load('/src/ui/index.js')
  const AppSidebar = sidebar.default
  report.check(barrel.AppSidebar === AppSidebar && barrel.AppSidebarLayout === sidebar.AppSidebarLayout && barrel.APP_SIDEBAR_APPS === sidebar.APP_SIDEBAR_APPS, 'AppSidebar, AppSidebarLayout and APP_SIDEBAR_APPS must be exported from the ui barrel')
  report.check(Object.isFrozen(sidebar.APP_SIDEBAR_APPS) && same(sidebar.APP_SIDEBAR_APPS.map((a) => a.id), ['online', 'local', 'docs']), 'APP_SIDEBAR_APPS must be the frozen online, local, docs list')

  const selected = []
  const groups = fixture.groups.map((group) => ({
    ...group,
    items: group.items.map(({ icon, onSelect, ...item }) => ({
      ...item,
      ...(icon ? { icon: lucide[icon] } : {}),
      ...(onSelect ? { onSelect: (id) => selected.push(id) } : {}),
    })),
  }))
  const propsFor = (row, extra = {}) => ({ groups, apps: fixture.apps, ...row.props, ...extra })
  const labelOf = (id) => fixture.groups.flatMap((group) => group.items).find((item) => item.id === id)?.label
  const itemFor = (root, id) => [...root.querySelectorAll('aside nav:not([aria-label="apps"]) .asb-item')]
    .find((item) => item.querySelector('.asb-label')?.textContent === labelOf(id))

  for (const row of fixture.cases) {
    const name = row.name
    selected.length = 0
    const storage = installStorage(row.storage ?? {}, { throws: row.kind === 'throwing-storage' })
    try {
      if (row.kind === 'items') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const root = mounted.container
        for (const expected of row.expected) {
          const item = itemFor(root, expected.id)
          report.check(!!item, `${name}: ${expected.id} must render`)
          if (!item) continue
          report.check(item.tagName === expected.tag, `${name}: ${expected.id} must be a ${expected.tag}, received ${item.tagName}`)
          report.check(item.getAttribute('aria-current') === expected.current, `${name}: ${expected.id} aria-current must be ${JSON.stringify(expected.current)}, received ${JSON.stringify(item.getAttribute('aria-current'))}`)
          const leading = item.querySelector('.asb-ic .lucide') ? 'icon' : item.querySelector('.asb-sw') ? 'swatch' : 'none'
          report.check(leading === expected.leading, `${name}: ${expected.id} must lead with a ${expected.leading}, received ${leading}`)
          report.check(!!item.querySelector('.asb-ext .lucide') === expected.external, `${name}: ${expected.id} external marker must be ${expected.external ? 'present' : 'absent'}`)
          report.check(spoken(item) === expected.text, `${name}: ${expected.id} text must read ${JSON.stringify(expected.text)}, received ${JSON.stringify(spoken(item))}`)
          report.check(item.classList.contains('asb-item-sub') === (expected.depth === 1), `${name}: ${expected.id} depth must be ${expected.depth}`)
          const label = labelOf(expected.id)
          report.check(item.getAttribute('title') === label, `${name}: ${expected.id} must carry ${JSON.stringify(label)} as the title`)
        }
        await mounted.unmount()
      } else if (row.kind === 'select') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        await mounted.act(() => click(window, itemFor(mounted.container, row.click)))
        report.check(same(selected, row.expectedSelected), `${name}: onSelect must report ${JSON.stringify(row.expectedSelected)}, received ${JSON.stringify(selected)}`)
        await mounted.unmount()
      } else if (row.kind === 'groups') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const root = mounted.container
        const navNames = [...root.querySelectorAll('aside nav')].map((nav) => nav.getAttribute('aria-label'))
        report.check(same(navNames, row.expected.navNames), `${name}: nav landmarks must be ${JSON.stringify(row.expected.navNames)}, received ${JSON.stringify(navNames)}`)
        const labels = [...root.querySelectorAll('.asb-glabel')].map((node) => node.textContent)
        report.check(same(labels, row.expected.visibleLabels), `${name}: group labels must be ${JSON.stringify(row.expected.visibleLabels)}, received ${JSON.stringify(labels)}`)
        report.check(root.querySelector('aside')?.getAttribute('aria-label') === row.expected.asideName, `${name}: the aside must be named ${row.expected.asideName}`)
        report.check(root.querySelectorAll('aside').length === 1 && root.querySelectorAll('nav[aria-label="apps"]').length === 1, `${name}: there must be one nav DOM, not a desktop copy and a drawer copy`)
        await mounted.unmount()
      } else if (row.kind === 'switcher') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const entries = [...mounted.container.querySelectorAll('nav[aria-label="apps"] .asb-item')].map((item) => ({
          label: item.querySelector('.asb-label')?.textContent,
          tag: item.tagName,
          current: item.getAttribute('aria-current'),
          external: !!item.querySelector('.asb-ext') && spoken(item).endsWith('opens outside this app'),
        }))
        report.check(same(entries, row.expected), `${name}: switcher entries must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(entries)}`)
        await mounted.unmount()
      } else if (row.kind === 'collapse') {
        const calls = []
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row, { onCollapsedChange: (value) => calls.push(value) })))
        const root = mounted.container
        const state = () => {
          const toggle = root.querySelector('button.asb-toggle')
          return {
            expanded: toggle?.getAttribute('aria-expanded'),
            name: toggle?.getAttribute('aria-label'),
            collapsed: root.querySelector('.asb')?.dataset.collapsed,
            separator: !!root.querySelector('[role="separator"]'),
          }
        }
        report.check(same(state(), row.expected.before), `${name}: before the toggle expected ${JSON.stringify(row.expected.before)}, received ${JSON.stringify(state())}`)
        const labelsBefore = [...root.querySelectorAll('.asb-panel .asb-label')].map((node) => node.textContent)
        await mounted.act(() => click(window, root.querySelector('button.asb-toggle')))
        report.check(same(state(), row.expected.after), `${name}: after the toggle expected ${JSON.stringify(row.expected.after)}, received ${JSON.stringify(state())}`)
        const labelsAfter = [...root.querySelectorAll('.asb-panel .asb-label')].map((node) => node.textContent)
        report.check(labelsAfter.length > 0 && same(labelsAfter, labelsBefore), `${name}: collapsed labels must stay in the DOM as accessible names`)
        const titles = [...root.querySelectorAll('aside nav:not([aria-label="apps"]) .asb-item')].map((item) => item.getAttribute('title'))
        report.check(same(titles, row.expected.titles), `${name}: collapsed items must carry title tooltips ${JSON.stringify(row.expected.titles)}, received ${JSON.stringify(titles)}`)
        report.check(same(calls, row.expected.callbacks), `${name}: onCollapsedChange must report ${JSON.stringify(row.expected.callbacks)}, received ${JSON.stringify(calls)}`)
        await mounted.unmount()
      } else if (row.kind === 'persist') {
        const first = await mount(React.createElement(AppSidebar, propsFor(row)))
        for (const key of row.keys) await first.act(() => keydown(window, first.container.querySelector('[role="separator"]'), key))
        await first.act(() => click(window, first.container.querySelector('button.asb-toggle')))
        const stored = Object.fromEntries(Object.keys(row.expected.storage).map((key) => [key, storage.data.get(key) ?? null]))
        report.check(same(stored, row.expected.storage), `${name}: storage must hold ${JSON.stringify(row.expected.storage)}, received ${JSON.stringify(stored)}`)
        await first.unmount()
        const second = await mount(React.createElement(AppSidebar, propsFor(row)))
        const root = second.container.querySelector('.asb')
        const restored = { collapsed: root?.dataset.collapsed, width: root?.style.getPropertyValue('--asb-w') }
        report.check(same(restored, row.expected.remount), `${name}: a remount must read back ${JSON.stringify(row.expected.remount)}, received ${JSON.stringify(restored)}`)
        await second.unmount()
      } else if (row.kind === 'restore') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const root = mounted.container.querySelector('.asb')
        const restored = { collapsed: root?.dataset.collapsed, width: root?.style.getPropertyValue('--asb-w') }
        report.check(same(restored, row.expected), `${name}: stored values must restore as ${JSON.stringify(row.expected)}, received ${JSON.stringify(restored)}`)
        await mounted.unmount()
      } else if (row.kind === 'throwing-storage') {
        let mounted
        try {
          mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        } catch (error) {
          report.check(false, `${name}: mounting threw ${error.message}`)
        }
        const root = mounted?.container
        const items = root?.querySelectorAll('aside nav:not([aria-label="apps"]) .asb-item').length ?? 0
        report.check(items === row.expected.items, `${name}: expected ${row.expected.items} items, received ${items}`)
        const toggle = root?.querySelector('button.asb-toggle')
        if (toggle) await mounted.act(() => click(window, toggle))
        report.check(root?.querySelector('.asb')?.dataset.collapsed === row.expected.collapsedAfterToggle, `${name}: the toggle must still collapse with a throwing store`)
        await mounted?.unmount()
      } else if (row.kind === 'no-storage') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        for (const key of row.keys) await mounted.act(() => keydown(window, mounted.container.querySelector('[role="separator"]'), key))
        await mounted.act(() => click(window, mounted.container.querySelector('button.asb-toggle')))
        report.check(storage.writes.length === row.expected.writes, `${name}: expected ${row.expected.writes} storage writes, received ${JSON.stringify(storage.writes)}`)
        await mounted.unmount()
      } else if (row.kind === 'resize') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const separator = mounted.container.querySelector('[role="separator"]')
        report.check(separator?.getAttribute('tabindex') === '0' && separator?.getAttribute('aria-orientation') === 'vertical' && separator?.getAttribute('aria-label') === 'resize the sidebar', `${name}: the separator must be a focusable vertical separator named "resize the sidebar"`)
        report.check(separator?.getAttribute('aria-valuemin') === row.expected.min && separator?.getAttribute('aria-valuemax') === row.expected.max, `${name}: the separator must report its bounds`)
        report.check(separator?.getAttribute('aria-controls') === mounted.container.querySelector('aside')?.id, `${name}: the separator must control the aside`)
        let previous = 'start'
        for (const step of row.steps) {
          const prevented = await (async () => { let p; await mounted.act(() => { p = keydown(window, separator, step.key) }); return p })()
          const now = Number(separator.getAttribute('aria-valuenow'))
          report.check(now === step.value, `${name}: after ${previous} then ${step.key} the width must be ${step.value}, received ${now}`)
          report.check(prevented, `${name}: ${step.key} must be handled`)
          previous = step.key
        }
        report.check(mounted.container.querySelector('.asb')?.style.getPropertyValue('--asb-w') === row.expected.width, `${name}: the column width must follow the separator`)
        await mounted.unmount()
      } else if (row.kind === 'account') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const account = mounted.container.querySelector('.asb-me .asb-account')
        const actual = {
          tag: account?.tagName,
          initial: account?.querySelector('.asb-av')?.textContent,
          handle: account?.querySelector('.asb-handle')?.textContent,
          href: account?.getAttribute('href') ?? null,
        }
        report.check(same(actual, row.expected), `${name}: the account row must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
        await mounted.unmount()
      } else if (row.kind === 'account-slot') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row, { accountSlot: React.createElement('span', { className: 'slot' }, row.slot) })))
        const me = mounted.container.querySelector('.asb-me')
        report.check(me?.textContent === row.expected.text, `${name}: the slot must replace the row, received ${JSON.stringify(me?.textContent)}`)
        report.check(!!me?.querySelector('.asb-handle') === row.expected.handle, `${name}: the default handle must not render beside a slot`)
        await mounted.unmount()
      } else if (row.kind === 'drawer') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const root = mounted.container
        const menu = root.querySelector('button.asb-menu')
        const asb = root.querySelector('.asb')
        report.check(menu?.getAttribute('aria-label') === row.expected.name && menu?.getAttribute('aria-controls') === root.querySelector('aside')?.id, `${name}: the menu button must be named ${JSON.stringify(row.expected.name)} and control the aside`)
        report.check(menu?.getAttribute('aria-expanded') === 'false' && asb?.dataset.drawerOpen === 'false', `${name}: the drawer must start closed`)
        await mounted.act(() => click(window, menu))
        report.check(menu?.getAttribute('aria-expanded') === 'true' && asb?.dataset.drawerOpen === 'true', `${name}: the menu button must open the drawer`)
        report.check(menu?.getAttribute('aria-label') === row.expected.closeName && window.document.activeElement === menu, `${name}: the open menu button must become ${JSON.stringify(row.expected.closeName)} and hold focus`)
        const closers = [...root.querySelectorAll('button')].filter((button) => button.getAttribute('aria-label') === row.expected.closeName)
        report.check(closers.length === 1, `${name}: there must be one close control, received ${closers.length}`)
        const order = [...root.querySelectorAll('.asb-panel .asb-list > li')].map((li) => li.style.getPropertyValue('--asb-i'))
        report.check(order.length === row.expected.listed && same(order, order.map((_, index) => String(index))), `${name}: the ${row.expected.listed} listed items must carry their stagger order 0..${row.expected.listed - 1}, received ${JSON.stringify(order)}`)
        await mounted.act(() => click(window, menu))
        report.check(menu?.getAttribute('aria-expanded') === 'false' && asb?.dataset.drawerOpen === 'false', `${name}: pressing the open menu button must close the drawer`)
        await mounted.act(() => click(window, menu))
        await mounted.act(() => keydown(window, window.document.body, 'Escape'))
        report.check(menu?.getAttribute('aria-expanded') === 'false' && asb?.dataset.drawerOpen === 'false', `${name}: Escape must close the drawer`)
        await mounted.settle(5)
        report.check(window.document.activeElement === menu, `${name}: closing must return focus to the menu button`)
        await mounted.act(() => click(window, menu))
        const link = itemFor(root, 'home')
        link?.addEventListener('click', (event) => event.preventDefault(), { once: true })
        await mounted.act(() => click(window, link))
        report.check(asb?.dataset.drawerOpen === 'false', `${name}: choosing a nav link must close the drawer`)
        await mounted.unmount()
      } else if (row.kind === 'indicator') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const root = mounted.container
        const look = () => {
          const bars = root.querySelectorAll('.asb-indicator')
          return {
            count: bars.length,
            hidden: bars[0]?.getAttribute('aria-hidden'),
            placed: bars[0]?.dataset.placed,
            slides: bars[0]?.dataset.animate,
            ready: root.querySelector('.asb')?.dataset.indicator ?? null,
          }
        }
        report.check(same(look(), row.expected.first), `${name}: the first placement must be ${JSON.stringify(row.expected.first)}, received ${JSON.stringify(look())}`)
        await mounted.rerender(React.createElement(AppSidebar, propsFor(row, { currentId: row.next })))
        report.check(same(look(), row.expected.moved), `${name}: a new current item must be ${JSON.stringify(row.expected.moved)}, received ${JSON.stringify(look())}`)
        report.check(itemFor(root, row.next)?.getAttribute('aria-current') === 'page', `${name}: the new current item must carry aria-current`)
        await mounted.rerender(React.createElement(AppSidebar, propsFor(row, { currentId: row.missing })))
        report.check(same(look(), row.expected.none), `${name}: with no current item the indicator must be ${JSON.stringify(row.expected.none)}, received ${JSON.stringify(look())}`)
        await mounted.unmount()
      } else if (row.kind === 'link-component') {
        const seen = []
        const Link = ({ href, children, ...rest }) => {
          seen.push({ href, current: rest['aria-current'] })
          return React.createElement('a', { href, 'data-router': 'yes', ...rest }, children)
        }
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row, { LinkComponent: Link })))
        const hrefs = [...mounted.container.querySelectorAll('a[data-router="yes"]')].map((a) => a.getAttribute('href'))
        report.check(same(hrefs, row.expected.hrefs), `${name}: every link must go through the link component ${JSON.stringify(row.expected.hrefs)}, received ${JSON.stringify(hrefs)}`)
        report.check(mounted.container.querySelectorAll('a:not([data-router])').length === 0, `${name}: no plain anchor may bypass the link component`)
        report.check(seen.some((entry) => entry.href === row.expected.current && entry.current === 'page'), `${name}: the link component must receive aria-current on the current item`)
        await mounted.unmount()
      } else {
        throw new Error(`${FIXTURE}: unknown case kind ${row.kind}`)
      }
    } finally {
      storage.restore()
    }
  }
})

report.finish(`${fixture.cases.length} cases over items, groups, the switcher, collapse, persistence, resize, the account row, the drawer, the current-item indicator and router links.`)
