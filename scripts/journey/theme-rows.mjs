// The project predicate is shared by runtime skips and the browser-free guard.
export const PROJECT_THEMES = Object.freeze(['dark', 'light'])

export function rowRunsInProject(row, project) {
  return row.theme === project
}

export function assertThemeRows(rows, projects = PROJECT_THEMES, matches = rowRunsInProject) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('theme rows: fixture must contain rows')
  for (const row of rows) {
    if (!projects.includes(row.theme)) throw new Error(`theme rows: unknown theme ${JSON.stringify(row.theme)} for ${row.name}`)
    const count = projects.filter((project) => matches(row, project)).length
    if (count !== 1) throw new Error(`theme rows: ${row.name} executes ${count} times; expected exactly once`)
  }
}
