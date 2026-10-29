# Mounted reader evidence

Source: c4db5fc (PR 215). Production Vite app build served from that exact worktree on port 5201, not Storybook. The served index bundle contains the nested-agent depth implementation and React SVG property normalization.

Path: `/?app=transcript&transcript=ledger-nesting&fb=off&theme={light,dark}#inuse`.

Both themes at 1440x900 and 390x900 were inspected. Measurements retain full nested depth, cap visual insets at three levels, preserve role-icon borders and show no horizontal document overflow or page errors. Screenshots contain synthetic fixtures only.

Final PR source head: 101cae9. Its difference from c4db5fc is confined to the two browser-test files; application/library/token/generated source is byte-identical. The inspected served index bundle SHA256 is d74dfd8cf0952ac1a8e38d8fe3569349249107b0dd1bfe674462230df7d7de42. The final local complete browser catalog passed436 cases with56 planned skips; no screenshot masking or threshold reductions were used.
