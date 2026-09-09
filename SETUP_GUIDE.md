# OpenLPM - Setup Guide

This guide will walk you through setting up OpenLPM from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Supabase Configuration](#supabase-configuration)
4. [Running the Application](#running-the-application)
5. [Development Workflow](#development-workflow)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn** (optional)
- **Git** - [Download here](https://git-scm.com/)
- A code editor (VS Code recommended)

Verify your installations:

```bash
node --version  # Should be v18 or higher
npm --version   # Should be v9 or higher
git --version
```

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd openlpm
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Vite + React 18
- React Router (client-side routing)
- Supabase client (`@supabase/supabase-js`, used directly from the browser)
- Cytoscape.js (portfolio graph explorer)
- TypeScript

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp env.example .env.local
```

You'll fill in the values in the next section after setting up Supabase.

## Supabase Configuration

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in the project details:
   - **Name**: `openlpm` (or your working group's name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose a region close to your users
5. Wait for the project to be created (2-3 minutes)

### 2. Get Your Credentials

1. Go to **Project Settings** > **API**
2. Copy the following values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

3. Update your `.env.local` file:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> The `VITE_` prefix (not `NEXT_PUBLIC_`) is what Vite exposes to browser code — see
> [vitejs.dev/guide/env-and-mode](https://vitejs.dev/guide/env-and-mode). Both are equally public;
> there's no server-only secret layer here, since there's no server (see the architecture note
> under Running the Application below).

### 3. Run Database Migrations

1. Go to the **SQL Editor** in your Supabase dashboard
2. Run each migration file, in order, as its own query:
   - `supabase/migrations/001_initial_schema.sql` — tables, indexes, base RLS policies
   - `supabase/migrations/002_require_auth_for_reads.sql` — tightens RLS so reads require a signed-in session, not just writes (this is what makes the app actually private at the data layer, not just in the UI)
   - `supabase/migrations/003_sync_auth_users.sql` — auto-creates a `public.users` row on first OAuth sign-in

### 4. Configure OAuth Providers

#### GitHub OAuth

1. Go to **Authentication** > **Providers** > **GitHub**
2. Click "Enable GitHub"
3. You'll need to create a GitHub OAuth app:
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - Click "New OAuth App"
   - **Application name**: `OpenLPM` (or your working group's name)
   - **Homepage URL**: `http://localhost:5173` (development) or your production URL (e.g. your
     GitHub Pages URL)
   - **Authorization callback URL**: `https://your-project-id.supabase.co/auth/v1/callback`
     (this one is always Supabase's own callback, provider → Supabase — it doesn't change with
     where the frontend is hosted; see Redirect URLs below for the Supabase → app leg)
4. Copy the **Client ID** and **Client Secret** from GitHub
5. Paste them into the Supabase GitHub provider settings

#### Google OAuth

1. Go to **Authentication** > **Providers** > **Google**
2. Click "Enable Google"
3. Follow the Google Cloud Console setup:
   - Create a new project or use existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://your-project-id.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client Secret**
5. Paste them into the Supabase Google provider settings

> **Note on ORCID:** ORCID is not one of Supabase's built-in OAuth providers (the supported list is GitHub, Google, GitLab, Azure, Discord, Facebook, LinkedIn, Slack, and a handful of others — no ORCID). The login page only wires up GitHub and Google for now. If ORCID sign-in matters for your working group, the realistic paths are (a) a custom OIDC provider on Supabase's paid Team/Enterprise plan, if ORCID's OIDC surface qualifies, or (b) building a small separate OAuth bridge service — both are follow-up work, not something to bolt on silently.

#### Redirect URLs (required)

There's no `/auth/callback` route anymore — the app is a static single-page app with no server,
so it handles the OAuth return at its own root URL directly (see `src/pages/login-page.tsx`'s
`redirectTo` and `src/state/session.tsx`).

1. Go to **Authentication** > **URL Configuration**
2. Add these to **Redirect URLs**:
   - `http://localhost:5173` (development)
   - `https://your-org.github.io/openlpm/` (production — your GitHub Pages URL; see Deployment below)
3. Set **Site URL** to your production (GitHub Pages) URL

`supabase/config.toml`'s own `[auth]` section documents the same two values for local reference,
but editing that file does **not** push the change to your hosted project — the dashboard step
above is what actually matters.

Without this, Supabase will reject the redirect back to the app after a successful provider login.

### 5. Set Your Own Role to Admin

New OAuth sign-ins default to the `contributor` role (via the trigger in migration 003). After you sign in once through the app:

1. Go to **Table Editor** > `users` in the Supabase dashboard
2. Find your row and change `role` to `admin`

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will be available at [http://localhost:5173](http://localhost:5173)

### Production Build

```bash
npm run build     # outputs a fully static bundle to dist/
npm run preview   # serve that bundle locally to sanity-check it before deploying
```

> **Architecture note:** OpenLPM is a pure client-side single-page app (Vite + React + React
> Router's `HashRouter`) — no server, no middleware, no server actions. Every read and write goes
> straight from the browser to Supabase via `supabase-js`, and **Row-Level Security
> (`supabase/migrations/*`) is the actual access-control boundary**, not anything in the app code.
> This is a deliberate architectural match to `eva-graph/apps/kgdj` (Eva KGDJ), OpenEvo's other
> Supabase + Cytoscape app, and it's what makes `npm run build`'s output deployable straight to
> GitHub Pages (see Deployment below) — there's no Node-capable host to provision.

## Development Workflow

### Project Structure

```
openlpm/
├── index.html               # Vite entry point
├── src/
│   ├── main.tsx             # App bootstrap (HashRouter)
│   ├── App.tsx               # Route tree
│   ├── state/session.tsx     # Client-side Supabase auth context
│   ├── pages/                # Route components
│   │   ├── home-page.tsx
│   │   ├── login-page.tsx
│   │   └── dashboard/         # Project-switcher, per-project layout + tabs
│   ├── components/            # Shared UI components (chip, portfolio-explorer, ...)
│   ├── lib/
│   │   ├── supabase/          # Browser Supabase client + typed queries
│   │   └── api/                # External API integrations (OpenAlex, Crossref, ...)
│   ├── data/frameworks/       # Staged standards/framework JSON (RFC 0003 preview)
│   ├── globals.css            # Hand-rolled UI styles
│   └── openevo-design-tokens.css  # Vendored shared design tokens
├── ethics/                    # AI Ethics Framework
├── docs/                      # Design notes
├── proposals/                 # RFCs
├── .github/workflows/deploy.yml  # Builds + deploys dist/ to GitHub Pages on push to main
└── supabase/                  # Supabase migrations and functions
```

### Adding New Features

1. **Create a new page**: Add a new file in `src/pages/dashboard/` and wire it into the route
   tree in `src/App.tsx`
2. **Create a component**: Add a new file in `src/components/`
3. **Add API integration**: Add functions in `src/lib/api/`
4. **Update database**: Create a new migration in `supabase/migrations/`

Data access and mutations happen directly in the page/component that needs them via
`createClient()` from `src/lib/supabase/client.ts` — there's no server-action layer to route
through; see `src/pages/dashboard/branches-page.tsx` for the pattern (fetch on mount, mutate via
an `onSubmit` handler, re-fetch or optimistically update, RLS enforces who can actually do what).

### Code Style

- Use TypeScript for type safety
- Follow the existing component structure
- Use the hand-rolled classes in `src/globals.css` (no Tailwind/shadcn — deliberately dropped in
  favor of a shared vocabulary with Eva KGDJ's own `styles.css`)
- Keep components small and focused
- Write clear comments for complex logic

### Testing

```bash
# Type-check
npm run type-check

# Build to check for errors
npm run build
```

## Troubleshooting

### Common Issues

#### 1. Supabase Connection Error

**Problem**: Cannot connect to Supabase

**Solution**:
- Check that `.env.local` exists and has correct values
- Verify your Supabase project is active
- Check that you're using the correct region URL

#### 2. OAuth Login Fails

**Problem**: OAuth providers don't work

**Solution**:
- Verify OAuth providers are enabled in Supabase
- Check that callback URLs match exactly
- Ensure Client ID and Secret are correct
- Check browser console for specific error messages

#### 3. Build Errors

**Problem**: `npm run build` fails

**Solution**:
- Clear the build output: `rm -rf dist`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript errors in your IDE, or run `npm run type-check`

#### 4. Database Issues

**Problem**: Database queries fail

**Solution**:
- Verify migrations ran successfully
- Check RLS policies in Supabase dashboard
- Review Supabase logs for specific errors

### Getting Help

1. Check the [README.md](README.md) for general information
2. Review [`proposals/0001-founding-and-migration-plan.md`](proposals/0001-founding-and-migration-plan.md) for background and roadmap
3. Check Supabase documentation: https://supabase.com/docs
4. Check Vite documentation: https://vitejs.dev/guide/

## Next Steps

Once you have the platform running:

1. **Test authentication**: Try logging in with different OAuth providers
2. **Add literature**: Search for and add some papers
3. **Create schema elements**: Define some concepts and competencies
4. **Start discussions**: Create discussion topics
5. **Invite team members**: Share the platform with your working group

## Deployment

OpenLPM is a static bundle (see the architecture note above) — it deploys straight to **GitHub
Pages**, the same pattern `eva-graph/apps/kgdj` (Eva KGDJ) uses, at essentially no cost and no
server to operate. This does require the repo to be **public**: GitHub Pages isn't available on
a private repo unless the org pays for GitHub Team. There's nothing in the repo that needs to
stay private — no secrets are committed (`.env.local` is gitignored), and Supabase RLS is what
actually protects user data, not the app bundle's visibility.

### GitHub Pages (the default path)

1. **Repo secrets** — in the repo's Settings → Secrets and variables → Actions, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. **Enable Pages** — Settings → Pages → Build and deployment → Source: **GitHub Actions**
   (`.github/workflows/deploy.yml` already builds and deploys `dist/` on every push to `main`)
3. **Register the URL with Supabase** — add `https://<your-org>.github.io/openlpm/` to
   Authentication → URL Configuration's Redirect URLs, and set it as the Site URL (see the
   Redirect URLs section above)
4. Push to `main` (or run the workflow manually via `workflow_dispatch`) — the Actions tab shows
   the build/deploy run, and the live URL appears there and under Settings → Pages once it
   finishes

If you fork/self-host this under a different org or repo name, the workflow's
`OPENLPM_BASE: /openlpm/` env var and `vite.config.ts`'s `base` need to match your repo name
(GitHub Pages serves project sites from `/<repo-name>/`, not the domain root).

### Alternatives (Vercel / Netlify)

Nothing about the Vite build is Pages-specific — `npm run build`'s `dist/` output is a plain
static site, so it deploys the same way to Vercel's or Netlify's static-site presets if you'd
rather keep the repo private (both support importing a private GitHub repo on their free tiers)
or want a custom domain without a `/openlpm/` subpath. Set the same two `VITE_*` environment
variables, and register that host's URL with Supabase the same way as step 3 above.

## Security Considerations

- Never commit `.env.local` to version control
- Use strong passwords for Supabase
- Enable RLS policies on all tables
- Regularly update dependencies
- Review and audit user permissions

## Performance Optimization

- Implement pagination for large lists
- Cache API responses where appropriate
- Optimize database queries with indexes
- Use Supabase Edge Functions for complex logic

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

- **Content**: [CC BY-NC-SA 4.0](LICENSE)
- **Code**: [MIT](LICENSE-CODE)

---

For questions, open a [GitHub issue](../../issues) or see the "Get involved" section of [README.md](README.md).
