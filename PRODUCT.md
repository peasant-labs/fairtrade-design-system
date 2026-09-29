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

- **Exports.** The package exports token, base, and component CSS, `/icons`, and `/ui` (primitives, composites, and the adapter).
- **The in-use demo is the fidelity oracle.** Consuming apps are held to it element for element.
- **Visual gates.** They compare the demo (on the left) with the consuming app (on the right), capture both themes, and probe computed styles.
- **Section order.** The graph app sections run `analytics | changes | code map` (`GRAPH_APP_SECTIONS`). They stay binding until a user-ratified replacement lands here first.

## Capabilities and Constraints

- **Fonts.** Atkinson Hyperlegible for body text and Atkinson Hyperlegible Mono for chrome. Load both with a `<link>` in the head, never a remote `@import`.
- **Case.** All UI chrome is lowercase. User content is never lowercased.
- **Shape and color.** Radius 0. Tokens only. Amber is a scarce accent.
- **Themes.** There are two themes, and both meet WCAG AA.
- **Type.** A 16px body floor, mono-14 chrome, and tabular numbers on counts and durations.
- **Brand marks.** Provider names lead with `<BrandMark>`.
- **Highlighting.** Syntax highlighting returns structured output only (`codeToHast` or `codeToTokens`), rendered through React. Raw HTML injection is never allowed.
- **Order of change.** A new visual pattern needed by a consuming app lands here before the app uses it.

## Brand Commitments

- **Name.** fairtrade.
- **Design record.** The design language lives in `llm/DESIGN.md` and the neuroinclusive defaults live in `llm/NEUROINCLUSIVE.md`. Both are binding.

## Evidence on Hand

- **Available.** The in-use demo, the demo fixtures, the Storybook stories, and the tracked `baselines/` regression references.
- **Not available.** No adoption metrics or external users exist. Do not invent them.

## Product Principles

1. **One source of truth.** Consumers conform and never redefine a value.
2. **The demo is the oracle.** When the demo and the docs disagree, match the demo and file the conflict.
3. **The transcript is the product.** Every component serves reading an agent's trace faithfully.
4. **Accessible by default.** WCAG AA in both themes, with neuroinclusive defaults.

## Accessibility & Inclusion

WCAG AA in both themes. The neuroinclusive defaults are set in `llm/NEUROINCLUSIVE.md`, including at most five primary actions per view and static-first motion.
