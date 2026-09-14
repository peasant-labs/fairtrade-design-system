import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import YAML from 'yaml'
import { installHarnessGuard } from './harness-guard.mjs'

const output = process.env.HELPER_CAPTURE_DIR || '/tmp/opencode/helper-tree-captures'
const chrome = process.env.CHROME_PATH || '/home/minttea/.nix-profile/bin/google-chrome'
const port = Number(process.env.HELPER_DEMO_PORT || 5289)
const fixtures = YAML.parse(readFileSync('scripts/testdata/helper_group_listing.yaml', 'utf8'))
const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.js'))
// Build provenance: the served bundle must carry both the demo marker and the
// tree-anatomy classes only the rewritten components emit.
const bundle = assets.map((name) => readFileSync(`dist/assets/${name}`, 'utf8')).join('\n')
assert.ok(bundle.includes('data-helper-demo'), 'built artifact must contain the helper demo marker; rebuild this checkout')
assert.ok(bundle.includes('helper-thread-facts'), 'built artifact must contain the ordinary-row fact line; rebuild this checkout')
assert.ok(bundle.includes('helper-tree-rail__path'), 'built artifact must contain the traced connector; rebuild this checkout')
mkdirSync(output, { recursive: true })
installHarnessGuard({ label: 'helper groups mounted probe' })
const served = await preview({ configFile: false, preview: { port, strictPort: true, host: '127.0.0.1' } })
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, defaultViewport: { width: 1440, height: 1000 } })
const evidence = { source: process.cwd(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), assets, probes: [] }
const luminance = (css) => {
  const channels = css.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255)
    .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)
