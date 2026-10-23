#!/usr/bin/env node
/* Mounted-source gate for the settings section bar (SettingsNav, SettingsLayout): one nav landmark
   named for the sections, each section a link or a button, aria-current on the current one by kind
   (page, location, true), the choice reported to the host, the section in view marked while the
   reader scrolls, the bar placed beside the body by SettingsLayout, and a router link component.
   jsdom has no layout, so the column-or-row shape (a container query) is checked in the captures,
   not here.
   Cases: scripts/testdata/settings-nav.yaml (+ .manifest.yaml).
   Run: node scripts/settings-nav.test.mjs; mutations: node scripts/parts-mutations.mjs
   scripts/settings-nav.test.mjs scripts/testdata/settings-nav.manifest.yaml. */
import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/settings-nav.yaml'
const MANIFEST = 'scripts/testdata/settings-nav.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('settings nav')

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const spoken = (node) => {
  if (!node) return undefined
  const copy = node.cloneNode(true)
  copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove())
  return copy.textContent.replace(/\s+/g, ' ').trim()
}
const hrefFor = (kind, id) => (kind === 'route' ? `?section=${id}` : kind === 'anchor' ? `#settings-${id}` : undefined)

/* an IntersectionObserver the case drives by hand: `show(el)` reports el as the one in view */
function installObserver() {
  const previous = globalThis.IntersectionObserver
  const observers = []
  globalThis.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this) }
    observe(el) { this.targets.push(el) }
    unobserve() {}
    disconnect() { this.targets = [] }
  }
  return {
    show(el) {
      for (const observer of observers) {
        if (observer.targets.length === 0) continue
        observer.callback(observer.targets.map((target) => ({ target, isIntersecting: target === el })))
      }
    },
    restore() { globalThis.IntersectionObserver = previous },
  }
}

await withMountedSource(async ({ load, mount, window, React }) => {
  const module = await load('/src/ui/SettingsNav.jsx')
  const lucide = await load('lucide-react')
  const barrel = await load('/src/ui/index.js')
  const { SettingsNav, SettingsLayout } = module
  report.check(barrel.SettingsNav === SettingsNav && barrel.SettingsLayout === SettingsLayout, 'SettingsNav and SettingsLayout must be exported from the ui barrel')

  const sectionsFor = (kind) => fixture.sections.map(({ icon, ...section }) => ({
    ...section,
    ...(icon ? { icon: lucide[icon] } : {}),
    ...(hrefFor(kind, section.id) ? { href: hrefFor(kind, section.id) } : {}),
  }))
  const itemFor = (root, id) => [...root.querySelectorAll('.snav-item')]
    .find((item) => item.querySelector('.snav-label')?.textContent === fixture.sections.find((s) => s.id === id)?.label)

  for (const row of fixture.cases) {
    const name = row.name
    const selected = []
    const props = { sections: sectionsFor(row.href), onSelect: (id) => selected.push(id), ...row.props }
    if (row.kind === 'items') {
      const mounted = await mount(React.createElement(SettingsNav, props))
      const navs = mounted.container.querySelectorAll('nav')
      report.check(navs.length === 1 && navs[0].getAttribute('aria-label') === row.expected.landmark, `${name}: one nav landmark named ${JSON.stringify(row.expected.landmark)}`)
      for (const expected of row.expected.items) {
        const item = itemFor(mounted.container, expected.id)
        const actual = item && {
          id: expected.id,
          tag: item.tagName,
          href: item.getAttribute('href') ?? undefined,
          current: item.getAttribute('aria-current'),
          icon: !!item.querySelector('.snav-ic .lucide'),
          text: spoken(item),
        }
        report.check(same(actual, expected), `${name}: ${expected.id} must be ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
      }
      await mounted.unmount()
    } else if (row.kind === 'select') {
      const mounted = await mount(React.createElement(SettingsNav, props))
      const item = itemFor(mounted.container, row.click)
      report.check(item?.tagName === row.expected.tag, `${name}: ${row.click} must be a ${row.expected.tag}`)
      await mounted.act(() => click(window, item))
      report.check(same(selected, row.expected.selected), `${name}: onSelect must report ${JSON.stringify(row.expected.selected)}, received ${JSON.stringify(selected)}`)
      report.check(itemFor(mounted.container, row.props.currentId)?.getAttribute('aria-current') === row.expected.current, `${name}: the current button must carry aria-current=${row.expected.current}`)
      await mounted.unmount()
    } else if (row.kind === 'spy' || row.kind === 'spy-click') {
      const observer = installObserver()
      const targets = fixture.sections.map((section) => {
        const el = window.document.createElement('section')
        el.id = `settings-${section.id}`
        window.document.body.appendChild(el)
        return el
      })
      try {
        const mounted = await mount(React.createElement(SettingsNav, props))
        const currentId = () => fixture.sections.find((section) => itemFor(mounted.container, section.id)?.getAttribute('aria-current') === 'location')?.id ?? null
        if (row.kind === 'spy') {
          report.check(currentId() === row.expected.before, `${name}: before scrolling, ${row.expected.before} must be current, received ${currentId()}`)
          await mounted.act(() => observer.show(window.document.getElementById(`settings-${row.inView}`)))
          report.check(currentId() === row.expected.after, `${name}: after scrolling to ${row.inView}, ${row.expected.after} must be current, received ${currentId()}`)
        } else {
          const link = itemFor(mounted.container, row.click)
          link?.addEventListener('click', (event) => event.preventDefault(), { once: true })
          await mounted.act(() => click(window, link))
          report.check(currentId() === row.expected.after, `${name}: after choosing ${row.click}, ${row.expected.after} must be current, received ${currentId()}`)
          report.check(same(selected, row.expected.selected), `${name}: onSelect must report ${JSON.stringify(row.expected.selected)}, received ${JSON.stringify(selected)}`)
        }
        await mounted.unmount()
      } finally {
        targets.forEach((el) => el.remove())
        observer.restore()
      }
    } else if (row.kind === 'layout') {
      const mounted = await mount(React.createElement(SettingsLayout, props, React.createElement('p', null, row.body)))
      const grid = mounted.container.querySelector('.snav-layout > .snav-grid')
      const actual = {
        grid: !!grid,
        bar: grid?.firstElementChild?.matches('nav.snav') ? grid.firstElementChild.getAttribute('aria-label') : null,
        body: grid?.querySelector(':scope > .snav-body')?.textContent ?? null,
        bodyClass: !!grid?.querySelector(':scope > .snav-body.host-body'),
      }
      report.check(same(actual, row.expected), `${name}: structure must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
      await mounted.unmount()
    } else if (row.kind === 'link-component') {
      const seen = []
      const Link = ({ href, children, ...rest }) => {
        seen.push({ href, current: rest['aria-current'] })
        return React.createElement('a', { href, 'data-router': 'yes', ...rest }, children)
      }
      const mounted = await mount(React.createElement(SettingsNav, { ...props, LinkComponent: Link }))
      const hrefs = [...mounted.container.querySelectorAll('a[data-router="yes"]')].map((a) => a.getAttribute('href'))
      report.check(same(hrefs, row.expected.hrefs), `${name}: every section must go through the link component ${JSON.stringify(row.expected.hrefs)}, received ${JSON.stringify(hrefs)}`)
      report.check(seen.some((entry) => entry.href === row.expected.current && entry.current === 'page'), `${name}: the link component must receive aria-current on the current section`)
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${row.kind}`)
    }
  }
})

report.finish(`${fixture.cases.length} cases over routes, anchors, buttons, the scroll spy, the layout and router links.`)
