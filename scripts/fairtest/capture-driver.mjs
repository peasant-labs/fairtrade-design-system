// @ts-check

// App-owned capture driver.
//
// Serves one built tree on loopback and drives every case x width x theme:
// pauses animations, parks the pointer off the target and its control group,
// reads computed style and contrast, writes an element shot and the full-region
// shot, and captures the hover and keyboard focus representatives. Every
// unshootable target is recorded with an explicit reason inside the certified
// record; a target is never silently omitted and a shot is never fabricated.
//
// The tree is served from an in-process loopback static server with explicit
// MIME types and no directory listing, and the served bytes are proven equal to
// the built tree before any record is written. The model validation, the row
// serialization, and the served-versus-dist comparison live in the browser-free
// child; this module owns the page driving and the file I/O.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { importFairtestSource } from '../fairtest-source.mjs'

const captureCases = await importFairtestSource('src/capture/cases.mjs')
const captureRecord = await importFairtestSource('src/capture/record.mjs')
const captureBuild = await importFairtestSource('src/capture/build.mjs')

/**
 * @typedef {object} CaptureSurfaceLike
 * @property {string} id
 * @property {string} kind
 * @property {string} path
 * @property {string} query
 * @property {string} hash
 * @property {string} root
 * @property {{ name: string, selector: string, hover?: boolean, stateLabel?: boolean }[]} probes
 * @property {{ name: string, selector: string }[]} focus
 */

/**
 * @typedef {object} CaptureCasesLike
 * @property {string[]} states
 * @property {number[]} widths
 * @property {string[]} themes
 * @property {CaptureSurfaceLike[]} surfaces
 */

/**
 * @typedef {object} CaptureTargetLike
 * @property {string} target
 * @property {string} kind
 * @property {string} selector
 * @property {Record<string, unknown> | null} read
 * @property {Record<string, unknown> | null} contrast
 * @property {{ file: string, sha256: string } | null} shot
 * @property {{ reason: string } | null} unshootable
 */

/**
 * @typedef {object} CaptureRecordLike
 * @property {string} state
 * @property {string} surface
 * @property {string} kind
 * @property {number} width
 * @property {string} theme
 * @property {number} observedAtMs
 * @property {{ asset: string, sha256: string }[]} servedAssets
 * @property {CaptureTargetLike[]} targets
 */

/**
 * @typedef {object} CaptureBuildLike
 * @property {string} state
 * @property {string} root
 * @property {string} head
 * @property {boolean} dirty
 * @property {{ asset: string, sha256: string }[]} assets
 * @property {{ asset: string, sha256: string, servedEqualsDist: boolean }[]} served
 */

/**
 * @typedef {object} CaptureStateOptions
 * @property {string} state state id
 * @property {string} origin loopback origin of the served tree
 * @property {string} distRoot built tree root
 * @property {string} label worktree head or explicit build label
 * @property {CaptureCasesLike} cases validated capture-case document
 * @property {string} outRoot capture root
 * @property {import('@playwright/test').Browser} browser launched browser
 */

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
}

const BASE_QUERY = 'fb=off'
const GROUP_SELECTOR = '[role="group"], .bs-seg, .sw-field, .sw-group, .sw-toggle-row, .bs-grid, .bs-cell, .cex-topics, .gan-toggle-chips, .iu-tabs, .specimen-body'

/**
 * SHA-256 hex digest of bytes or a string.
 * @param {Buffer | string} data bytes to hash
 * @returns {string}
 */
function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Start a loopback static server for one built tree. No directory listing; an
 * unknown path falls back to the tree's index document.
 * @param {string} distRoot built tree root
 * @returns {Promise<{ origin: string, close: () => Promise<void> }>}
 */
