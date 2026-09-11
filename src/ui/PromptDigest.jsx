import { CornerDownRight, GitCommitHorizontal, Layers, User } from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import Chip, { CountBadge } from './Chip.jsx'
import './PromptDigest.css'

/* PromptDigest (.pd-*) — the read-only render of the schema PromptDigest: the prompts behind a
   pull request. Village computes the digest; this renders the chain it is handed and computes
   nothing else. There is no fetching, no tier budget, and no collapse logic here: a COLLAPSED
   chain is data, a chain whose session boundary items carry the promptCount that stands in for a
   run of prompts. Village's pull request page is the first consumer; it must not re-implement
   this, and this must not re-implement transcript rendering — every item links out instead.

   The four DigestItemKind values read distinctly through a real lucide glyph plus their own
   layout, never colour alone. Amber stays scarce: the global `a` rule paints every anchor amber,
   so each chain row resets its colour back to the ink ramp and carries a dotted underline as its
   non-colour link affordance; amber arrives only on hover/focus. The one amber-at-rest link is
   the single header link out to Village.

   Case: the component's own words are lowercase chrome. Nothing off the wire is ever lowercased —
   a prompt's first line, a skill invocation, a session label, the harness slug and the redaction
   level all render exactly as recorded. */

/** @typedef {import('@peasant-labs/schema').PromptDigest} PromptDigestPayload */
/** @typedef {import('@peasant-labs/schema').PromptDigestItem} PromptDigestItemPayload */

/* A prompt shows its first line, cut at 120 characters. The cut is on the TEXT, never a css clip,
   so a reader's own text-spacing stylesheet cannot hide something that is on screen. */
const PROMPT_LINE_MAX = 120

/* A commit anchor shows the abbreviated SHA. The wire carries either the full SHA or an already
   abbreviated one (7 to 40 lowercase hex); seven characters is the abbreviation every tier shows. */
const SHA_ABBREV = 7

/* One glyph per kind, so the four kinds separate without leaning on colour. */
const KIND_ICON = {
  session: Layers,
  prompt: User,
  skill: CornerDownRight,
  commit: GitCommitHorizontal,
}

/** the first line of a prompt, cut at PROMPT_LINE_MAX characters. */
function promptLine(text) {
  const first = String(text ?? '').split('\n', 1)[0].trim()
  return first.length > PROMPT_LINE_MAX ? `${first.slice(0, PROMPT_LINE_MAX)}…` : first
}

/**
 * the body of one chain row, by kind. everything recorded upstream renders verbatim; the only
 * words this function writes itself are the two lowercase count labels on a session boundary.
 * an unrecognised kind renders nothing rather than guessing a layout for it.
 */
function RowBody({ item }) {
  if (item.kind === 'session') {
    return (
      <>
        <span className="pd-session-label">{item.text}</span>
        <span className="pd-session-counts">
          <span className="pd-count-pair">
            <span className="tnum">{item.promptCount}</span> prompts
          </span>
          <span className="pd-count-pair">
            <span className="tnum">{item.commitCount}</span> commits
          </span>
        </span>
      </>
    )
  }
  if (item.kind === 'prompt') {
    return (
      <>
        <span className="pd-ordinal tnum">{item.ordinal}</span>
        <span className="pd-prompt-text">{promptLine(item.text)}</span>
      </>
    )
  }
  if (item.kind === 'skill') {
    return <span className="pd-skill-text">{item.text}</span>
  }
  if (item.kind === 'commit') {
    return <code className="pd-sha">{String(item.commitSha ?? '').slice(0, SHA_ABBREV)}</code>
  }
  return null
}

/**
 * one row of the chain. with a resolved href the row is a real link to its target; without one it
 * is plain text, so a consumer that has no route yet still gets a readable chain. a commit anchor
 * leaves the product (it points at GitHub), so it carries the external-link attributes.
 */
function ChainRow({ item, href }) {
  const Icon = KIND_ICON[item.kind]
  const body = (
    <>
      {Icon && <Icon className="pd-row-icon" aria-hidden="true" />}
      <RowBody item={item} />
    </>
  )
  const external = item.kind === 'commit'

  return (
    <li className={`pd-row pd-row-${item.kind}`}>
      {href ? (
        <a
          className="pd-row-link"
          href={href}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : null)}
        >
          {body}
        </a>
      ) : (
        <span className="pd-row-link">{body}</span>
      )}
    </li>
  )
}

/**
 * PromptDigest — the prompts behind a pull request, rendered read-only from the schema type.
 *
 * @param {object} props
 * @param {PromptDigestPayload} props.digest - the digest exactly as Village computed it. the
 *        component renders the items it is given: it never builds, fetches, budgets, or collapses
 *        a chain. a collapsed chain arrives as data, its session boundary items standing in for
 *        the runs of prompts they hold.
 * @param {(item: PromptDigestItemPayload) => string} [props.itemHref] - resolves one chain item to
 *        its link target; the item's `kind` selects the destination (`session` -> the transcript on
 *        Village, `prompt` and `skill` -> that turn in the shared transcript viewer, `commit` -> the
 *        commit on GitHub). omit it and the chain renders as plain rows; the component owns no routes.
 * @param {string} [props.className] - extra classes appended after `.pd`
 */
export default function PromptDigest({ digest, itemHref, className = '', ...rest }) {
  const { header, skills, items } = digest
  const cls = ['pd', className].filter(Boolean).join(' ')

  return (
    <section className={cls} aria-label="prompts behind this pull request" {...rest}>
      <header className="pd-head">
        <dl className="pd-counts">
          <div className="pd-count">
            <dt className="pd-label">sessions</dt>
            <dd className="pd-value tnum">{header.sessionCount}</dd>
          </div>
          <div className="pd-count">
            <dt className="pd-label">prompts</dt>
            <dd className="pd-value tnum">{header.promptCount}</dd>
          </div>
          <div className="pd-count">
            <dt className="pd-label">commits</dt>
            <dd className="pd-value tnum">
              {header.commitsCovered} of {header.commitsTotal}
            </dd>
          </div>
          <div className="pd-count">
            <dt className="pd-label">harness</dt>
            <dd className="pd-value pd-harness">
              <BrandMark name={header.harness} />
              {header.harness}
            </dd>
          </div>
          <div className="pd-count">
            <dt className="pd-label">redaction</dt>
            <dd className="pd-value">{header.redactionLevel}</dd>
          </div>
        </dl>
        <a className="link pd-village" href={header.villageUrl}>
          view on village
        </a>
      </header>

      {skills.length > 0 && (
        <div className="pd-skills" role="group" aria-label="skills and plugins">
          <span className="pd-label" aria-hidden="true">
            skills and plugins
          </span>
          <ul className="pd-skill-list">
            {skills.map((skill) => (
              <li key={skill.name}>
                {/* no `chrome` prop: the recorded name keeps its case, and the leading slash is
                    what separates a skill or user command from a bare plugin identifier. */}
                <Chip size="sm" className="pd-skill">
                  {skill.name}
                  <CountBadge count={skill.invocationCount} />
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="pd-chain">
        {items.map((item, index) => (
          <ChainRow key={`${item.kind}-${index}`} item={item} href={itemHref?.(item)} />
        ))}
      </ul>
    </section>
  )
}
