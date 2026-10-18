# Fairtrade release review evidence

Inspected mounted production-demo captures for [PR166](https://github.com/peasant-labs/fairtrade-design-system/pull/166).

- Release source: `2a002539ac3e266b02ae13bed0714a620c9fa870`.
- Release tree: `1c302279f256a0283c3dc32e1acd8e98f2e4e1f9`.
- Package: `0.0.30`.
- Synthetic demonstration data only. These images are not the unfinished Peasant consumer.
- Both themes, desktop 1280x1100 and mobile 390x844, catalog and selected long-history states.
- Canonical release-head Playwright run: 142 passed, 56 expected opposite-theme duplicate skips, no unexpected or flaky tests.
- Full current library tests, prepack, generation, served commit/version, HTML and asset hashes passed.

The sanitized [manifest](review-evidence/local-village/manifest.json) records exact source, build and image hashes. Captures were inspected before publication and copied without changing their bytes.

This evidence-only branch intentionally contains no application code or CI workflow. Keep this branch and its locked worktree while PR166 is open: the PR embeds these images directly. Do not delete it during ordinary feature-branch cleanup.
