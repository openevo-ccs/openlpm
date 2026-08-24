# Quick Start Guide

Get OpenLPM up and running in 10 minutes.

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for it to be ready (2-3 minutes)
3. Go to Project Settings > API
4. Copy your Project URL and anon key

## Step 3: Configure Environment

```bash
cp env.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Step 4: Set Up Database

1. Go to SQL Editor in Supabase dashboard
2. Run each file in `supabase/migrations/` in order (001, 002, 003) as its own query

## Step 5: Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## What's Next?

- Configure OAuth providers (GitHub, Google — see SETUP_GUIDE.md for why ORCID isn't included yet) in Supabase, and add your Redirect URLs
- Sign in once, then promote your own `users` row to `admin` in the Supabase Table Editor
- Start adding literature references
- Create schema elements
- Invite your team members

## Need Help?

- See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions
- See [README.md](README.md) for project overview
- Check Supabase docs: https://supabase.com/docs

## Common Issues

**"Cannot connect to Supabase"**
- Check your `.env.local` file exists and has correct values
- Verify your Supabase project is active

**"Build fails"**
- Run `rm -rf .next node_modules && npm install`
- Try `npm run dev` again

**"OAuth doesn't work"**
- Enable OAuth providers in Supabase dashboard
- Check callback URLs match exactly

Happy building!
