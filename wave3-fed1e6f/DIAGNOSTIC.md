# Reproducibility control: prior 82-pixel mismatch did not reproduce

Exact builds: base ec4a7ee572b3911a4e2b82e4216368ab88b84af9/5312, candidate fed1e6f4f5a54844ce0b6e103461c9db23064f77/5311. Both fresh pnpm builds passed. Each capture independently verified served JS/CSS equals its build's dist bytes; asset hashes unchanged from the earlier records. Full commands, URLs and hashes in diagnostic.json. All previous evidence remains untouched.

Dark/reduce, viewport390×900, Chromium headless, fresh context for each run, same navigation/fixture selectors/font readiness/section opacity/500ms settle as the prior pass. Capture order base1, base2, candidate1, candidate2. This is an explicit reproducibility control, not replacement evidence or a retake-to-hide.

| Comparison | Pixels over tol16 | x/y range |
|---|---:|---|
| base1–base2 | 0 | none |
| candidate1–candidate2 | 0 | none |
| base1–candidate1 | 0 | none |
| base1–candidate2 | 0 | none |
| base2–candidate1 | 0 | none |
| base2–candidate2 | 0 | none |
| reduced switch base–candidate | 0 | none |

All four governance PNGs are byte-identical, SHA256 8d5ebd0756247d9a757d520c53546069fc7ea44b8970ac3a48f7cbe14caf9428. The same existing png-diff primitive and tol16 were used, with additive coordinate-range extraction only. No crop/mask/style override/tolerance change.

## Metrics

All four governance captures: document scrollTop72095 (integer), window scrollY72095, clientHeight900, scrollHeight105599, DPR1, innerWidth390, innerHeight900. Fractional scroll offset: false in every capture. Therefore differing fractional offsets are NOT an observed suspect in this control. Prior captures did not record scroll offsets, so this does not exclude fractional positioning in the earlier run.

Both switch captures: scrollTop25578 (integer), clientHeight900, scrollHeight105599, DPR1, innerWidth390, innerHeight900. Real interaction false→true; identical control geometry and checked state; candidate thumb will-change auto, base transform; reduced duration0.00001s (0.01ms) in both.

## Interpretation and limits

Observed within-build variance floor in this small control: 0 pixels. Across-build counts also0 for all four comparisons. The earlier82-pixel scattered glyph mismatch did not reproduce under this control. It is NOT evidence for a deterministic reduced-mode build difference. Across the earlier pass and this control the observed difference is unstable (82 then0); the underlying cause remains unproven. This control did not itself show nonzero within-build nondeterminism, so it cannot claim demonstrated within-build rasterization variance or justify an82-pixel blanket tolerance. No cherry-picking: all six matrix outcomes, switch outcome and previous82-pixel failure remain recorded.

This diagnostic does not complete the remaining light/desktop/transcript evidence matrix. No production/repository edits, commits, fixes, reviews, publication, push, merge or task closure. Both owned previews stopped; detached base worktree removed; candidate git status clean. Further evidence continuation remains the supervisor's decision.