export function serveDist(distRoot) {
  const root = resolve(distRoot)
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      let path = decodeURIComponent(url.pathname)
      if (path === '/' || path === '') path = '/index.html'
      const absolute = join(root, normalize(path))
      if (absolute !== root && !absolute.startsWith(root + sep)) {
        response.writeHead(403)
        response.end('forbidden')
        return
      }
      let file = absolute
      if (existsSync(file) && !extname(file)) file = join(file, 'index.html')
      if (!existsSync(file)) file = join(root, 'index.html')
      const body = readFileSync(file)
      response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
      response.end(body)
    } catch (error) {
      response.writeHead(404, { 'content-type': 'text/plain' })
      response.end(String(error))
    }
  })
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolvePromise({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}

/**
 * Read the built tree's asset digests from the asset references its index
 * document names.
 * @param {string} distRoot built tree root
 * @returns {{ asset: string, sha256: string }[]}
 */
export function readDistAssets(distRoot) {
  const index = readFileSync(join(distRoot, 'index.html'), 'utf8')
  const refs = [...index.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
  return refs.map((ref) => ({
    asset: ref,
    sha256: sha256(readFileSync(join(distRoot, ...ref.split('/').filter((segment) => segment.length > 0)))),
  }))
}

/**
 * Prove the served origin is the exact built tree: every asset reference the
 * served index names is fetched and compared byte for byte with the tree.
 * @param {string} origin loopback origin
 * @param {string} distRoot built tree root
 * @returns {Promise<{ asset: string, sha256: string, servedEqualsDist: boolean }[]>}
 */
export async function servedMatchesDist(origin, distRoot) {
  const html = await (await fetch(`${origin}/`)).text()
  const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
  const served = []
  for (const ref of refs) {
    const bytes = Buffer.from(await (await fetch(origin + ref)).arrayBuffer())
    const onDisk = readFileSync(join(distRoot, ...ref.split('/').filter((segment) => segment.length > 0)))
    served.push({ asset: ref, sha256: sha256(bytes), servedEqualsDist: bytes.equals(onDisk) })
  }
  return served
}

/**
 * Read the worktree head and dirty flag of the tree a dist root was built from.
 * @param {string} distRoot built tree root
 * @returns {{ head: string, dirty: boolean }}
 */
export function gitInfo(distRoot) {
  const worktree = dirname(resolve(distRoot))
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worktree, encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: worktree, encoding: 'utf8' }).trim().length > 0
  return { head, dirty }
}

/**
 * Parse a CSS color string into channels, or null when unparseable.
 * @param {string} value CSS color string
 * @returns {{ r: number, g: number, b: number } | null}
 */
function parseColor(value) {
  const match = String(value).match(/rgba?\(([^)]+)\)/)
  if (!match) return null
  const parts = match[1].split(',').map((entry) => Number.parseFloat(entry.trim()))
  if (parts.length < 3 || parts.some((entry) => !Number.isFinite(entry))) return null
  return { r: parts[0], g: parts[1], b: parts[2] }
}

/**
 * WCAG contrast ratio between two CSS color strings, or null when either is
 * unparseable.
 * @param {string} foreground CSS color string
 * @param {string} background CSS color string
 * @returns {number | null}
 */