try {
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    // The connector is measured into an animation frame, so the mounted anchor
    // count settles asynchronously after every change.
    const waitForAnchors = (expected) => page.waitForFunction(
      (wanted) => [...document.querySelectorAll('.helper-tree-rail')]
        .reduce((total, el) => total + Number(el.dataset.anchorCount), 0) === wanted,
      { timeout: 10000 }, expected)
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    for (const fixture of fixtures.cases) {
      await page.goto(`http://127.0.0.1:${port}/?app=commons&helpers=${fixture.name}&theme=${theme}#inuse`, { waitUntil: 'networkidle2' })
      await page.waitForSelector(`[data-helper-demo="${fixture.name}"] .helper-group-trigger`)
      await page.$eval('#inuse', (element) => element.scrollIntoView({ behavior: 'instant' }))
      await page.evaluate(() => document.fonts.ready)
      assert.ok(await page.$eval('.iu-subnav', (el) => el.textContent.includes('explore')), 'mounted shell and navigation')
      const triggers = await page.$$('.helper-group-trigger')
      assert.equal(triggers.length, fixture.groups.length, `${fixture.name}: one control per group`)
      // The closed control states its count, and the members it holds do not exist.
      assert.deepEqual(await page.$$eval('.helper-group-count', (els) => els.map((el) => el.textContent)),
        fixture.expectedLabels, `${fixture.name}: closed control label`)
      assert.equal(await page.$('.helper-group-members'), null, 'members exist only while expanded')
      assert.equal(await page.$('.helper-thread-marker'), null, 'no subagent-inset marker anywhere')
      // ONE tree per rendered result item, ONE connector each. Collapsed, the
      // only mounted checkbox is the owner's, and a tree with an ownerless
      // context has nothing to trace.
      const ownerAnchorsPerTree = fixture.groups.map(() => fixture.owner ? 1 : 0)
      assert.equal(await page.$$eval('.helper-tree', (els) => els.length), fixture.groups.length, 'one tree container per rendered result item')
      assert.equal(await page.$$eval('.helper-tree-rail', (els) => els.length), fixture.groups.length, 'one connector per tree')
      await waitForAnchors(fixture.expectedAnchorCounts.collapsed)
      const collapsedAnchors = await page.$$eval('.helper-tree-rail', (els) => els.map((el) => Number(el.dataset.anchorCount)))
      assert.deepEqual(collapsedAnchors, ownerAnchorsPerTree, `${fixture.name}: collapsed rail anchors`)
      assert.equal(collapsedAnchors.reduce((total, count) => total + count, 0), fixture.expectedAnchorCounts.collapsed)
      assert.equal(await page.$$eval('.helper-tree-rail__path', (els) => els.length),
        ownerAnchorsPerTree.filter((count) => count > 0).length, 'collapsed rail paints exactly when an anchor is mounted')
      assert.equal(await page.$$eval('.helper-group-trigger', (els) => els.every((el) => el.firstElementChild?.tagName.toLowerCase() === 'svg')), true, 'chevron leads every control')
      assert.equal(await page.$$eval('.helper-group-trigger', (els) => els.every((el) => el.closest('.helper-tree-children') !== null)), true, 'every chip sits indented inside the tree')
      assert.equal(await page.$$eval('.helper-group-trigger input, .helper-group-context input', (els) => els.length), 0, 'the chip and the context line carry no checkbox')
      assert.deepEqual(await page.$$eval('.helper-group-trigger', (els) => els.map((el) => el.querySelector('.helper-group-show').textContent)),
        fixture.groups.map(() => 'show'), 'closed control offers show')
      if (fixture.name === 'three-independent-counts') await page.screenshot({ path: resolve(output, `${theme}-collapsed.png`) })
      for (const trigger of triggers) {
        await trigger.focus()
        await page.keyboard.press('Enter')
        assert.equal(await trigger.evaluate((el) => el.getAttribute('aria-expanded')), 'true')
        assert.ok(await trigger.evaluate((el) => document.activeElement === el), 'keyboard expansion retains focus')
        assert.equal(await trigger.evaluate((el) => el.querySelector('.helper-group-show').textContent), 'hide', 'open control offers hide')
      }
      // The connector re-measures after expansion: every revealed member row is
      // an anchor, and the single path traces them. The re-measure is scheduled
      // into an animation frame, exactly like the reference, so poll for it.
      const expandedPerTree = fixture.groups.map((group) =>
        (fixture.owner ? 1 : 0) + (fixture.scopeExpired ? 0 : group.members.length))
      await waitForAnchors(fixture.expectedAnchorCounts.expanded)
      const expandedAnchors = await page.$$eval('.helper-tree-rail', (els) => els.map((el) => Number(el.dataset.anchorCount)))
      assert.deepEqual(expandedAnchors, expandedPerTree, `${fixture.name}: expanded rail anchors`)
      assert.equal(expandedAnchors.reduce((total, count) => total + count, 0), fixture.expectedAnchorCounts.expanded)
      assert.deepEqual(await page.$$eval('.helper-group-members [data-thread-id]', (rows) => rows.map((el) => el.dataset.threadId)), fixture.expectedRows)
      assert.equal(await page.$$eval('.helper-thread-marker', (els) => els.length), 0, 'revealed rows carry no inset marker')
      assert.equal(await page.$$eval('.helper-group-members [data-thread-id]', (rows) => rows.every((el) =>
        el.querySelector('.helper-thread-facts') && el.querySelector('.helper-thread-sep') && el.querySelector('.helper-thread-open'))), true,
        'every member row reads as title + middot facts + authorized link')
      // The connector geometry is measured, not authored: its first point sits
      // RAIL_CAP above the first mounted checkbox centre, its last the same
      // below the last, every x is an anchor column, and one horizontal step
      // exists per depth change (never a step across a label).
      const geometry = await page.evaluate(() => {
        const tree = document.querySelector('.helper-tree')
        const treeRect = tree.getBoundingClientRect()
        const anchors = [...tree.querySelectorAll('input[type="checkbox"]')].map((input) => {
          const rect = input.getBoundingClientRect()
          return { x: rect.left + rect.width / 2 - treeRect.left, y: rect.top + rect.height / 2 - treeRect.top }
        }).sort((a, b) => a.y - b.y)
        const path = tree.querySelector('.helper-tree-rail__path')
        return { anchors, d: path ? path.getAttribute('d') : '',
          fill: path ? getComputedStyle(path).fill : null,
          stroke: path ? getComputedStyle(path).stroke : null,
          strokeWidth: path ? getComputedStyle(path).strokeWidth : null }
      })
      assert.equal(geometry.anchors.length, expandedPerTree[0], `${fixture.name}: mounted checkbox anchors in the first tree`)
      if (geometry.anchors.length > 0) {
        assert.equal(geometry.fill, 'none', 'the connector only paints its stroke')
        assert.equal(geometry.strokeWidth, '1px', 'the connector hairline is one rule width')
        const points = geometry.d.match(/-?\d+(?:\.\d+)?/g).map(Number)
        const first = geometry.anchors[0]
        const last = geometry.anchors[geometry.anchors.length - 1]
        assert.ok(Math.abs(points[0] - first.x) <= 1 && Math.abs(points[1] - (first.y - 6)) <= 1, 'rail starts a cap above the first mounted anchor')
        assert.ok(Math.abs(points[points.length - 2] - last.x) <= 1 && Math.abs(points[points.length - 1] - (last.y + 6)) <= 1, 'rail ends a cap below the last mounted anchor')
        const columns = new Set(geometry.anchors.map((anchor) => Math.round(anchor.x)))
        let horizontals = 0
        for (let i = 2; i < points.length; i += 2) {
          const [x0, y0, x1, y1] = [points[i - 2], points[i - 1], points[i], points[i + 1]]
          assert.ok(y0 === y1 || x0 === x1, 'every segment is an axis-aligned connector run')
          if (y0 === y1 && x0 !== x1) horizontals++
          assert.ok([...columns].some((column) => Math.abs(x0 - column) <= 1), 'every x falls in an anchor column')
        }
        const columnChanges = geometry.anchors.slice(1).filter((anchor, index) =>
          Math.abs(anchor.x - geometry.anchors[index].x) > 1).length
        assert.equal(horizontals, columnChanges, 'exactly one square step per column change')
      }
      const renderedText = await page.$eval('.helper-demo', (el) => el.textContent)
      for (const text of fixture.expectedText) assert.ok(renderedText.includes(text), `${fixture.name}: ${text}`)
      // Singular at one, never "1 helper threads" / "1 input submissions" / "1 turns".
      assert.equal((await page.$$eval('.helper-group-count', (els) => els.map((el) => el.textContent).join(' '))).includes('1 helper threads'), false)
      assert.equal(await page.$$eval('.helper-thread-facts', (els) => /\b1 (?:input submission|turn)s\b/.test(els.map((el) => el.textContent).join(' '))), false)
      if (fixture.select) {
        const groupIndex = fixture.groups.findIndex((group) => group.members.includes(fixture.select))
        const member = `.helper-group-members [data-thread-id="${fixture.select}"]`
        await page.focus(`${member} input`)
        await page.keyboard.press('Space')
        assert.ok(await page.$eval('.helper-demo', (el, wanted) => el.textContent.includes(`selected transcripts: ${wanted}`), fixture.select))
        // A selection inside the fold is stated on the CLOSED control, never silent.
        await triggers[groupIndex].click()
        assert.equal(await triggers[groupIndex].evaluate((el) => el.getAttribute('aria-expanded')), 'false', 'selection collapse')
        assert.equal(await page.$eval('.helper-group-count', (el) => el.textContent), fixture.expectedSelectedLabel, 'closed control states the hidden selection')
        assert.equal(await page.$('.helper-group-members'), null, 'collapsed members are gone')
        await waitForAnchors(fixture.expectedAnchorCounts.expanded - fixture.groups[groupIndex].members.length)
        await triggers[groupIndex].click()
        await waitForAnchors(fixture.expectedAnchorCounts.expanded)
        assert.ok(await page.$eval(`${member} input`, (el) => el.checked), 'reopening retains the selection')
        await page.focus(`${member} a`)
        await page.keyboard.press('Enter')
        assert.equal(await page.$eval('.helper-demo > div:not([hidden]) [data-thread-id]', (el) => el.dataset.threadId), fixture.select, 'actual individual open callback')
        await page.click('.helper-demo > div:not([hidden]) > button')
        assert.equal(await page.$eval('.helper-group-trigger', (el) => el.getAttribute('aria-expanded')), 'true', 'return retains disclosure')
        assert.ok(await page.$eval('.helper-demo', (el, wanted) => el.textContent.includes(`selected transcripts: ${wanted}`), fixture.select), 'return retains selection')
      }
      if (fixture.owner && fixture.selectionScript) {
        // The owner is a two-state cycle in the real browser too. The user's
        // sequence: pick a helper, check the owner (all), uncheck the owner, and
        // the manual helper pick is RESTORED rather than cleared. A manual edit
        // while the whole tree is in the all selection writes all-but-that-member,
        // and the owner untick after that restores all-but-that-member.
        const ownerInput = '.helper-tree-rows > .helper-tree-row input[type="checkbox"]'
        const memberInputs = '.helper-group-members input[type="checkbox"]'
        const memberSelector = (id) => `.helper-group-members [data-thread-id="${id}"] input`
        const summary = () => page.$eval('.helper-demo-summary', (el) => el.textContent)
        const helper = fixture.groups[0].members[0]
        // Start from nothing selected: clear the pick the individual-selection
        // step left, so this is the exact sequence from an empty tree.
        if (fixture.select && await page.$eval(memberSelector(fixture.select), (el) => el.checked)) {
          await page.click(memberSelector(fixture.select))
          await page.waitForFunction((selector) => document.querySelector(selector)?.checked === false, { timeout: 10000 }, memberSelector(fixture.select))
        }
        await page.click(memberSelector(helper))
        assert.equal(await page.$eval(memberSelector(helper), (el) => el.checked), true, 'a member pick selects only that member')
        assert.ok((await summary()).includes(`selected transcripts: ${helper}`), 'the manual pick is the whole selection')
        assert.ok(await page.$eval(ownerInput, (el) => el.indeterminate), 'the owner rolls the manual pick up to mixed')
        assert.equal(await page.$eval(ownerInput, (el) => el.getAttribute('aria-checked')), 'mixed',
          'the mixed owner state is exposed to assistive technology')
        await page.screenshot({ path: resolve(output, `${theme}-${fixture.name}-cascade-mixed.png`) })
        await page.click(ownerInput)
        await page.waitForFunction((selector) => document.querySelector(selector)?.checked === true, { timeout: 10000 }, ownerInput)
        const memberToggles = await page.$$eval(memberInputs, (inputs) => inputs.map((input) => input.checked))
        assert.ok(memberToggles.length > 0 && memberToggles.every(Boolean), 'owner tick selects every mounted member')
        const selectedText = await summary()
        for (const id of [fixture.owner, ...fixture.groups.flatMap((group) => group.members)]) {
          assert.ok(selectedText.includes(id), `owner tick states ${id} in the selection`)
        }
        await page.screenshot({ path: resolve(output, `${theme}-${fixture.name}-cascade-selected.png`) })
        // The owner untick restores the manual pick: the helper stays selected and
        // no other member is widened in.
        await page.click(ownerInput)
        await page.waitForFunction((selector) => {
          const owner = document.querySelector(selector)
          return owner?.checked === false && owner?.indeterminate === true
        }, { timeout: 10000 }, ownerInput)
        assert.equal(await page.$eval(memberSelector(helper), (el) => el.checked), true, 'the owner untick restores the manual helper pick')
        for (const id of fixture.groups.flatMap((group) => group.members).filter((id) => id !== helper)) {
          assert.equal(await page.$eval(memberSelector(id), (el) => el.checked), false, `the other member ${id} stays unselected`)
        }
        assert.ok((await summary()).includes(`selected transcripts: ${helper}`), 'the restored selection is the manual pick')
        // A manual edit while the whole tree is in the all selection writes
        // all-but-that-member; the owner untick after that restores that manual side.
        await page.click(ownerInput)
        await page.waitForFunction((selector) => document.querySelector(selector)?.checked === true, { timeout: 10000 }, ownerInput)
        const otherMember = fixture.groups[0].members[1] || fixture.groups[0].members[0]
        await page.click(memberSelector(otherMember))
        await page.waitForFunction((selector) => document.querySelector(selector)?.checked === false, { timeout: 10000 }, memberSelector(otherMember))
        assert.ok(await page.$eval(ownerInput, (el) => el.indeterminate), 'a manual member untick under all rolls the owner up to mixed')
        await page.click(ownerInput)
        await page.waitForFunction((selector) => document.querySelector(selector)?.checked === true, { timeout: 10000 }, ownerInput)
        await page.click(ownerInput)
        await page.waitForFunction((selector) => {
          const owner = document.querySelector(selector)
          return owner?.checked === false && owner?.indeterminate === true
        }, { timeout: 10000 }, ownerInput)
        assert.equal(await page.$eval(memberSelector(otherMember), (el) => el.checked), false,
          'the owner untick restores the manual all-except-that-member selection')
        for (const id of fixture.groups.flatMap((group) => group.members).filter((id) => id !== otherMember)) {
          assert.equal(await page.$eval(memberSelector(id), (el) => el.checked), true, `the owner untick restores ${id}`)
        }
      }
      if (fixture.scopeExpired) {
        assert.ok(await page.$('.helper-group-members') === null, 'expired scope hides stale member actions')
        assert.equal(await page.$$eval('.helper-tree-rail', (els) => els.reduce((total, el) => total + Number(el.dataset.anchorCount), 0)), 0, 'expired scope has nothing to trace')
        await page.screenshot({ path: resolve(output, `${theme}-${fixture.name}.png`) })
        await page.click('.helper-group-action')
        assert.equal(await page.$eval('.helper-group-trigger', (el) => el.getAttribute('aria-expanded')), 'false', 'refreshed scope resets disclosure')
        assert.equal(await page.$eval('.helper-group-count', (el) => el.textContent), fixture.expectedLabels[0], 'refreshed control states the restored count')
        await page.click('.helper-group-trigger')
        assert.deepEqual(await page.$$eval('.helper-group-members [data-thread-id]', (rows) => rows.map((el) => el.dataset.threadId)), ['G2'], 'refresh retains exact helper-only scope')
        await waitForAnchors(1)
        assert.equal(await page.$$eval('.helper-tree-rail', (els) => els.reduce((total, el) => total + Number(el.dataset.anchorCount), 0)), 1, 'refreshed member is traced')
      }
      const styles = await page.evaluate(() => {
        const read = (selector) => {
          const el = document.querySelector(selector)
          if (!el) return null
          const s = getComputedStyle(el)
          return { font: s.fontFamily, size: s.fontSize, radius: s.borderRadius, transform: s.textTransform,
            numeric: s.fontVariantNumeric, color: s.color, background: s.backgroundColor,
            minHeight: s.minHeight, paddingLeft: s.paddingLeft, position: s.position,
            pointerEvents: s.pointerEvents, zIndex: s.zIndex, stroke: s.stroke, strokeWidth: s.strokeWidth, fill: s.fill,
            borderLeftWidth: s.borderLeftWidth, borderTopWidth: s.borderTopWidth, whiteSpace: s.whiteSpace,
            overflow: s.overflow, textOverflow: s.textOverflow,
            animation: s.animationDuration, animationName: s.animationName, transition: s.transitionDuration }
        }
        const rect = (selector) => {
          const el = document.querySelector(selector)
          return el ? el.getBoundingClientRect().left : null
        }
        // The separators are drawn by ::before so their left edge can stop at the
        // row's content column: measure the pseudo's border and its offset, plus
        // where the checkbox ends and the title starts, to prove the rule never
        // reaches the connector gutter.
        const ruleInfo = (host, row) => {
          const pseudo = getComputedStyle(host, '::before')
          const info = { borderTopWidth: pseudo.borderTopWidth, left: parseFloat(pseudo.left),
            boxRight: null, titleOffset: null }
          if (row) {
            const rowLeft = row.getBoundingClientRect().left
            const box = row.querySelector('input[type="checkbox"]')
            const title = row.querySelector('.helper-thread-open, .helper-thread-title')
            if (box) info.boxRight = box.getBoundingClientRect().right - rowLeft
            if (title) info.titleOffset = title.getBoundingClientRect().left - rowLeft
          }
          return info
        }
        const memberSeparators = [...document.querySelectorAll('.helper-group-members')].flatMap((list) =>
          [...list.children].slice(1).map((li) => ruleInfo(li, li.querySelector('.helper-thread-row'))))
        // The tree paints no background of its own so the connector shows
        // through the indent gutter; contrast is measured against the first
        // painted ancestor instead.
        const group = read('.helper-group')
        for (let el = document.querySelector('.helper-group'); el; el = el.parentElement) {
          const background = getComputedStyle(el).backgroundColor
          if (background && background !== 'transparent' && !/^rgba?\(0, 0, 0, 0\)$/.test(background)) {
            group.background = background
            break
          }
        }
        return { trigger: read('.helper-group-trigger'), group,
          count: read('.helper-group-count'), show: read('.helper-group-show'),
          body: read('.helper-group-body'), title: read('.helper-thread-open'), facts: read('.helper-thread-facts'),
          members: read('.helper-group-members'), memberSeparators,
          bodyRule: (() => {
            const body = document.querySelector('.helper-group-body')
            return body ? ruleInfo(body, document.querySelector('.helper-group-members .helper-thread-row')) : null
          })(),
          rail: read('.helper-tree-rail'), rows: read('.helper-tree-rows'), children: read('.helper-tree-children'),
          rule: getComputedStyle(document.querySelector('.helper-group-item')).borderBottomColor,
          indent: { tree: rect('.helper-tree'), owner: rect('.helper-tree-rows > .helper-tree-row'), control: rect('.helper-group-trigger'),
            member: rect('.helper-group-members .helper-thread-row'),
            ownerInput: rect('.helper-tree-rows > .helper-tree-row input'), memberInput: rect('.helper-group-members .helper-thread-row input') },
          fonts: document.fonts.check('16px "Atkinson Hyperlegible"') && document.fonts.check('14px "Atkinson Hyperlegible Mono"'),
          overflow: document.documentElement.scrollWidth > window.innerWidth }
      })
      assert.ok(styles.trigger.font.includes('Atkinson Hyperlegible Mono'))
      assert.equal(styles.trigger.size, '14px')
      assert.equal(styles.trigger.radius, '0px')
      assert.equal(styles.trigger.minHeight, '44px', 'control keeps a comfortable target')
      assert.equal(styles.trigger.paddingLeft, '16px', 'control aligns with its revealed rows')
      assert.equal(styles.trigger.transform, 'lowercase', 'control chrome stays lowercase')
      assert.equal(styles.trigger.animationName, 'none', 'no animation is attached to helper controls')
      assert.ok(styles.count.numeric.includes('tabular-nums'), 'count is tabular')
      assert.ok(ratio(styles.trigger.color, styles.group.background) >= 4.5, 'actual chrome contrast AA')
      if (styles.show) assert.ok(ratio(styles.show.color, styles.group.background) >= 4.5, 'show/hide contrast AA')
      if (styles.title) {
        assert.ok(styles.title.font.includes('Atkinson Hyperlegible'))
        assert.equal(styles.title.size, '14px')
        assert.equal(styles.title.transform, 'none')
        assert.equal(styles.title.whiteSpace, 'nowrap', 'the title truncates rather than wraps')
        assert.equal(styles.title.textOverflow, 'ellipsis')
        assert.ok(styles.facts.numeric.includes('tabular-nums'))
        assert.ok(ratio(styles.facts.color, styles.group.background) >= 4.5, 'actual secondary contrast AA')
        assert.equal(styles.members.borderLeftWidth, '0px', 'revealed members carry no inset rule')
        assert.equal(styles.bodyRule?.borderTopWidth, '1px', 'the control separates from its rows by a top rule')
        assert.ok(styles.memberSeparators.every((rule) => rule.borderTopWidth === '1px'), 'revealed rows separate from each other')
        // A rule that reached the connector gutter would paint across the rail.
        for (const rule of [styles.bodyRule, ...styles.memberSeparators]) {
          if (!rule || rule.boxRight === null) continue
          assert.ok(rule.left >= rule.boxRight - 0.5, 'the horizontal rule starts after the row checkbox, clear of the connector gutter')
          if (rule.titleOffset !== null) assert.ok(Math.abs(rule.left - rule.titleOffset) < 0.5, 'the horizontal rule starts at the row content column')
        }
      }
      // ONE rail: absolutely positioned behind the rows, pointer-inert, painted
      // in the same rule colour as the row borders, never a hardcoded ink.
      assert.ok(styles.rail, 'the tree mounts the connector overlay')
      assert.equal(styles.rail.position, 'absolute')
      assert.equal(styles.rail.pointerEvents, 'none', 'the connector never intercepts a click')
      assert.equal(styles.rail.zIndex, '0', 'the connector paints behind the rows')
      assert.equal(styles.rows.zIndex, '1', 'the rows sit above the connector')
      assert.equal(styles.children.paddingLeft, '40px', 'one indent step per nested list')
      // One step: the chip and the member rows sit one --sp-7 in from the owner.
      assert.ok(Math.abs(styles.indent.control - styles.indent.owner - 40) < 0.5, 'chip is indented one step under its owner row')
      assert.ok(Math.abs(styles.indent.member - styles.indent.owner - 40) < 0.5, 'member rows sit one step in from the owner row')
      if (geometry.anchors.length > 0) {
        assert.equal(geometry.stroke, styles.rule, 'the connector uses the rule colour token')
      }
      if (styles.indent.ownerInput !== null) {
        assert.ok(Math.abs(styles.indent.memberInput - styles.indent.ownerInput - 40) < 0.5,
          'member checkbox column is exactly one indent step from the owner checkbox, which shares the same row pad')
      }
      assert.ok(styles.fonts, 'Atkinson fonts loaded')
      assert.equal(styles.overflow, false)
      evidence.probes.push({ theme, case: fixture.name, styles, anchors: geometry.anchors.length, path: geometry.d })
      if (!fixture.scopeExpired) await page.screenshot({ path: resolve(output, `${theme}-${fixture.name}.png`) })
    }
    assert.deepEqual(errors, [], 'mounted demo runtime errors')
    await page.close()
  }
  writeFileSync(resolve(output, 'provenance.json'), JSON.stringify(evidence, null, 2))
  console.log(`PASS built helper tree connector/callbacks/styles in both themes: ${output}`)
} finally { await browser.close(); await new Promise((done) => served.httpServer.close(done)) }
