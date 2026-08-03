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
2. Click "New Query"
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the SQL Editor
5. Click "Run" (or press Ctrl+Enter)

This will create all necessary tables, indexes, and RLS policies.

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

#### ORCID OAuth

1. Go to **Authentication** > **Providers** > **ORCID**
2. Click "Enable ORCID"
3. You'll need an ORCID developer account:
   - Go to [orcid.org](https://orcid.org)
   - Register as a developer
   - Create a new application
   - Set redirect URI: `https://your-project-id.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client Secret**
5. Paste them into the Supabase ORCID provider settings

### 5. Create Your First User

1. Go to **Authentication** > **Users**
2. Click "Add user" > "Create new user"
3. Enter email and password
4. Set role to `admin` (you can change this in the database)
5. Click "Create user"

Alternatively, you can sign up through the app once it's running.

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

### Static Export (for GitHub Pages)

```bash
npm run export
```

This creates an `out` directory with static files that can be deployed to GitHub Pages.

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

### GitHub Pages

1. Build the project: `npm run export`
2. Push the `out` directory to GitHub
3. Enable GitHub Pages in repository settings
4. Configure GitHub Pages to use the `out` directory
5. Add environment variables to GitHub repository settings

### Vercel

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

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
