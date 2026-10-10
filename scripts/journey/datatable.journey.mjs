import { test, expect, storyUrl } from './lib/fixtures.mjs'
import { loadDataTableFixtures } from '../datatable-fixtures.mjs'

const spec = loadDataTableFixtures()

// Read the actual rendered separators and cell typography, not an alignment prop.
const decimalProblems = () => {
  const points = [...document.querySelectorAll('.tbl-decimal-point')]
  const problems = points.length < 2 ? ['mixed precision rows missing'] : []
  const xs = points.map((p) => p.getBoundingClientRect().left)
  if (Math.max(...xs) - Math.min(...xs) > 0.5) problems.push('decimal separators differ')
  if (points.some((p) => !getComputedStyle(p.closest('.tnum')).fontVariantNumeric.includes('tabular-nums'))) problems.push('tabular figures missing')
  return problems
}

for (const row of spec.mountedRows) {
  test(row.name, async ({ page, theme }) => {
    await page.goto(storyUrl(`components-datatable--${row.story}`, theme))
    await expect(page.locator('.tbl')).toBeVisible()
    expect(await page.locator('html').getAttribute('data-theme') || 'dark').toBe(theme)
    await page.evaluate(() => document.fonts.ready)
    if (row.kind === 'decimal') {
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
      await expect(page.getByRole('status')).toHaveText('showing 5 of 5')
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
      await expect(page.getByRole('status')).toHaveText('showing 2 of 5')
      await page.getByRole('searchbox', { name: 'search rows' }).fill('Ledger')
      await expect(page.getByRole('status')).toHaveText('showing 2 of 2')
      await expect(page.locator('.tbl-footer')).toContainText('page 1 of 1')
      await page.getByRole('button', { name: 'remove search filter' }).click()
      await page.locator('.tbl-filters summary').click()
      await page.getByRole('textbox', { name: 'filter record', exact: true }).fill('Archive')
      await expect(page.getByRole('status')).toHaveText('showing 2 of 2')
      await expect(page.locator('tbody .tbl-row')).toHaveCount(2)
      await expect(page.locator('tbody')).toContainText('Archive C')
      await page.getByRole('button', { name: 'remove title filter' }).click()
      await expect(page.getByRole('status')).toHaveText('showing 2 of 5')
    } else if (row.kind === 'host') {
      await expect(page.getByRole('status')).toHaveText('showing 2 of 5')
      await page.getByRole('button', { name: 'next page' }).click()
      await expect(page.locator('.tbl-callback-pagination')).toHaveText('{"pageIndex":1,"pageSize":2}')
      await expect(page.locator('tbody')).toContainText('Archive C')
      await page.getByRole('searchbox', { name: 'search rows' }).fill('Ledger')
      await expect(page.locator('.tbl-callback-search')).toHaveText('"Ledger"')
      await expect(page.locator('.tbl-callback-pagination')).toHaveText('{"pageIndex":0,"pageSize":2}')
      await expect(page.getByRole('status')).toHaveText('showing 2 of 2')
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
