# Suggested Commands

All commands run from inside the relevant app dir — there is no root install/build/lint script.

Frontends (`frontend/`, `seller-frontend/`, `admin-frontend/` — identical scripts):
```
npm install
npm run dev       # vite dev server
npm run build     # vite build -> dist/
npm run lint       # oxlint
npm run preview    # preview production build
```

Backend:
```
cd backend
npm install
npm run dev   # nodemon src/index.js, PORT from .env (default 5001 locally)
npm start      # node src/index.js
```
`npm test` in backend is a stub — do not rely on it.

Backend one-off maintenance/migration scripts (top-level of `backend/`, e.g. `seed*.js`, `generate_*.js`, `check_*.js`, `test_db*.js`, `add_*.js`) are run ad hoc with `node <script>.js`. They are NOT part of the app/CI and are not reusable modules — don't import from them or wire them into the server.

Darwin note: standard GNU vs BSD differences apply to `sed`/`grep -P` etc. as usual; nothing project-specific observed beyond that.
