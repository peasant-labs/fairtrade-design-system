import { useId, useState } from 'react'
import { ChevronDown, CornerDownRight, GitCommitHorizontal, Layers, User } from 'lucide-react'
import Avatar from './Avatar.jsx'
import BrandMark from './BrandMark.jsx'
import Chip, { CountBadge } from './Chip.jsx'
import './PromptDigest.css'

/* PromptDigest (.pd-*) — the read-only render of the schema PromptDigest: the prompts behind a
   pull request. Village computes the digest; this renders the chain it is handed and computes
   nothing else. There is no fetching, no tier budget, and no collapse logic here: a COLLAPSED
   chain is data, a chain whose session boundary items carry the promptCount that stands in for a
   run of prompts. Village's pull request page is the first consumer; it must not re-implement
   this, and this must not re-implement transcript rendering — every item links out instead.

   The default chain shows session boundaries as separators and, under each, prompt rows only: a
   skill or commit item never gets its own top-level row. Instead it attaches to the nearest
   preceding prompt (grouped by groupChainItems below, crossing a session boundary when the
   current session has not produced a prompt yet) and surfaces inside that prompt's own disclosure
   — a real toggle button that unclamps the prompt's own text in place and reveals the skills
   invoked and commits that followed, rather than repeating the text a second time. An item with
   no preceding prompt at all falls back to a plain row, rendered
   exactly as the chain has always rendered one, so nothing Village sent is ever dropped from view.

   Session, skill, and commit rows read distinctly through a real lucide glyph plus their own
   layout, never colour alone. A prompt row leads with the author's avatar when the page supplies
   one, or the same generic glyph as before when it does not — the avatar is a component prop, not
   part of the wire payload. Amber stays scarce: the global `a` rule paints every anchor amber, so
   each chain row resets its colour back to the ink ramp and carries a dotted underline as its
   non-colour link affordance; amber arrives only on hover/focus. The one amber-at-rest link is
   the single header link out to Village. The disclosure chevron is chrome-coloured only, at rest
   and open alike — it never spends the amber accent.

   Case: the component's own words are lowercase chrome. Nothing off the wire is ever lowercased —
   a prompt's text, a skill invocation, a session label, and the harness slug all render exactly
   as recorded. */

/** @typedef {import('@peasant-labs/schema').PromptDigest} PromptDigestPayload */
/** @typedef {import('@peasant-labs/schema').PromptDigestItem} PromptDigestItemPayload */

/**
 * @typedef {object} PromptAuthor
 * @property {string} login - the GitHub login; also the avatar's accessible name.
 * @property {string} avatarUrl - the GitHub profile photo url.
 */

/* A commit anchor shows the abbreviated SHA. The wire carries either the full SHA or an already
   abbreviated one (7 to 40 lowercase hex); seven characters is the abbreviation every tier shows. */
const SHA_ABBREV = 7

/* One glyph per kind rendered at the chain's top level: a prompt row leads with its own generic
   glyph instead, so it carries no entry here. */
const KIND_ICON = {
  session: Layers,
  skill: CornerDownRight,
  commit: GitCommitHorizontal,
}

/**
 * groups the flat wire chain into what the default view renders: a prompt starts an entry that
 * will carry the skill/commit items following it; a skill or commit attaches to the nearest
 * preceding prompt entry in chain order, crossing a session boundary when the current session has
 * not produced a prompt of its own yet (Village orders anchors on the last prompt before the
 * commit, so this is the common case, not the fallback). everything else — a session boundary, or
 * a skill/commit with no preceding prompt at all — becomes its own plain entry, rendered exactly
 * as the chain renders one today, so nothing recorded is ever dropped from view.
 */
function groupChainItems(items) {
  const groups = []
  let openPrompt = null

  for (const item of items) {
    if (item.kind === 'prompt') {
      openPrompt = { type: 'prompt', item, skills: [], commits: [] }
      groups.push(openPrompt)
    } else if (item.kind === 'skill' && openPrompt) {
      openPrompt.skills.push(item)
    } else if (item.kind === 'commit' && openPrompt) {
      openPrompt.commits.push(item)
    } else {
      groups.push({ type: 'plain', item })
    }
  }
  return groups
}

/**
 * the body of one plain chain row, by kind: a session boundary, or a skill/commit item rendered
 * on its own (either the rare no-preceding-prompt fallback at the chain's top level, or reused
 * unchanged inside a prompt's own details). everything recorded upstream renders verbatim; the
 * only words this function writes itself are the two lowercase count labels on a session
 * boundary. an unrecognised kind renders nothing rather than guessing a layout for it.
 */
