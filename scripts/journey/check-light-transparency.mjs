import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function assertLightTransparency(report) {
  const matches = []
  function visit(suite) {
    for (const spec of suite.specs || []) {
      if (spec.file === 'app-validate.journey.mjs' && spec.title === 'honors reduced transparency') {
        matches.push(...(spec.tests || []).filter((entry) => entry.projectName === 'light'))
      }
    }
    for (const child of suite.suites || []) visit(child)
  }
  for (const suite of report.suites || []) visit(suite)
  if (matches.length !== 1) throw new Error('light transparency: expected exactly one light project test in the report')
  const result = matches[0].results?.at(-1)
  if (matches[0].expectedStatus !== 'passed' || result?.status !== 'passed') throw new Error('light transparency: test did not execute and pass')
  const prefix = 'reduced transparency [light]: '
  const log = result.stdout?.find((entry) => entry.text?.startsWith(prefix))?.text
  if (!log || JSON.parse(log.slice(prefix.length)).theme !== 'light') throw new Error('light transparency: test did not report a mounted light theme')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assertLightTransparency(JSON.parse(readFileSync('scripts/journey/.artifacts/report.json', 'utf8')))
    console.log('light transparency: mounted light check executed and passed')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
