/* Shared harness for the mounted-source part gates (transcript viewer chrome, app sections,
   local offline banner, prompt digest split, the page parts). Each gate reads one strict YAML
   fixture plus its required-name manifest, loads the REAL component source through vite's
   ssrLoadModule (no build step), mounts it into jsdom with React's act(), and asserts the DOM a
   user would reach. A manifest may also carry production mutations: FAIRTRADE_PARTS_MUTATION
   holds one {file, find, replace} that the vite transform applies before the source loads, and
   scripts/parts-mutations.mjs re-runs a gate under each one to prove the gate goes red.

   jsdom performs no layout and no default actions (a keydown Enter on a button does not click
   it), so gates drive the component through the events React listens to and leave browser
   behaviour to the Storybook play() functions and the Fairtest mounted rows. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'
import YAML from 'yaml'

export const ROOT = resolve(new URL('..', import.meta.url).pathname)

/** Parse exactly one strict YAML mapping document with unique keys. */
export function loadStrictYaml(relativePath) {
  const source = readFileSync(resolve(ROOT, relativePath), 'utf8')
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  if (documents.length !== 1) throw new Error(`${relativePath}: expected exactly one YAML document`)
  const [document] = documents
  if (document.errors.length > 0) throw new Error(`${relativePath}: invalid YAML: ${document.errors.map((error) => error.message).join('; ')}`)
  const value = document.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${relativePath}: the document root must be a mapping`)
  return value
}

/** The names in `actual` must be unique and equal the required set exactly. */
export function assertExactNames(actual, required, label) {
  if (!Array.isArray(required) || required.some((name) => typeof name !== 'string' || name.length === 0)) {
    throw new Error(`${label}: the manifest must list non-empty names`)
  }
  const seen = new Set(actual)
  if (seen.size !== actual.length) throw new Error(`${label}: duplicate case names`)
  const missing = required.filter((name) => !seen.has(name))
  const extra = actual.filter((name) => !required.includes(name))
  if (missing.length || extra.length) {
    throw new Error(`${label}: case names differ from the required-name manifest; missing=${JSON.stringify(missing)} unexpected=${JSON.stringify(extra)}`)
  }
}

/** Every object in `rows` carries exactly `fields` (plus any `optional` ones). */
export function assertFields(row, fields, label, optional = []) {
  const unknown = Object.keys(row).filter((key) => !fields.includes(key) && !optional.includes(key))
  const missing = fields.filter((key) => !(key in row))
  if (unknown.length || missing.length) throw new Error(`${label}: unknown=${unknown.join(',')} missing=${missing.join(',')}`)
}

/** Load a fixture and its manifest, check the case inventory, and validate the mutation list. */
export function loadFixturePair(fixturePath, manifestPath, families = { cases: 'requiredCaseNames' }) {
  const fixture = loadStrictYaml(fixturePath)
  const manifest = loadStrictYaml(manifestPath)
  for (const [family, requiredKey] of Object.entries(families)) {
    if (!Array.isArray(fixture[family])) throw new Error(`${fixturePath}: ${family} must be a list`)
    assertExactNames(fixture[family].map((row) => row.name), manifest[requiredKey], `${fixturePath} ${family}`)
  }
  const mutations = manifest.mutations ?? []
  if (!Array.isArray(mutations)) throw new Error(`${manifestPath}: mutations must be a list`)
  if (mutations.length > 0) {
    assertExactNames(mutations.map((row) => row.name), manifest.requiredMutationNames, `${manifestPath} mutations`)
    for (const mutation of mutations) {
      assertFields(mutation, ['name', 'file', 'find', 'replace', 'expectedDiagnostic'], `${manifestPath} mutation ${mutation.name}`)
      for (const key of ['name', 'file', 'find', 'expectedDiagnostic']) {
        if (typeof mutation[key] !== 'string' || mutation[key].length === 0) throw new Error(`${manifestPath} mutation ${mutation.name}: ${key} must be a non-empty string`)
      }
    }
  }
  return { fixture, manifest }
}

function mutationPlugin() {
  const raw = process.env.FAIRTRADE_PARTS_MUTATION
  const mutation = raw ? JSON.parse(raw) : null
  return {
    name: 'fairtrade-parts-mutation',
    enforce: 'pre',
    transform(code, id) {
      if (!mutation || !id.split('?')[0].endsWith(`/${mutation.file}`)) return null
      const count = code.split(mutation.find).length - 1
      if (count !== 1) throw new Error(`${mutation.name}: the mutation anchor must occur exactly once in ${mutation.file}, found ${count}`)
      return { code: code.replace(mutation.find, mutation.replace), map: null }
    },
  }
}

/**
 * Start vite in middleware mode over the repo, install a jsdom window as the globals React needs,
 * and hand the gate `load(path)` and `mount(element)`. Everything is torn down in finally.
 */
export async function withMountedSource(run, { url = 'https://fairtrade.invalid/' } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, pretendToBeVisual: true })
  dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {}
  dom.window.HTMLElement.prototype.scrollTo = function scrollTo() {}
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
    Event: dom.window.Event, KeyboardEvent: dom.window.KeyboardEvent, MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: (callback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (handle) => clearTimeout(handle),
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  }
  const previous = new Map()
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // react-dom reads the DOM's capabilities (input events and the like) when it first loads, so it
  // loads only after the jsdom globals exist; loaded earlier it falls back to legacy event paths.
  const { createRoot } = await import('react-dom/client')
  const server = await createServer({ appType: 'custom', configFile: false, logLevel: 'silent', plugins: [mutationPlugin(), react()], root: ROOT, server: { middlewareMode: true } })
  const roots = []
  try {
    const load = (path) => server.ssrLoadModule(path)
    const mount = async (element) => {
      const container = dom.window.document.createElement('div')
      dom.window.document.body.appendChild(container)
      const root = createRoot(container)
      roots.push({ root, container })
      await act(async () => { root.render(element); await Promise.resolve() })
      return {
        container,
        document: dom.window.document,
        async act(step) { await act(async () => { await step(); await Promise.resolve() }) },
        async settle(ms = 5) { await act(async () => { await new Promise((done) => setTimeout(done, ms)) }) },
        async rerender(next) { await act(async () => { root.render(next); await Promise.resolve() }) },
        async unmount() {
          await act(async () => root.unmount())
          container.remove()
          const index = roots.findIndex((entry) => entry.root === root)
          if (index >= 0) roots.splice(index, 1)
        },
      }
    }
    return await run({ load, mount, window: dom.window, React })
  } finally {
    for (const { root, container } of roots.splice(0)) {
      await act(async () => root.unmount())
      container.remove()
    }
    await server.close()
    dom.window.close()
    for (const [key, descriptor] of previous) {
      if (descriptor === undefined) delete globalThis[key]
      else Object.defineProperty(globalThis, key, descriptor)
    }
  }
}

/** Dispatch a click the way React hears it. */
export function click(window, element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
}

/** Dispatch a keydown the way React hears it; returns whether a handler prevented the default. */
export function keydown(window, element, key, init = {}) {
  const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  element.dispatchEvent(event)
  return event.defaultPrevented
}

/** Collect named failures and report them with the gate's context, or print the pass line. */
export function createReport(gate) {
  const failures = []
  let checks = 0
  return {
    check(passed, message) {
      checks += 1
      if (!passed) failures.push(message)
    },
    finish(summary) {
      if (failures.length > 0) {
        console.error(`${gate} failed:\n- ${failures.join('\n- ')}`)
        process.exit(1)
      }
      console.log(`${gate}: ${checks} checks passed; ${summary}`)
    },
  }
}
