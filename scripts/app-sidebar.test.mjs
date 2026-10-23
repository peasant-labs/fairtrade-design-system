#!/usr/bin/env node
/* Mounted-source gate for AppSidebar: links and buttons with aria-current on the current item, the
   icon or swatch, the external marker and its spoken suffix, the group landmarks and labels, the
   brand as the mark alone, the one order every app gets (brand row, nav groups, search, switcher,
   footer with the theme toggle then the account), the search item, the theme toggle, the switcher
   to the other apps (new tab by default), the collapse handle in the brand row, the remembered collapsed state and width
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
          target: item.getAttribute('target'),
          rel: item.getAttribute('rel'),
          text: spoken(item),
        }))
        report.check(same(entries, row.expected), `${name}: switcher entries must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(entries)}`)
        await mounted.unmount()
      } else if (row.kind === 'structure') {
        const extra = row.search ? { search: { ...row.search, onOpen: () => {} } } : {}
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row, { ...extra, onThemeChange: () => {} })))
        const aside = mounted.container.querySelector('aside')
        const tokenOf = (node) => {
          if (node.matches('nav.asb-apps')) return 'apps'
          if (node.matches('nav.asb-group')) return `nav:${node.getAttribute('aria-label')}`
          if (node.matches('.asb-search')) return 'search'
          if (node.matches('.asb-foot')) return `foot:${[...node.children].map((child) => (child.matches('.asb-theme') ? 'theme' : child.matches('.asb-me') ? 'account' : child.className)).join('+')}`
          return node.className
        }
        const order = [
          aside?.firstElementChild?.classList.contains('asb-top') ? 'top' : aside?.firstElementChild?.className,
          ...[...(aside?.querySelector('.asb-scroll')?.children ?? [])].filter((node) => !node.matches('.asb-indicator')).map(tokenOf),
        ]
        report.check(same(order, row.expected), `${name}: the sidebar order must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(order)}`)
        await mounted.unmount()
      } else if (row.kind === 'soon') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const entries = [...mounted.container.querySelectorAll('nav[aria-label="apps"] .asb-item')]
        const soon = entries.find((item) => item.querySelector('.asb-label')?.textContent === 'community')
        const actual = soon && {
          tag: soon.tagName,
          disabled: soon.getAttribute('aria-disabled'),
          href: soon.getAttribute('href'),
          title: soon.getAttribute('title'),
          text: spoken(soon),
          last: entries.at(-1) === soon,
        }
        report.check(same(actual, row.expected), `${name}: the soon entry must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
        await mounted.unmount()
      } else if (row.kind === 'slot-order') {
        const orders = []
        for (const config of row.configs) {
          const groups = [{ id: 'main', ariaLabel: `${config.app} sections`, items: config.groups.map((id) => ({ id, label: id, href: `/${id}` })) }]
          const props = {
            app: config.app,
            apps: fixture.apps,
            groups,
            storageKey: null,
            theme: 'light',
            onThemeChange: () => {},
            ...(config.search ? { search: { onOpen: () => {} } } : {}),
            ...(config.account ? { account: { handle: config.account } } : {}),
          }
          const mounted = await mount(React.createElement(AppSidebar, props))
          const aside = mounted.container.querySelector('aside')
          const tokenOf = (node) => {
            if (node.matches('nav.asb-apps')) return 'apps'
            if (node.matches('nav.asb-group')) return 'groups'
            if (node.matches('.asb-search')) return 'search'
            if (node.matches('.asb-foot')) return `foot:${[...node.children].map((child) => (child.matches('.asb-theme') ? 'theme' : child.matches('.asb-me') ? 'account' : child.className)).join('+')}`
            return node.className
          }
          const order = [
            aside?.firstElementChild?.classList.contains('asb-top') ? 'top' : aside?.firstElementChild?.className,
            ...[...(aside?.querySelector('.asb-scroll')?.children ?? [])].filter((node) => !node.matches('.asb-indicator')).map(tokenOf),
          ]
          orders.push(order)
          const lastApp = [...mounted.container.querySelectorAll('nav[aria-label="apps"] .asb-label')].at(-1)?.textContent
          report.check(lastApp === row.lastApp, `${name}: the last switcher entry in ${config.app} must be ${row.lastApp}, received ${lastApp}`)
          await mounted.unmount()
        }
        for (const [index, order] of orders.entries()) {
          report.check(same(order, row.expected), `${name}: ${row.configs[index].app} must have the slot order ${JSON.stringify(row.expected)}, received ${JSON.stringify(order)}`)
        }
      } else if (row.kind === 'theme') {
        const calls = []
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row, { onThemeChange: (next) => calls.push(next) })))
        const look = () => {
          const toggle = mounted.container.querySelector('.asb-foot button.asb-theme')
          return toggle && { name: toggle.getAttribute('aria-label'), title: toggle.getAttribute('title'), label: toggle.querySelector('.asb-label')?.textContent, icon: [...toggle.querySelector('.asb-ic svg')?.classList ?? []].find((c) => c.startsWith('lucide-')) }
        }
        report.check(same(look(), row.expected.first), `${name}: the toggle must read ${JSON.stringify(row.expected.first)}, received ${JSON.stringify(look())}`)
        const toggle = mounted.container.querySelector('button.asb-theme')
        if (toggle) await mounted.act(() => click(window, toggle))
        report.check(same(calls, row.expected.calls), `${name}: onThemeChange must report ${JSON.stringify(row.expected.calls)}, received ${JSON.stringify(calls)}`)
        await mounted.rerender(React.createElement(AppSidebar, propsFor(row, { theme: row.expected.calls[0], onThemeChange: (next) => calls.push(next) })))
        report.check(same(look(), row.expected.after), `${name}: after the switch the toggle must read ${JSON.stringify(row.expected.after)}, received ${JSON.stringify(look())}`)
        await mounted.rerender(React.createElement(AppSidebar, propsFor(row, { onThemeChange: undefined })))
        report.check(!mounted.container.querySelector('.asb-theme'), `${name}: without onThemeChange there must be no theme toggle`)
        await mounted.unmount()
      } else if (row.kind === 'search') {
        let opened = 0
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row, { search: { ...row.search, onOpen: () => { opened += 1 } } })))
        const button = mounted.container.querySelector('.asb-search button.asb-item')
        const actual = button && { name: spoken(button), title: button.getAttribute('title'), keys: button.getAttribute('aria-keyshortcuts'), hint: button.querySelector('.asb-kbd')?.textContent ?? null }
        report.check(same(actual, row.expected.button), `${name}: the search item must be ${JSON.stringify(row.expected.button)}, received ${JSON.stringify(actual)}`)
        if (button) await mounted.act(() => click(window, button))
        report.check(opened === 1, `${name}: choosing search must call onOpen once, received ${opened}`)
        await mounted.unmount()
      } else if (row.kind === 'brand') {
        const mounted = await mount(React.createElement(AppSidebar, propsFor(row)))
        const brands = [...mounted.container.querySelectorAll('.asb-brand')]
        const looks = brands.map((brand) => {
          const shown = brand.cloneNode(true)
          shown.querySelectorAll('.asb-sr, [aria-hidden="true"]').forEach((hidden) => hidden.remove())
          return { tag: brand.tagName, name: spoken(brand), title: brand.getAttribute('title'), mark: !!brand.querySelector('svg.asb-mark'), visibleText: shown.textContent.trim() }
        })
        report.check(same(looks, row.expected), `${name}: the brand is the mark alone, expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(looks)}`)
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
            // the handle sits in the brand row, outside the scrolling nav, right after the brand
            inBrandRow: !!toggle?.closest('.asb-top') && !toggle?.closest('.asb-scroll') && toggle?.previousElementSibling?.classList.contains('asb-brand'),
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
