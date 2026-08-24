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
- Next.js 14+
- React 18+
- Supabase client
- shadcn/ui components
- Tailwind CSS
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
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Update your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

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
   - **Homepage URL**: `http://localhost:3000` (development) or your production URL
   - **Authorization callback URL**: `https://your-project-id.supabase.co/auth/v1/callback`
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

1. Go to **Authentication** > **URL Configuration**
2. Add these to **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (development)
   - `https://your-production-domain/auth/callback` (production — add this once you know your Vercel/Netlify URL)
3. Set **Site URL** to your production domain

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

The application will be available at [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm run start
```

> **Note:** static export (`next export` / `output: 'export'`) is no longer used. OAuth route
> protection runs in Next.js middleware and server route handlers (`middleware.ts`,
> `app/auth/callback/route.ts`, `app/auth/signout/route.ts`), which require a Node-capable
> host — see Deployment below. This also means the site can no longer be pushed to plain
> GitHub Pages, which only serves static files.

## Development Workflow

### Project Structure

```
openlpm/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   └── ui/                # shadcn/ui components
├── lib/                    # Utility functions
│   ├── supabase/          # Supabase client
│   ├── api/               # External API integrations
│   └── utils.ts           # General utilities
├── ethics/                 # AI Ethics Framework
├── docs/                   # Design notes
├── proposals/              # RFCs
└── supabase/               # Supabase migrations and functions
```

### Adding New Features

1. **Create a new page**: Add a new file in `app/dashboard/`
2. **Create a component**: Add a new file in `components/`
3. **Add API integration**: Add functions in `lib/api/`
4. **Update database**: Create a new migration in `supabase/migrations/`

### Code Style

- Use TypeScript for type safety
- Follow the existing component structure
- Use Tailwind CSS for styling
- Keep components small and focused
- Write clear comments for complex logic

### Testing

```bash
# Run linter
npm run lint

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
- Clear Next.js cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript errors in your IDE

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
4. Check Next.js documentation: https://nextjs.org/docs

## Next Steps

Once you have the platform running:

1. **Test authentication**: Try logging in with different OAuth providers
2. **Add literature**: Search for and add some papers
3. **Create schema elements**: Define some concepts and competencies
4. **Start discussions**: Create discussion topics
5. **Invite team members**: Share the platform with your working group

## Deployment

The app needs a Node-capable host to run its middleware and auth route handlers — plain
static hosting (GitHub Pages, S3, etc.) won't work anymore. Vercel and Netlify both have
free tiers that support this and both can import a **private** GitHub repository directly,
so there's no need to make the repo public to deploy it.

### Vercel (recommended, free Hobby tier)

1. Go to [vercel.com](https://vercel.com), sign in with GitHub, and grant it access to the
   (private) `openlpm` repo specifically — no need to make it public or org-wide
2. Import the repo as a new project (Vercel auto-detects Next.js)
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables
4. Deploy — Vercel gives you a `*.vercel.app` URL
5. Add that URL's `/auth/callback` path to Supabase's Redirect URLs (see step 4 above), and
   set it as the Site URL
6. Re-deploy (or just push again) once the redirect URL is registered

### Netlify (alternative, also free)

Same flow via [netlify.com](https://netlify.com) with its official Next.js runtime — connect
the private repo, set the same two environment variables, deploy, then register the Netlify
URL's `/auth/callback` with Supabase the same way.

## Security Considerations

- Never commit `.env.local` to version control
- Use strong passwords for Supabase
- Enable RLS policies on all tables
- Regularly update dependencies
- Review and audit user permissions

## Performance Optimization

- Use Next.js Image component for images
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
