# Frontends Core

Three independent Vite/React SPAs sharing the same shape (see `mem:tech_stack`, `mem:conventions` for stack/patterns). Per-app specifics:

- `frontend/` (storefront): `pages/` subfolder for routes; `context/CartContext.jsx` + `context/LocationContext.jsx` for cross-page state (cart, selected province/municipality).
- `seller-frontend/` (store owner dashboard): flat `src/` — `SellerDashboard.jsx`, `SellerProducts.jsx`, `SellerOrders.jsx`, `SellerProfile.jsx`, `SellerLayout.jsx`, `SellerAuth.jsx`, `SellerStoreCategories.jsx`.
- `admin-frontend/` (internal panel): flat `src/` — `AdminStores.jsx` (approve/reject stores — the pending→approved gate), `AdminUsers.jsx`, `AdminMarketing.jsx`, `AdminSettings.jsx`, `AdminDirectory.jsx`, `AdminDashboard.jsx`, `AdminLayout.jsx`, `AdminAuth.jsx` (hardcoded `'master_token'`, no real auth — see `mem:core`).

Each app duplicates: `services/api.js` fetch wrappers, `cubaLocations.js`, `AddressInputWithAutocomplete`/`LocationPinPicker` — see `mem:conventions` for the required update-all-copies discipline.
