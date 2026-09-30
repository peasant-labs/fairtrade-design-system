# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the consuming apps and the people and agents who build them.** Today the apps are peasant's local web and village's frontend. Builders use fairtrade's tokens, base CSS, primitives, and transcript composites instead of writing their own.
- **Secondary: fairtrade contributors,** who extend the system and keep the in-use demo current.
- **End users** are the developers and reviewers who read AI coding transcripts in those apps. Their product truth lives in the peasant-labs workspace `PRODUCT.md` (peasant-labs/polyrepo). This file does not restate it.

## Product Purpose

Fairtrade is the single source of truth for every theming and transcript-component decision across peasant-labs. It is published to npm as `@peasant-labs/fairtrade`. Success means both apps render a transcript identically, and neither redefines a canonical value.

## Positioning

Fairtrade is a design system built around one job: rendering an AI coding transcript faithfully. The package provides:
- `TranscriptViewer`;
- `adaptTranscript`, the only boundary that parses the wire format and normalizes git data;
- the `@xyflow` graph engine;
- the review, redaction, consent, and share composition.

## Operating Context

- **Exports.** The package exports:
  - token, base, font, and component CSS, and the token JSON;
  - `/icons`;
  - `/ui`: primitives, composites, and the adapter;
  - the surface entry points `/graph`, `/commons`, and `/analytics`, each with its CSS.

  `package.json` is the list of record.
- **The in-use demo is the fidelity oracle.** Consuming apps are held to it element for element.
- **Visual gates.** They compare the demo (on the left) with the consuming app (on the right), capture both themes, and probe computed styles.
- **Section registry.** The local app's sections come from `LOCAL_APP_SECTIONS`.
  - `home` and `settings` are in the nav.
  - `analytics`, `changes`, and `code map` are reached by route only.
  - Consumers derive their nav and routes from the registry.
  - `GRAPH_APP_SECTIONS` is a deprecated alias for the older three-section shape.
  - A replacement is ratified here first.

## Capabilities and Constraints

- **Visual rules.** Every binding visual rule lives in `DESIGN.md`. This file does not restate them.
- **Source.** The library is JavaScript and JSX only, with no TypeScript.
- **Highlighting.** Syntax highlighting returns structured output only (`codeToHast` or `codeToTokens`), rendered through React. Raw HTML injection is never allowed.
- **Order of change.** A new visual pattern needed by a consuming app lands here before the app uses it.

## Brand Commitments

- **Name.** fairtrade.
- **Design record.** The design language, tokens, and neuroinclusive rules live in `DESIGN.md`, and they are binding. `llm/NEUROINCLUSIVE.md` keeps the research behind those rules.

## Evidence on Hand

- **Available.** The in-use demo, the demo fixtures, the Storybook stories, and the tracked `baselines/` regression references.
- **Not available.** No adoption metrics or external users exist. Do not invent them.

## Product Principles

1. **One source of truth.** Consumers conform and never redefine a value.
2. **The demo is the oracle.** When the demo and the docs disagree, match the demo and file the conflict.
3. **The transcript is the product.** Every component serves reading an agent's trace faithfully.
4. **Accessible by default.** WCAG AA in both themes, with neuroinclusive defaults.

## Accessibility & Inclusion

WCAG AA in both themes, with the neuroinclusive defaults set in `DESIGN.md`.
