import { test, expect, storyUrl } from './lib/fixtures.mjs'
import { loadDataTableFixtures } from '../datatable-fixtures.mjs'
import { assertWebServerServing } from './server-liveness.mjs'

const spec = loadDataTableFixtures()
const productUrl = (query, theme) => `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}/?fb=off&${query}&theme=${theme}#inuse`

for (const row of spec.consumerRows) {
  test(row.name, async ({ page, theme }) => {
    for (const width of spec.consumerWidths) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(productUrl(row.query, theme), { waitUntil: 'networkidle' })
      expect(await page.locator('html').getAttribute('data-theme') || 'dark').toBe(theme)
      const view = page.locator('.iu-app-root')
      await expect(view.locator('.iu-page-count')).toHaveText(row.count)
      await expect(view.locator('.tbl tbody .tbl-row')).toHaveCount(row.expectedRows)
      await expect(view.locator('.tbl-tools,.tbl-chips,.tbl-footer')).toHaveCount(0)
      await expect(view.getByRole('searchbox', { name: 'search rows', exact: true })).toHaveCount(0)
      await view.locator('.iu-page-count').scrollIntoViewIfNeeded()
    }
  })
}

for (const row of spec.analyticsRows) {
  test(row.name, async ({ page, theme }) => {
    await page.setViewportSize({ width: row.width, height: 900 })
    await page.goto(productUrl('app=graph&section=analytics', theme), { waitUntil: 'networkidle' })
    expect(await page.locator('html').getAttribute('data-theme') || 'dark').toBe(theme)
    const wrapper = page.locator('.gan-tablecard .tbl-wrap')
    await expect(wrapper).toBeVisible()
    await wrapper.scrollIntoViewIfNeeded()
    expect(await wrapper.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto')
    const position = await wrapper.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
      const last = el.querySelector('tbody tr td:last-child').getBoundingClientRect()
      const bounds = el.getBoundingClientRect()
      return { reachable: last.left >= bounds.left - 1 && last.right <= bounds.right + 1,
        moved: el.scrollLeft > 0, overflow: el.scrollWidth > el.clientWidth }
    })
    expect(position.reachable).toBe(true)
    if (position.overflow) expect(position.moved).toBe(true)
    await page.locator('.gan-tablecard .tbl-sort').first().click()
    await expect(page.locator('.gan-tablecard th').first()).toHaveAttribute('aria-sort', 'ascending')
  })
}

// Read the actual rendered separators and cell typography, not an alignment prop.
const decimalProblems = () => {
  const points = [...document.querySelectorAll('.tbl-decimal-point')]
  const problems = points.length < 2 ? ['mixed precision rows missing'] : []
  if (points.some((p) => !p.getClientRects().length || p.getBoundingClientRect().width <= 0 || getComputedStyle(p).visibility !== 'visible')) problems.push('decimal separators unpainted')
  const xs = points.map((p) => p.getBoundingClientRect().left)
  if (Math.max(...xs) - Math.min(...xs) > 0.5) problems.push('decimal separators differ')
  if (points.some((p) => !getComputedStyle(p.closest('.tnum')).fontVariantNumeric.includes('tabular-nums'))) problems.push('tabular figures missing')
  return problems
}

