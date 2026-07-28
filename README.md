# GigFrog - Application repo

Find you next gig faster.

## Local Development (Next.js)

1) Install dependencies
```
yarn
```

2) Configure environment variables
Create `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_API_URL=/api
```

3) Create Supabase tables
Run the SQL in `supabase/schema.sql` in your Supabase project.

4) Start the dev server
```
yarn dev
```
