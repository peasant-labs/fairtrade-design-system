// @ts-check

// App-owned contact-sheet renderer.
//
// Takes a sheet plan composed from certified capture records, embeds each shot
// cell's bytes as a data URI, renders the plan's escaped HTML document string
// in a headless page, and screenshots the table to a sheet PNG. The sheet
// document construction and escaping live in the browser-free child; this
// module owns the page rendering and the sheet bytes.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { importFairtestSource } from '../fairtest-source.mjs'
import { captureRelativePath } from './capture-paths.mjs'

const captureSheet = await importFairtestSource('src/capture/sheet.mjs')

/**
 * @typedef {object} CaptureSheetCellLike
 * @property {string} status cell status
 * @property {string | null} file shot file, or null
 * @property {string} kind target kind
 */

/**
 * @typedef {object} CaptureSheetRowLike
 * @property {CaptureSheetCellLike[]} cells one cell per column
 */

/**
 * @typedef {object} CaptureSheetLike
 * @property {string} id sheet id
 * @property {string} surface surface id
 * @property {string} file sheet png path
 * @property {CaptureSheetRowLike[]} rows sheet rows
 */

/**
 * @typedef {object} CaptureSheetPlanLike
 * @property {CaptureSheetLike[]} sheets planned sheets
 */

/**
 * @typedef {object} RenderSheetsOptions
 * @property {CaptureSheetPlanLike} plan sheet plan from the child
 * @property {string} root capture root the shot references resolve under and the sheets are written to
 */

/**
 * SHA-256 hex digest of bytes.
 * @param {Buffer | string} data bytes to hash
 * @returns {string}
 */
function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Render every planned sheet and return the manifest entries.
 * @param {RenderSheetsOptions} options render options
 * @returns {Promise<{ id: string, surface: string, file: string, sha256: string }[]>}
 */
export async function renderSheets({ plan, root }) {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: true })
  /** @type {{ id: string, surface: string, file: string, sha256: string }[]} */
  const made = []
  try {
    for (const sheet of plan.sheets) {
      /** @type {Record<string, string>} */
      const images = {}
      for (const row of sheet.rows) {
        for (const cell of row.cells) {
          if (cell.status !== 'shot') continue
          const file = cell.file
          if (file === null) {
            throw new Error(`capture sheets: shot cell in ${JSON.stringify(sheet.id)} carries no file at path sheet.rows; repair: re-capture the row so every shot cell names its file.`)
          }
          const absolute = captureRelativePath(root, file, 'sheetCell.file')
          if (!existsSync(absolute)) {
            throw new Error(
              `capture sheets: shot ${JSON.stringify(file)} is missing for field "file" at path ${absolute}; ` +
              'repair: render the sheets from a completed capture root so every shot cell resolves to a file.',
            )
          }
          images[file] = `data:image/png;base64,${readFileSync(absolute).toString('base64')}`
        }
      }
      const html = captureSheet.renderSheetDocument(plan, sheet.id, images, `${sheet.surface}: each before paired beside its after`)
      const absolute = captureRelativePath(root, sheet.file, 'sheetFile')
      mkdirSync(dirname(absolute), { recursive: true })
      const page = await browser.newPage({ viewport: { width: 2200, height: 400 } })
      try {
        await page.setContent(html)
        await page.locator('table').screenshot({ path: absolute })
      } finally {
        await page.close()
      }
      made.push({ id: sheet.id, surface: sheet.surface, file: sheet.file, sha256: sha256(readFileSync(absolute)) })
    }
  } finally {
    await browser.close()
  }
  return made
}
