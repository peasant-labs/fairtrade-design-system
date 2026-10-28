/** @typedef {import('@peasant-labs/schema').UnverifiedPullRequest} UnverifiedPullRequest */
/** @typedef {import('@peasant-labs/schema').UnverifiedPullRequestSource} UnverifiedPullRequestSource */

/**
 * Recorded command evidence, not an attached or independently verified pull request.
 * @param {{pullRequests: readonly UnverifiedPullRequest[], onSourceSelect: (source: UnverifiedPullRequestSource) => void}} props
 */
export default function UnverifiedPullRequests({ pullRequests, onSourceSelect }) {
  if (!pullRequests.length) return null
  return (
    <section className="txn-unverified-pulls" aria-label="unverified pull requests">
      <div className="txn-unverified-pulls-title">unverified pull requests</div>
      <p>These links were recorded in the transcript. They have not been verified here.</p>
      <ul>
        {pullRequests.map((pull) => {
          const canonical = `https://github.com/${encodeURIComponent(pull.owner)}/${encodeURIComponent(pull.repo)}/pull/${pull.number}`
          return (
            <li key={`${pull.owner}/${pull.repo}/${pull.number}`}>
              {pull.url === canonical
                ? <a href={canonical} target="_blank" rel="noopener noreferrer">{pull.owner}/{pull.repo}#{pull.number}</a>
                : <span>{pull.owner}/{pull.repo}#{pull.number}</span>}
              <button className="btn btn-ghost" type="button" onClick={() => onSourceSelect(pull.source)}>view source</button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