function RowBody({ item }) {
  if (item.kind === 'session') {
    return (
      <>
        <span className="pd-session-label">{item.text}</span>
        <span className="pd-session-counts">
          <span className="pd-count-pair">
            <span className="tnum">{item.promptCount}</span> {item.promptCount === 1 ? 'prompt' : 'prompts'}
          </span>
          <span className="pd-count-pair">
            <span className="tnum">{item.commitCount}</span> {item.commitCount === 1 ? 'commit' : 'commits'}
          </span>
        </span>
      </>
    )
  }
  if (item.kind === 'skill') {
    return <span className="pd-skill-text">{item.text}</span>
  }
  if (item.kind === 'commit') {
    return (
      <>
        <code className="pd-sha">{String(item.commitSha ?? '').slice(0, SHA_ABBREV)}</code>
        {/* additions, deletions, and files-changed render here once PromptDigestItem carries those fields */}
      </>
    )
  }
  return null
}

/**
 * one plain row of the chain: a session boundary, or a skill/commit item that is not shown inside
 * a prompt's details. with a resolved href the row is a real link to its target; without one it
 * is plain text, so a consumer that has no route yet still gets a readable chain. a commit anchor
 * leaves the product (it points at GitHub), so it carries the external-link attributes.
 */
function ChainRow({ item, href }) {
  /* an own-property lookup, so a kind outside the closed set (or a prompt, which never reaches
     this component) drops the row entirely rather than emitting an empty focusable link — and so
     a name like "constructor" cannot reach through to Object.prototype and be rendered as a
     component. */
  if (!Object.hasOwn(KIND_ICON, item.kind)) return null
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
 * one prompt entry in the default chain: the author's avatar (or the generic glyph fallback), the
 * ordinal, and the prompt text wrapped and clamped to two lines by CSS alone — no JavaScript
 * truncation, no character cut, so the full text is always in the DOM. a real disclosure button
 * at the row's right end unclamps that same text in place and reveals the skills invoked and
 * commits that followed this prompt (Village attaches them via groupChainItems above); the text is
 * never repeated a second time below. collapsed by default; open state is local to this row, never
 * lifted.
 */
function PromptRow({ entry, href, itemHref, author }) {
  const { item, skills, commits } = entry
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const text = String(item.text ?? '').trim()
  const hasDetails = skills.length > 0 || commits.length > 0

  const glyph = author ? (
    <Avatar name={author.login} src={author.avatarUrl} className="pd-row-avatar" />
  ) : (
    <User className="pd-row-icon" aria-hidden="true" />
  )

  const linkBody = (
    <>
      {glyph}
      <span className="pd-ordinal tnum">{item.ordinal}</span>
      <span className={open ? 'pd-prompt-text' : 'pd-prompt-text pd-prompt-clamp'}>{text}</span>
    </>
  )

  return (
    <li className={open ? 'pd-row pd-row-prompt pd-row-open' : 'pd-row pd-row-prompt'}>
      <div className="pd-prompt-row">
        {href ? (
          <a className="pd-row-link" href={href}>
            {linkBody}
          </a>
        ) : (
          <span className="pd-row-link">{linkBody}</span>
        )}
        <button
          type="button"
          className="pd-chevron"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`details for prompt ${item.ordinal}`}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown className="pd-chevron-icon" aria-hidden="true" />
        </button>
      </div>
      <div id={detailsId} className="pd-details" hidden={!open}>
        {hasDetails && (
          <ul className="pd-details-list">
            {skills.map((skill, i) => (
              <ChainRow key={`skill-${i}`} item={skill} href={itemHref?.(skill)} />
            ))}
            {commits.map((commit, i) => (
              <ChainRow key={`commit-${i}`} item={commit} href={itemHref?.(commit)} />
            ))}
          </ul>
        )}
      </div>
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
 * @param {PromptAuthor} [props.author] - the writer of these prompts, supplied by the page (not
 *        wire data). when given, every prompt row's avatar renders the writer's GitHub profile
 *        photo via the existing `Avatar` family; when omitted, prompt rows keep today's generic
 *        glyph.
 * @param {string} [props.className] - extra classes appended after `.pd`
 */
export default function PromptDigest({ digest, itemHref, author, className = '', ...rest }) {
  const { header, skills, items } = digest
  const cls = ['pd', className].filter(Boolean).join(' ')
  const groups = groupChainItems(items)

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
        {groups.map((entry, index) =>
          entry.type === 'prompt' ? (
            <PromptRow
              key={`prompt-${index}`}
              entry={entry}
              href={itemHref?.(entry.item)}
              itemHref={itemHref}
              author={author}
            />
          ) : (
            <ChainRow key={`${entry.item.kind}-${index}`} item={entry.item} href={itemHref?.(entry.item)} />
          ),
        )}
      </ul>
    </section>
  )
}
