# Design decision audit

`pnpm test:design-decisions` validates the named register contract and runs the
fixture mutations against the same assertions used by the audit.
`pnpm audit:design-decisions` reads every file recursively under `src/ui` and
`src/mockups`, including stories and documentation, and refuses literal U+00B7,
HTML entities and escaped Unicode forms that emit the same separator.
The allowed set is empty. It also requires every decision binding to be resolved.

Both commands run in the library build's shared test gate. The source sweep and
record reconciliation have landed; all bindings describe existing implementation.
The contract tests passing alone do not mean reconciliation is complete: the
real-source audit must also pass.

## Register binding

`scripts/testdata/design-decisions.yaml` records approved dispositions, not done
states. `binding: null` means reconciliation has not been verified, even if the
implementation already exists. Resolved bindings identify source excerpts and
record amendments, not release or merge approval.

For each verified resolution replace null with:

```yaml
binding:
  codeReference: {file: src/path/to/implementation.jsx, contains: 'actual source excerpt'}
  pointerRemoved: '#136/1'
  lineRemoved: 'exact original conflict line containing the pointer'
  restatingFilesAmended:
    - {file: DESIGN.md, contains: 'actual amended prose excerpt'}
```

Use that row's actual pointer, original line, code path and amended prose. List
every amended restating file, not files that needed no change. The canonical
record must be among them. The audit checks code and amendment excerpts exist,
the removed line is absent, and no matching resolved pointer survives in any of
the six restating files. Exact excerpts are evidence of edits, not a substitute
for human verification that the prose and implementation agree. Bind only after
the owning implementation and amendments exist on the current branch.
If the original record had no conflict line for an item (heading hierarchy, for
example), use `lineRemoved: null` with a nonempty `lineRemovalNote` explaining that
absence. This does not waive code, amendment or pointer-remnant checks.

## Test promotion record

- **Subject:** no middots in the complete UI/mockup source trees; resolved decisions
  have existing code, removed conflict pointers/lines and record amendments.
- **Necessity:** a direct fixture test proves detection; the read-only source scan
  observes new files and real record remnants that synthetic inputs cannot see.
- **Production path:** the dedicated audit reads the current repository source
  and authored records. It makes no claim about mounted behavior or shipped bytes.
- **Cost:** one Node process, one recursive scan and six record reads; seconds of
  local compute, no browser, subprocess, copied code or build configurations.
- **Lifetime:** no files, temporary directories, services or databases are created;
  interruptions leave no state. Mutations modify only cloned in-memory fixtures.
- **Concurrency:** reads only; run against a frozen tree for final proof so another
  writer cannot change source during the scan.
- **CI parity:** both commands run from a clean checkout with the pinned Node/pnpm
  toolchain and installed yaml dependency; both commands are required by `build:lib` in CI.
- **Evidence:** assertions name unresolved decisions or offending file/line locations.
  This is source-policy evidence, not screenshots or rendered interaction proof.
- **Mutation:** `planted-middot` adds a literal separator and must fail with
  `middot forbidden`; record mutations refuse a null binding, missing code excerpt
  and a retained pointer in a noncanonical restating file. Encoded and escaped
  separator mutations protect against hiding a rendered middot from the scan.
- **Exit condition:** retain this direct fixture/source layer, with no promotion to
  a browser harness; simplify if an existing source lint covers the same full trees
  and the register's evidence/remnant checks.
