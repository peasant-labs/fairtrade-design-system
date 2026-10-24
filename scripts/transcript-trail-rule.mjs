// The transcript trail's rule, measured in a mounted page and checked by both journeys that show a
// trail: scripts/journey/transcript-trail.journey.mjs on the built Storybook and
// scripts/journey/phone-header.journey.mjs on the built in-use demo.
//
// At every width the trail is one line and every crumb reads whole while it fits. When the row is full
// the last crumb, the current page, gives way first, down to its floor; then the others. A cut crumb
// ends in an ellipsis, no crumb goes below its floor or runs past the trail's edge, and no crumb is cut
// while the row has room. The floors mirror the trail rule in src/index.css, in ch of the crumb's own
// font.

export const TRAIL_FLOORS_CH = Object.freeze({ current: 8, other: 3 })

/**
 * In the page (pass to page.evaluate with the trail's selector): whether the trail is one line, its
 * edge and spare room, and each crumb's text, box and text widths, its ch, and whether it is cut and
 * set to end in an ellipsis.
 */
export const measureTrail = (selector) => {
  const trail = document.querySelector(selector)
  const style = getComputedStyle(trail)
  const box = trail.getBoundingClientRect()
  const parts = [...trail.children]
  const crumbs = parts.filter((part) => part.tagName.toLowerCase() !== 'svg').map((el) => {
    const probe = document.createElement('span')
    probe.style.cssText = 'position: absolute; visibility: hidden; width: 10ch'
    el.append(probe)
    const ch = probe.getBoundingClientRect().width / 10
    probe.remove()
    const text = document.createRange()
    text.selectNodeContents(el)
    const rect = el.getBoundingClientRect()
    const css = getComputedStyle(el)
    return {
      text: el.textContent.trim(),
      width: rect.width,
      textWidth: text.getBoundingClientRect().width,
      ch,
      right: rect.right,
      cut: el.scrollWidth > el.clientWidth + 1,
      ellipsis: css.textOverflow === 'ellipsis' && css.overflowX !== 'visible',
    }
  })
  return {
    rows: new Set(parts.map((part) => { const r = part.getBoundingClientRect(); return Math.round(r.top + r.height / 2) })).size,
    edge: box.right,
    spare: box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight) - parts.at(-1).getBoundingClientRect().right,
    crumbs,
  }
}

/** Every way a measured trail breaks the rule, one line each, prefixed with `label`. */
export const trailRuleFailures = (label, trail) => {
  const failures = []
  const lastIndex = trail.crumbs.length - 1
  const floor = (crumb, index) => (index === lastIndex ? TRAIL_FLOORS_CH.current : TRAIL_FLOORS_CH.other) * crumb.ch
  if (trail.rows !== 1) failures.push(`${label}: every crumb and separator must share one line, received ${trail.rows} rows`)
  trail.crumbs.forEach((crumb, index) => {
    if (crumb.width < Math.min(crumb.textWidth, floor(crumb, index)) - 1) failures.push(`${label}: "${crumb.text}" collapses below its floor, ${Math.round(crumb.width)}px of ${Math.round(floor(crumb, index))}px`)
    if (crumb.right > trail.edge + 1) failures.push(`${label}: "${crumb.text}" is clipped by the trail's edge without an ellipsis`)
    else if (crumb.cut && !crumb.ellipsis) failures.push(`${label}: "${crumb.text}" is cut without an ellipsis`)
  })
  const cut = trail.crumbs.filter((crumb) => crumb.cut)
  if (cut.length > 0 && trail.spare > 1) failures.push(`${label}: ${cut.map((crumb) => `"${crumb.text}"`).join(', ')} cut with room to spare, ${Math.round(trail.spare)}px free`)
  const current = trail.crumbs[lastIndex]
  if (trail.crumbs.slice(0, -1).some((crumb) => crumb.cut) && current.width > floor(current, lastIndex) + 1) failures.push(`${label}: a crumb shortens before the current crumb "${current.text}" gives way to its floor`)
  return failures
}
