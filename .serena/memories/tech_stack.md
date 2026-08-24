# Tech Stack

- Backend: Node.js, plain Express (no Nest/Fastify), Supabase JS client, multer (memory storage) for uploads, nodemon for dev. No ORM (no Prisma/Knex/Sequelize) — raw SQL / Supabase client calls.
- Frontends (frontend/, seller-frontend/, admin-frontend/): Vite + React 19 + react-router-dom v7. Plain CSS per component (one .css alongside each .jsx) — no CSS-in-JS, no Tailwind. lucide-react for icons. oxlint for linting (react-hooks rules enforced) — NOT eslint.
- Data layer: Supabase (Postgres + Auth + Storage). Backend uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) — backend code is trusted to self-enforce authorization.
- Package manager: npm (package-lock.json per app).
- Deployment: Vercel, each app its own project; per-app `vercel.json` for SPA rewrites.