for (const row of spec.mountedRows) {
  test(row.name, async ({ page, theme }) => {
    // This file mixes app-preview and Storybook rows, so the liveness check
    // stays per row: an app-server death must not stop a Storybook row, and a
    // Storybook death must report the missing server instead of a connection
    // error against the story id.
    await assertWebServerServing()
    await page.goto(storyUrl(`components-datatable--${row.story}`, theme))
    await expect(page.locator('.tbl')).toBeVisible()
    await expect.poll(() => page.locator('.tbl').evaluate((el) => el.closest('[data-theme]')?.getAttribute('data-theme') || 'dark')).toBe(theme)
    await page.evaluate(() => document.fonts.ready)
    if (row.kind === 'toolbar') {
      for (const width of spec.consumerWidths) {
        await page.setViewportSize({ width, height: 900 })
        // A viewport command can resolve before the resize has rendered. Let the
        // new frame paint, then read all related boxes in the same layout snapshot.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const search = page.getByRole('searchbox', { name: 'search rows', exact: true })
        const label = page.locator('.tbl-tools > label')
        await expect(search).toHaveAccessibleName('search rows')
        await expect(label).toBeVisible()
        const cue = await label.evaluate((element) => {
          const css = getComputedStyle(element), bounds = element.getBoundingClientRect()
          return { clip: css.clipPath, width: bounds.width, height: bounds.height, font: parseFloat(css.fontSize), family: css.fontFamily }
        })
        expect(cue.clip).toBe('none')
        expect(cue.width).toBeGreaterThan(1)
        expect(cue.height).toBeGreaterThan(1)
        expect(cue.font).toBeGreaterThanOrEqual(14)
        expect(cue.family).toContain('Atkinson Hyperlegible Mono')
        if (width <= 720) {
          const { labelBounds, inputBounds, filterBounds } = await page.locator('.tbl-tools').evaluate(element => ({
            labelBounds: element.querySelector('label').getBoundingClientRect().toJSON(),
            inputBounds: element.querySelector('input').getBoundingClientRect().toJSON(),
            filterBounds: element.querySelector('.tbl-filters summary').getBoundingClientRect().toJSON(),
          }))
          expect(labelBounds.y + labelBounds.height).toBeLessThanOrEqual(inputBounds.y)
          expect(inputBounds.y).toBe(filterBounds.y)
          expect(labelBounds.x).toBeGreaterThanOrEqual(0)
          expect(labelBounds.x + labelBounds.width).toBeLessThanOrEqual(width)
          expect(inputBounds.x).toBeGreaterThanOrEqual(0)
          expect(inputBounds.right).toBeLessThanOrEqual(width)
          expect(filterBounds.x).toBeGreaterThanOrEqual(0)
          expect(filterBounds.right).toBeLessThanOrEqual(width)
        }
        await search.fill('Ledger')
        await expect(page.locator('.tbl-footer [role=status]')).toHaveText('showing 2 of 2')
        await page.getByRole('button', { name: 'remove search filter' }).click()
        await expect(page.locator('.tbl-footer [role=status]')).toHaveText('showing 2 of 5')
      }
    } else if (row.kind === 'legacy' || row.kind === 'bounded') {
      const legacy = spec.cases.find((entry) => entry.controls === false)
      await expect(page.locator('tbody .tbl-row')).toHaveCount(legacy.rows.length)
      await expect(page.locator('.tbl-tools,.tbl-chips,.tbl-footer')).toHaveCount(0)
      await page.setViewportSize({ width: 390, height: 844 })
      const scroll = page.locator('.tbl-scroll')
      const bounds = await scroll.evaluate((element) => ({
        height: element.clientHeight,
        contentHeight: element.scrollHeight,
        maxHeight: getComputedStyle(element).maxHeight,
        lastRowBottom: element.querySelector('tbody tr:last-child').getBoundingClientRect().bottom,
        viewportBottom: element.getBoundingClientRect().bottom,
      }))
      if (row.kind === 'legacy') {
        expect(bounds.maxHeight).toBe('none')
        expect(bounds.contentHeight).toBeLessThanOrEqual(bounds.height + 1)
        expect(bounds.lastRowBottom).toBeLessThanOrEqual(bounds.viewportBottom + 1)
      } else {
        expect(bounds.contentHeight).toBeGreaterThan(bounds.height)
        await scroll.focus()
        await expect(scroll).toBeFocused()
        await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight })
        await expect(scroll.locator('tbody tr:last-child')).toBeInViewport()
      }
    } else if (row.kind === 'decimal') {
      await page.getByRole('button', { name: 'remove title filter' }).click()
      expect(await page.evaluate(decimalProblems)).toEqual([])
      for (const mutation of spec.mutations) {
        const style = await page.addStyleTag({ content: mutation.css })
        const problems = await page.evaluate(decimalProblems)
        expect(problems, mutation.name).toContain(mutation.diagnostic)
        await style.evaluate((el) => el.remove())
      }
    } else if (row.kind === 'fallback') {
      await page.getByRole('button', { name: 'remove title filter' }).click()
      const cell = page.locator('td').filter({ hasText: '€9,00' })
      await expect(cell).toHaveCount(1)
      expect(await cell.evaluate((el) => getComputedStyle(el).textAlign)).toBe('right')
      expect(await cell.locator('.tnum').evaluate((el) => getComputedStyle(el).fontVariantNumeric)).toContain('tabular-nums')
      await expect(cell.locator('.tbl-decimal')).toHaveCount(0)
    } else if (row.kind === 'chips') {
      await expect(page.locator('.tbl-chip')).toHaveCount(1)
      await expect(page.locator('.tbl-filter-active')).toHaveText('filters active')
      await page.getByRole('button', { name: 'remove title filter' }).click()
      await expect(page.locator('.tbl-callback-filters')).toHaveText('[]')
      await expect(page.locator('.tbl-chip')).toHaveCount(0)
      await expect(page.locator('.tbl-filter-active')).toHaveCount(0)
      await expect(page.locator('.tbl-footer [role=status]')).toHaveText('showing 5 of 5')
    } else if (row.kind === 'defaults') {
      const styles = await page.evaluate(() => {
        const th = document.querySelector('.tbl-th')
        const cell = document.querySelector('.tbl-td')
        const css = getComputedStyle(cell)
        const identifier = cell.getBoundingClientRect()
        const selection = document.querySelector('tbody .tbl-sel').getBoundingClientRect()
        return { header: getComputedStyle(th).position, frozen: css.position, height: cell.parentElement.getBoundingClientRect().height,
          standard: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-h-standard')), font: parseFloat(css.fontSize), overlap: selection.right > identifier.left + 0.5 }
      })
      expect(styles.header).toBe('sticky')
      expect(styles.frozen).toBe('sticky')
      expect(styles.height).toBe(styles.standard)
      expect(styles.font).toBeGreaterThanOrEqual(16)
      expect(styles.overlap).toBe(false)
    } else if (row.kind === 'uncontrolled') {
      await expect(page.locator('.tbl-footer [role=status]')).toHaveText('showing 2 of 5')
      await page.getByRole('searchbox', { name: 'search rows' }).fill('Ledger')
      await expect(page.locator('.tbl-footer [role=status]')).toHaveText('showing 2 of 2')
      await expect(page.locator('.tbl-footer')).toContainText('page 1 of 1')
      await page.getByRole('button', { name: 'remove search filter' }).click()
      await page.locator('.tbl-filters summary').click()
      await page.getByRole('textbox', { name: 'filter record', exact: true }).fill('Archive')
      await expect(page.locator('.tbl-footer [role=status]')).toHaveText('showing 2 of 2')
      await expect(page.locator('tbody .tbl-row')).toHaveCount(2)
      await expect(page.locator('.tbl tbody')).toContainText('Archive C')
      await page.getByRole('button', { name: 'remove title filter' }).click()
      await expect(page.locator('.tbl-footer [role=status]')).toHaveText('showing 2 of 5')
    } else if (row.kind === 'host') {
      await expect(page.locator('.tbl-footer [role=status]')).toHaveText('showing 2 of 5')
      await page.getByRole('button', { name: 'next page' }).click()
      await expect(page.locator('.tbl-callback-pagination')).toHaveText('{"pageIndex":1,"pageSize":2}')
      await expect(page.locator('.tbl tbody')).toContainText('Archive C')
      await page.getByRole('searchbox', { name: 'search rows' }).fill('Ledger')
      await expect(page.locator('.tbl-callback-search')).toHaveText('"Ledger"')
      await expect(page.locator('.tbl-callback-pagination')).toHaveText('{"pageIndex":0,"pageSize":2}')
      await expect(page.locator('.tbl-footer [role=status]')).toHaveText('showing 2 of 2')
    } else throw new Error(`datatable.yaml: unimplemented mounted kind ${row.kind}; add its real interaction before enabling the row`)
  })
}

test('data table defaults are usable on the built product', async ({ page, theme }) => {
  const url = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}/?fb=off${theme === 'light' ? '&theme=light' : ''}#data-table`
  await page.goto(url, { waitUntil: 'networkidle' })
  expect(await page.locator('html').getAttribute('data-theme') || 'dark').toBe(theme)
  const section = page.locator('#data-table')
  await expect(section.locator('.tbl')).toBeVisible()
  await section.getByRole('searchbox', { name: 'search rows' }).fill('redaction')
  await expect(section.getByRole('status')).toHaveText('showing 1 of 1')
  await section.getByRole('button', { name: 'remove search filter' }).click()
  await expect(section.getByRole('status')).toHaveText('showing 4 of 4')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const scroll = section.locator('.tbl-scroll')
  await scroll.focus()
  await expect(scroll).toBeFocused()
})
