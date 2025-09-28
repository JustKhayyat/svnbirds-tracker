# svnbirds-tracker

## Production DB config

This project connects to Supabase through the transaction pooler. Set the following environment variable in **Preview** and **Production** Vercel environments (no quotes or trailing spaces):

```
DATABASE_URL=postgresql://postgres.bvywkbqhmtsgeevwzbba:<YOUR_DATABASE_PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1
```

Key requirements:

- The database **user must include the project ref** `postgres.bvywkbqhmtsgeevwzbba`.
- The host must be the Supabase pooler domain and the port must be `6543`.
- Keep the `pgbouncer=true` and `connection_limit=1` query params intact.

Use the Vercel CLI to manage the variable:

```bash
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env pull .env.vercel.prod --environment=production --yes
```

After pulling, confirm the value matches the shape above (password masked) and run the helper script:

```bash
node scripts/print-db-env.mjs
```

The script exits non-zero if the pooled credentials are misconfigured, helping catch tenant/user issues before deployment.
