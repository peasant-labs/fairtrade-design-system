# Mounted reader evidence

Source: c4db5fc (PR 215). Production Vite app build served from that exact worktree on port 5201, not Storybook. The served index bundle contains the nested-agent depth implementation and React SVG property normalization.

Path: `/?app=transcript&transcript=ledger-nesting&fb=off&theme={light,dark}#inuse`.

Both themes at 1440x900 and 390x900 were inspected. Measurements retain full nested depth, cap visual insets at three levels, preserve role-icon borders and show no horizontal document overflow or page errors. Screenshots contain synthetic fixtures only.
