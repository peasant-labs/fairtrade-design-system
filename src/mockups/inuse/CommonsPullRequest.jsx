import { useState } from 'react'
import { ExternalLink, GitPullRequest } from 'lucide-react'
import { Button, PromptDigest } from '../../ui'
import { PR_DIGEST, prDigestHref } from './pr-digest-fixture.js'

/* The village pull request prompts page for the in-use commons demo: the pull request, the offer
   to attach the author's matching transcripts, which commits have a transcript, then the prompt
   digest in its split layout (sessions beside a reading pane, j and k to move). Demo data only. */
export function PullRequestView() {
  const [offer, setOffer] = useState('open')
  return (
    <div className="iu-page">
      <header className="iu-page-head">
        <p className="iu-page-context"><GitPullRequest aria-hidden="true" /> <span className="mono">acme/ingest-api</span> <span className="tnum">#42</span></p>
        <div className="iu-page-titlerow">
          <h2 className="iu-page-title">Fix flaky ingest test</h2>
          <Button as="a" href="https://github.com/acme/ingest-api/pull/42" variant="secondary" size="sm" iconRight={ExternalLink}>view on github</Button>
        </div>
        <p className="iu-page-sub mono">@alice-dev · fix/flaky-ingest · <span className="tnum">4</span> commits</p>
      </header>

      {offer === 'open' && (
        <section className="iu-page-callout" aria-label="attach your transcripts">
          <p className="iu-page-callout-text">
            <strong><span className="tnum">2</span> of your transcripts match this pull request.</strong> attach them so reviewers can read them next to the code.
          </p>
          <p className="iu-page-callout-text">who can read them: members of Acme Platform and Acme Company. attaching does not change that.</p>
          <div className="iu-page-callout-actions">
            <Button variant="primary" size="sm" onClick={() => setOffer('attached')}>attach 2 transcripts</Button>
            <Button variant="ghost" size="sm" onClick={() => setOffer('dismissed')}>not now</Button>
          </div>
        </section>
      )}
      {offer === 'attached' && <p className="iu-page-tip" role="status">attached 2 transcripts. reviewers see them on this pull request.</p>}

      <p className="iu-page-tip"><span className="tnum">3</span> of <span className="tnum">4</span> commits have a transcript. <code className="mono">a07c3e1</code> bump go.sum has none.</p>

      <PromptDigest digest={PR_DIGEST} itemHref={prDigestHref} layout="split" />
    </div>
  )
}
