# Task Completion Checklist

No test suite exists in any app. Before considering a task done:
- Frontends: run `npm run lint` (oxlint) in the app(s) touched; run `npm run build` if the change is nontrivial (Vite build catches import/type issues oxlint won't).
- Backend: no lint/test script — manually sanity-check by running `npm run dev` and exercising the changed route(s) if feasible.
- If an endpoint was added/changed, verify the corresponding `services/api.js` wrapper was updated in every frontend app that consumes it (see `mem:conventions`).
- UI changes: start the dev server and manually verify in a browser (golden path + edge cases) — do not claim a UI feature works from lint/build alone.
