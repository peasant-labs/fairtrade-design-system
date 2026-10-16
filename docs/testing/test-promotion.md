# Test promotion checklist

An elaborate test is promoted only when a lower-level check cannot observe the real risk.
This record is a governance precondition, not a test oracle. It is independent of any
validation package, browser, runner, app data, or service.

## Lower-layer-first rule

Before adding a mounted or otherwise elaborate test, answer all ten questions below and
record the lower-layer decision. If a direct fixture, value, or contract check observes the
risk, keep that check and do not promote the elaborate test.

## The ten questions

1. Subject: the exact invariant under protection.
2. Necessity: why a direct lower-level check cannot catch the failure.
3. Production path: the real path the test executes.
4. Cost: services, rows, artifacts, and time the test consumes.
5. Lifetime: temporary output the test creates and how every exit path cleans it up.
6. Concurrency: how parallel runs avoid sharing files, ports, or identities.
7. CI parity: the exact command from a clean checkout in the pinned environment.
8. Evidence: the durable, inspectable output a reviewer reads.
9. Mutation: the small change that must make the test fail for the intended reason.
10. Exit condition: the evidence that later allows simplifying or deleting the test.

## Record format

Each record carries the ten answers plus three explicit sections:

- `lowerLayer`: `result` is `promote` or `retain`, with `detail` naming the lower-layer
  check and its outcome.
- `decision`: `verdict` is `approve` or `reject`, with `rationale` stating why the
  elaborate test is approved or refused.
- `executionPolicy`: `runner`, `budget`, and `cleanup` binding the run envelope.
- `exitCondition`: the simplification or deletion trigger, restated as its own field so
  reviewers can find it without rereading all ten answers.

## Files and validation

- `scripts/testdata/test-promotion.yaml`: named valid records.
- `scripts/testdata/test-promotion.manifest.yaml`: required record and mutation names
  plus the executable mutation inventory. Combinatorial cases live here, never inline.
- `scripts/assert-test-promotion.mjs`: strict one-document loader and validator. It
  checks exact declared fields and membership, passes every named valid record
  (including a leading `---` start marker), and executes every named mutation
  for deletion, blank values, rename, duplicate names, trailing documents
  (including a `...` end-marker trailing case), unknown fields, and bad enums.
  Each failure names the missing or invalid field with
  document and path context plus repair guidance.

Run it browser-free with no service:

```text
node scripts/assert-test-promotion.mjs
```

## Graph and transcript accessibility journeys

1. Subject: invalid tree/list children, unreachable scrollers, unnamed controls, wrong theme,
   undersized targets and lost keyboard behavior on the mounted product.
2. Necessity: direct semantic fixtures cover DOM contracts; axe, computed dimensions and real
   keyboard input must observe the browser layout that caused these defects.
3. Production path: built `dist/` graph map, analytics, transcript, settings and publish dialog.
4. Cost: existing Playwright host, four surfaces at three widths in two themes, six target rows,
   two mutation rows; publish scans extend the existing walk rather than duplicate it. Each test
   retains the existing 60-second timeout; no second runner or copied production code.
5. Lifetime: existing ignored journey artifacts; optional captures go to an explicit directory.
   Playwright owns browser/service teardown; interrupted capture sets are incomplete evidence.
6. Concurrency: one worker; isolated checkout and explicit app/Storybook ports for local runs.
7. CI parity: `pnpm build`, `pnpm build-storybook`, then `pnpm journey:ci` on the pinned runner.
8. Evidence: scoped axe JSON, observed URL/root theme, served-asset byte equality/digests,
   actual keyboard actions and mounted full-shell screenshots in both themes.
9. Mutation: unpinned/wrong themes, exposed tree disclosure, unnamed button and a 22px turn
   anchor fail their owning assertions. Source mutations separately protect semantic fixes.
10. Exit condition: collapse rows when an existing product journey proves these exact risks;
    do not replace mounted geometry or axe with a source-shape check.
