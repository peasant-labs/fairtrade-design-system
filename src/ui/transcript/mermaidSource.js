/* Only this deliberately small grammar is passed to the live Mermaid renderer. Identifiers
   are remapped; labels cannot contain markup, entities, directives, or CSS. */
const LABEL = '[A-Za-z0-9 _.,!?()\\-]{1,80}'
const NODE = `([A-Za-z][A-Za-z0-9_]{0,30})(?:\\[(${LABEL})\\])?`
const nodePattern = new RegExp(`^${NODE}$`)
const edgePattern = new RegExp(`^${NODE}\\s*(-->|---)\\s*${NODE}$`)
const participantPattern = new RegExp(`^participant\\s+([A-Za-z][A-Za-z0-9_]{0,30})(?:\\s+as\\s+(${LABEL}))?$`)
const messagePattern = new RegExp(`^([A-Za-z][A-Za-z0-9_]{0,30})\\s*(->>|-->>|->|-->)\\s*([A-Za-z][A-Za-z0-9_]{0,30})\\s*:\\s*(${LABEL})$`)

export function canonicalMermaid(source) {
  if (typeof source !== 'string' || source.length > 8192) return null
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length < 2 || lines.length > 81) return null
  const flow = /^(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)$/.exec(lines[0])
  const sequence = lines[0] === 'sequenceDiagram'
  if (!flow && !sequence) return null
  const ids = new Map()
  const labels = new Map()
  const id = (name) => {
    if (!ids.has(name)) ids.set(name, `n${ids.size}`)
    return ids.get(name)
  }
  const out = [flow ? `flowchart ${flow[1]}` : 'sequenceDiagram']
  let operations = 0
  for (const line of lines.slice(1)) {
    if (flow) {
      const edge = edgePattern.exec(line)
      const single = nodePattern.exec(line)
      if (!edge && !single) return null
      const render = (name, label) => {
        const mapped = id(name)
        if (label) {
          if (labels.has(name) && labels.get(name) !== label) return null
          labels.set(name, label)
          return mapped
        }
        return mapped
      }
      if (edge) {
        const a = render(edge[1], edge[2]); const b = render(edge[4], edge[5])
        if (!a || !b) return null
        out.push(`${a} ${edge[3]} ${b}`)
        operations++
      } else {
        const item = render(single[1], single[2]); if (!item) return null
        out.push(item)
      }
    } else {
      const participant = participantPattern.exec(line)
      const message = messagePattern.exec(line)
      if (participant) {
        if (labels.has(participant[1])) return null
        labels.set(participant[1], participant[2] || participant[1])
        out.push(`participant ${id(participant[1])} as ${labels.get(participant[1])}`)
      } else if (message) {
        out.push(`${id(message[1])}${message[2]}${id(message[3])}: ${message[4]}`)
        operations++
      } else return null
    }
    if (ids.size > 40 || operations > 60) return null
  }
  if (!operations) return null
  const declarations = [...ids].map(([name, mapped]) => flow
    ? `${mapped}["${labels.get(name) || name}"]`
    : `participant ${mapped} as ${labels.get(name) || name}`)
  return [out[0], ...declarations, ...out.slice(1).filter(line => !sequence || !line.startsWith('participant '))].join('\n')
}
