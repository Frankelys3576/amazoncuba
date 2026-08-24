# Conventions

- Spanish for all user-facing strings, code comments explaining Spanish-facing logic, and API error messages. Keep new additions consistent.
- Backend: `routes/*.routes.js` → `controllers/*.controller.js` → Supabase client directly. No service/model layer (the `src/models` dir exists but is empty — don't add files there expecting a pattern to follow, none exists).
- `frontend/` uses a `pages/` subfolder for page components; `seller-frontend/` and `admin-frontend/` are flat — page components live directly under `src/` (e.g. `SellerDashboard.jsx`, `AdminStores.jsx`). Match whichever app you're editing.
- Each app's `src/services/api.js` is a hand-rolled `fetch` wrapper set (no axios/react-query/SWR) — the three files are near-duplicates. When adding an endpoint, add the same wrapper to every app's `api.js` that needs it, keeping the shared error-handling shape: catch + `console.error` + return `[]`/`null`/`{}` fallback for GETs, rethrow for mutations.
- API base URL logic is duplicated per app in `api.js` (prod → fixed backend Vercel URL; dev → localhost:5001 or LAN hostname; `VITE_API_URL` overrides). If the backend's deployed URL changes, update all three `api.js` files.
- `cubaLocations.js` (province/municipality data) and `AddressInputWithAutocomplete`/`LocationPinPicker` components are duplicated per app rather than shared — expect to edit in multiple places.
- `frontend/` uses React Context for cross-page state: `context/CartContext.jsx`, `context/LocationContext.jsx`.