export function contrastRatio(foreground, background) {
  const first = parseColor(foreground)
  const second = parseColor(background)
  if (!first || !second) return null
  /** @param {{ r: number, g: number, b: number }} color @returns {number} */
  const luminance = (color) => {
    /** @param {number} channel @returns {number} */
    const channelValue = (channel) => {
      const scaled = channel / 255
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channelValue(color.r) + 0.7152 * channelValue(color.g) + 0.0722 * channelValue(color.b)
  }
  const high = Math.max(luminance(first), luminance(second))
  const low = Math.min(luminance(first), luminance(second))
  return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100
}

/**
 * The read payload runs inside the page; it observes computed style only.
 * @param {{ selector: string, wantStateLabel: boolean }} input read inputs
 * @returns {Record<string, unknown> | null}
 */
function readTargetInPage({ selector, wantStateLabel }) {
  const element = document.querySelector(selector)
  if (!element) return null
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  /** @param {Element} node @returns {string} */
  const effectiveBackground = (node) => {
    let current = node
    while (current) {
      const background = getComputedStyle(current).backgroundColor
      if (background && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') return background
      current = /** @type {Element} */ (current.parentElement)
    }
    return 'rgb(255, 255, 255)'
  }
  const before = getComputedStyle(element, '::before')
  const after = getComputedStyle(element, '::after')
  /** @type {Record<string, unknown> | null} */
  let hiddenAncestor = null
  for (let node = element.parentElement; node; node = node.parentElement) {
    const candidate = getComputedStyle(node)
    if (candidate.display === 'none') {
      const classes = typeof node.className === 'string' ? node.className.trim() : ''
      hiddenAncestor = {
        tag: node.tagName.toLowerCase(),
        classes,
        selector: `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}${classes ? '.' + classes.split(/\s+/).join('.') : ''}`,
        display: candidate.display,
      }
      break
    }
  }
  let stateLabelColor = null
  if (wantStateLabel) {
    const field = element.closest('.sw-field')
    const state = field ? field.querySelector('.sw-state') : null
    if (state) stateLabelColor = getComputedStyle(state).color
  }
  const disabledProperty = /** @type {{ disabled?: unknown }} */ (element).disabled
  const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0
  return {
    tag: element.tagName.toLowerCase(),
    text: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
    bg: style.backgroundColor,
    effBg: effectiveBackground(element),
    color: style.color,
    borderColor: style.borderTopColor,
    borderTopWidth: style.borderTopWidth,
    borderRadius: style.borderTopLeftRadius,
    opacity: style.opacity,
    fontWeight: style.fontWeight,
    outlineColor: style.outlineColor,
    outlineStyle: style.outlineStyle,
    outlineWidth: style.outlineWidth,
    outlineOffset: style.outlineOffset,
    boxShadow: style.boxShadow,
    minHeight: style.minHeight,
    fontSize: style.fontSize,
    disabled: typeof disabledProperty === 'boolean' ? disabledProperty : null,
    display: style.display,
    hiddenAncestor,
    stateLabelColor,
    beforeBg: before.backgroundColor,
    beforeContent: before.content,
    beforeTransform: before.transform,
    afterContent: after.content,
    afterBorderColor: after.borderBottomColor,
    afterBorderWidth: after.borderBottomWidth,
    afterBg: after.backgroundColor,
    visible,
    inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth,
    parentDisabledFieldset: element.closest('fieldset[disabled]') !== null,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
  }
}

/**
 * The hover read payload runs inside the page.
 * @param {string} selector target selector
 * @returns {Record<string, unknown> | null}
 */
function readHoverTargetInPage(selector) {
  const element = document.querySelector(selector)
  if (!element) return null
  const style = getComputedStyle(element)
  /** @param {Element} node @returns {string} */
  const effectiveBackground = (node) => {
    let current = node
    while (current) {
      const background = getComputedStyle(current).backgroundColor
      if (background && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') return background
      current = /** @type {Element} */ (current.parentElement)
    }
    return 'rgb(255, 255, 255)'
  }
  return {
    bg: style.backgroundColor,
    effBg: effectiveBackground(element),
    color: style.color,
    borderColor: style.borderTopColor,
    text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
  }
}

/**
 * Park the pointer outside the target and outside its control group, then
 * verify the target is not hovered.
 * @param {import('@playwright/test').Page} page live page
 * @param {string} selector target selector
 * @returns {Promise<{ pointerParked: boolean, parkPoint: number[], hoveredAtShot: boolean }>}
 */
async function ensureNotHovered(page, selector) {
  const { candidates } = await page.evaluate(({ target, groupSelector }) => {
    const points = [[6, 6], [window.innerWidth - 6, 6], [6, window.innerHeight - 6], [window.innerWidth - 6, window.innerHeight - 6], [Math.round(window.innerWidth / 2), 6], [6, Math.round(window.innerHeight / 2)]]
    const element = document.querySelector(target)
    if (!element) return { candidates: points }
    const group = element.closest(groupSelector) || element.parentElement || element
    const bounds = group.getBoundingClientRect()
    const own = element.getBoundingClientRect()
    /** @param {DOMRect} rect @param {number} pad @returns {(point: number[]) => boolean} */
    const outside = (rect, pad) => (point) => point[0] < rect.left - pad || point[0] > rect.right + pad || point[1] < rect.top - pad || point[1] > rect.bottom + pad
    /** @param {number[]} point @param {DOMRect} rect @returns {number} */
    const distance = (point, rect) => {
      const closestX = Math.max(rect.left, Math.min(point[0], rect.right))
      const closestY = Math.max(rect.top, Math.min(point[1], rect.bottom))
      return (point[0] - closestX) ** 2 + (point[1] - closestY) ** 2
    }
    const outsideGroup = points.filter(outside(bounds, 4))
    const outsideElement = points.filter(outside(own, 2))
    const far = points.slice().sort((left, right) => distance(right, own) - distance(left, own)).slice(0, 3)
    const seen = new Set()
    /** @type {number[][]} */
    const candidates = []
    for (const point of [...outsideGroup, ...outsideElement, ...far]) {
      const key = point.join(',')
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push(point)
    }
    return { candidates }
  }, { target: selector, groupSelector: GROUP_SELECTOR })
  let hovered = false
  for (const point of candidates) {
    await page.mouse.move(point[0], point[1])
    await page.waitForTimeout(150)
    hovered = await page.evaluate((target) => {
      const element = document.querySelector(target)
      return element ? element.matches(':hover') : false
    }, selector)
    if (!hovered) return { pointerParked: true, parkPoint: point, hoveredAtShot: false }
  }
  const last = candidates[candidates.length - 1] ?? [0, 0]
  return { pointerParked: true, parkPoint: last, hoveredAtShot: hovered }
}

/**
 * Check whether the target is the active element and shows a focus ring.
 * @param {import('@playwright/test').Page} page live page
 * @param {string} selector target selector
 * @returns {Promise<{ activeElementIsTarget: boolean, matchesFocusVisible: boolean, activeElement: string | null }>}
 */
async function checkFocus(page, selector) {
  return page.evaluate((target) => {
    const element = document.querySelector(target)
    if (!element) return { activeElementIsTarget: false, matchesFocusVisible: false, activeElement: null }
    const active = document.activeElement
    const activeLabel = active === null
      ? null
      : `${active.tagName.toLowerCase()}${typeof active.className === 'string' && active.className.trim() ? '.' + active.className.trim().split(/\s+/)[0] : ''}`
    return { activeElementIsTarget: active === element, matchesFocusVisible: element.matches(':focus-visible'), activeElement: activeLabel }
  }, selector)
}

/**
 * Reach a genuine keyboard focus ring: script-focus the target, leave it with a
 * real Shift+Tab, then return with a real Tab. Falls back to a bounded Tab
 * walk. A target that cannot show a real ring is reported unshootable by the
 * caller, never script-faked.
 * @param {import('@playwright/test').Page} page live page
 * @param {string} selector target selector
 * @returns {Promise<{ method: string }>}
 */
async function keyboardFocus(page, selector) {
  const focused = await page.evaluate((target) => {
    const element = /** @type {HTMLElement | null} */ (document.querySelector(target))
    if (element === null) return false
    element.focus()
    return true
  }, selector)
  if (!focused) return { method: 'none' }
  await page.waitForTimeout(30)
  await page.keyboard.press('Shift+Tab')
  await page.waitForTimeout(30)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(80)
  let result = await checkFocus(page, selector)
  let method = 'script-focus + Shift+Tab + Tab'
  if (!result.activeElementIsTarget || !result.matchesFocusVisible) {
    await page.evaluate((target) => {
      const element = /** @type {HTMLElement | null} */ (document.querySelector(target))
      if (element !== null) element.focus()
    }, selector)
    await page.waitForTimeout(30)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(30)
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(80)
    const retry = await checkFocus(page, selector)
    if (retry.activeElementIsTarget && retry.matchesFocusVisible) {
      result = retry
      method = 'script-focus + Tab + Shift+Tab'
    }
  }
  if (!result.activeElementIsTarget || !result.matchesFocusVisible) {
    for (let index = 0; index < 40 && !(result.activeElementIsTarget && result.matchesFocusVisible); index += 1) {
      await page.evaluate(() => {
        const active = /** @type {HTMLElement | null} */ (document.activeElement)
        if (active && typeof active.blur === 'function') active.blur()
      })
      await page.keyboard.press('Tab')
      await page.waitForTimeout(15)
      result = await checkFocus(page, selector)
      if (result.activeElementIsTarget) method = `Tab-walk (${index + 1} presses)`
    }
  }
  return { method }
}

/**
 * Pause every running animation at time zero so a read and a shot see the same
 * static frame.
 * @param {import('@playwright/test').Page} page live page
 * @returns {Promise<void>}
 */
async function pauseAnimations(page) {
  await page.evaluate(() => {
    document.getAnimations().forEach((animation) => {
      animation.pause()
      animation.currentTime = 0
    })
  })
}

/**
 * Write an element shot, returning whether the file exists afterwards.
 * @param {import('@playwright/test').Locator} locator target locator
 * @param {string} path output path
 * @returns {Promise<boolean>}
 */
async function writeShot(locator, path) {
  mkdirSync(dirname(path), { recursive: true })
  try {
    await locator.screenshot({ path, timeout: 8000 })
  } catch {
    /* recorded as unshootable by the caller */
  }
  return existsSync(path)
}

/**
 * Write a padded shot so a focus ring drawn outside the element box stays in
 * the artifact.
 * @param {import('@playwright/test').Page} page live page
 * @param {import('@playwright/test').Locator} locator target locator
 * @param {string} path output path
 * @param {number} [pad] padding in pixels
 * @returns {Promise<boolean>}
 */
async function writePaddedShot(page, locator, path, pad = 5) {
  const box = await locator.boundingBox().catch(() => null)
  if (!box) return false
  mkdirSync(dirname(path), { recursive: true })
  const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 }
  try {
    await page.screenshot({ path, clip, timeout: 8000 })
  } catch {
    /* recorded as unshootable by the caller */
  }
  return existsSync(path)
}

/**
 * An explicit reason a target had no shot.
 * @param {Record<string, unknown> | null} read observed read payload
 * @param {string} selector target selector
 * @returns {string}
 */
function invisibleReason(read, selector) {
  if (!read) return `no element matched selector ${selector}`
  const rect = /** @type {{ w: number, h: number }} */ (read.rect)
  const parts = [`not painted at capture time (rect ${rect.w}x${rect.h}; own display ${String(read.display)}; own opacity ${String(read.opacity)})`]
  const hidden = /** @type {Record<string, unknown> | null} */ (read.hiddenAncestor)
  parts.push(hidden ? `nearest ancestor whose computed display is none: ${String(hidden.selector)} (display ${String(hidden.display)})` : 'no ancestor with computed display none')
  return parts.join('; ')
}

/**
 * Compose the page URL for one surface and theme.
 * @param {string} origin loopback origin
 * @param {CaptureSurfaceLike} surface capture surface
 * @param {string} theme theme name
 * @returns {string}
 */
function pageUrl(origin, surface, theme) {
  const query = [BASE_QUERY, surface.query, `theme=${theme}`].filter((entry) => typeof entry === 'string' && entry.length > 0).join('&')
  return `${origin}${surface.path}?${query}${surface.hash}`
}

/**
 * A shot reference from a written file.
 * @param {string} outRoot capture root
 * @param {string} relative capture-root-relative path
 * @returns {{ file: string, sha256: string }}
 */
function shotRef(outRoot, relative) {
  const bytes = readFileSync(join(outRoot, ...relative.split('/')))
  return { file: relative, sha256: sha256(bytes) }
}

/**
 * Capture one state against one served tree, writing every shot and row.
 * @param {CaptureStateOptions} options capture options
 * @returns {Promise<{ build: CaptureBuildLike, records: CaptureRecordLike[], files: string[] }>}
 */
export async function captureState({ state, origin, distRoot, label, cases, outRoot, browser }) {
  const assets = readDistAssets(distRoot)
  const served = await servedMatchesDist(origin, distRoot)
  const build = captureBuild.assertServedMatchesDist({ state, root: resolve(distRoot), head: label, dirty: gitInfo(distRoot).dirty, assets, served })

  /** @type {CaptureRecordLike[]} */
  const records = []
  /** @type {string[]} */
  const files = []
  for (const surface of cases.surfaces) {
    for (const width of cases.widths) {
      for (const theme of cases.themes) {
        const key = captureCases.captureRowKey(surface.id, width, theme)
        const url = pageUrl(origin, surface, theme)
        const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' })
        try {
          page.setDefaultTimeout(9000)
          page.setDefaultNavigationTimeout(25000)
          await page.goto(url, { waitUntil: 'domcontentloaded' })
          await page.evaluate(() => document.fonts.ready)
          await page.waitForTimeout(500)
          const root = page.locator(surface.root).first()
          await root.waitFor({ state: 'visible' })
          await root.evaluate((/** @type {Element} */ node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }))
          await pauseAnimations(page)
          const observedTheme = await page.locator('html').getAttribute('data-theme')
          if (observedTheme !== theme) throw new Error(`theme mismatch ${observedTheme} != ${theme} for ${url}`)

          const surfaceRel = `rows/${state}/${key}/surface.png`
          const surfacePath = join(outRoot, ...surfaceRel.split('/'))
          mkdirSync(dirname(surfacePath), { recursive: true })
          try {
            await root.screenshot({ path: surfacePath, timeout: 8000 })
          } catch {
            await page.screenshot({ path: surfacePath }).catch(() => {})
          }
          if (!existsSync(surfacePath)) throw new Error(`full-region shot did not write a file for ${key}`)
          files.push(surfaceRel)

          /** @type {CaptureTargetLike[]} */
          const targets = []
          for (const probe of surface.probes) {
            await page.locator(probe.selector).first().scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {})
            await pauseAnimations(page)
            await page.waitForTimeout(60)
            await ensureNotHovered(page, probe.selector)
            const read = await page.evaluate(readTargetInPage, { selector: probe.selector, wantStateLabel: Boolean(probe.stateLabel) })
            const contrast = read
              ? { text: contrastRatio(String(read.color), String(read.effBg)), beforeVsEffBg: contrastRatio(String(read.beforeBg), String(read.effBg)) }
              : null
            const shotRel = `shots/${state}/${surface.id}-${width}-${theme}-${probe.name}.png`
            let shot = null
            let unshootable = null
            const rect = /** @type {{ w: number, h: number } | null} */ (read ? read.rect : null)
            if (read && read.visible === true && rect && rect.w > 0 && rect.h > 0) {
              const written = await writeShot(page.locator(probe.selector).first(), join(outRoot, ...shotRel.split('/')))
              if (written) {
                shot = shotRef(outRoot, shotRel)
                files.push(shotRel)
              } else {
                unshootable = { reason: `screenshot attempt failed for ${probe.selector}` }
              }
            } else {
              unshootable = { reason: invisibleReason(read, probe.selector) }
            }
            targets.push({ target: probe.name, kind: 'probe', selector: probe.selector, read, contrast, shot, unshootable })

            if (probe.hover) {
              const target = page.locator(probe.selector).first()
              await target.hover().catch(() => {})
              await page.waitForTimeout(80)
              const hoverRead = await page.evaluate(readHoverTargetInPage, probe.selector)
              const hoverRel = `shots/${state}/${surface.id}-${width}-${theme}-${probe.name}-hover.png`
              let hoverShot = null
              let hoverUnshootable = null
              const written = await writeShot(target, join(outRoot, ...hoverRel.split('/')))
              if (written) {
                hoverShot = shotRef(outRoot, hoverRel)
                files.push(hoverRel)
              } else {
                hoverUnshootable = { reason: `hover screenshot attempt failed for ${probe.selector}` }
              }
              targets.push({
                target: probe.name,
                kind: 'hover',
                selector: probe.selector,
                read: hoverRead,
                contrast: hoverRead ? { text: contrastRatio(String(hoverRead.color), String(hoverRead.effBg)) } : null,
                shot: hoverShot,
                unshootable: hoverUnshootable,
              })
              await ensureNotHovered(page, probe.selector)
            }
          }

          for (const focus of surface.focus) {
            await page.locator(focus.selector).first().scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {})
            await pauseAnimations(page)
            const read = await page.evaluate(readTargetInPage, { selector: focus.selector, wantStateLabel: false })
            const rect = /** @type {{ w: number, h: number } | null} */ (read ? read.rect : null)
            const focusRel = `shots/${state}/${surface.id}-${width}-${theme}-${focus.name}.png`
            if (!read || read.visible !== true || !rect || rect.w === 0 || rect.h === 0) {
              targets.push({
                target: focus.name,
                kind: 'focus',
                selector: focus.selector,
                read,
                contrast: null,
                shot: null,
                unshootable: { reason: `focus representative not painted at this width: ${invisibleReason(read, focus.selector)}` },
              })
              continue
            }
            const keyboard = await keyboardFocus(page, focus.selector)
            await ensureNotHovered(page, focus.selector)
            const info = await checkFocus(page, focus.selector)
            const focusRead = { ...read, focusMethod: keyboard.method, activeElementIsTarget: info.activeElementIsTarget, matchesFocusVisible: info.matchesFocusVisible, activeElement: info.activeElement }
            let shot = null
            let unshootable = null
            if (info.activeElementIsTarget && info.matchesFocusVisible) {
              const written = await writePaddedShot(page, page.locator(focus.selector).first(), join(outRoot, ...focusRel.split('/')))
              if (written) {
                shot = shotRef(outRoot, focusRel)
                files.push(focusRel)
              } else {
                unshootable = { reason: 'focus screenshot attempt failed after the element was confirmed focus-visible' }
              }
            } else {
              unshootable = {
                reason: `genuine keyboard focus ring could not be achieved (method ${keyboard.method}; activeElementIsTarget=${info.activeElementIsTarget}; matchesFocusVisible=${info.matchesFocusVisible}); not script-faked`,
              }
            }
            targets.push({ target: focus.name, kind: 'focus', selector: focus.selector, read: focusRead, contrast: null, shot, unshootable })
          }

          targets.push({ target: 'surface', kind: 'surface', selector: surface.root, read: null, contrast: null, shot: shotRef(outRoot, surfaceRel), unshootable: null })

          const record = captureRecord.createCaptureRecord({
            state,
            surface: surface.id,
            kind: surface.kind,
            width,
            theme,
            observedAtMs: Date.now(),
            servedAssets: assets,
            targets,
          })
          captureRecord.reconcileCaptureRecord(record, files, `${state}/${key}`)
          records.push(record)
          writeFileSync(join(outRoot, 'rows', state, key, 'capture.json'), captureRecord.serializeCaptureRecord(record))
          writeFileSync(join(outRoot, 'rows', state, key, 'provenance.json'), `${JSON.stringify(build, null, 2)}\n`)
        } finally {
          await page.close()
        }
      }
    }
  }
  return { build, records, files }
}
