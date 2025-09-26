# Supabase Storage Upload Troubleshooting Checklist

1. **Validate Environment Variables**
   - `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_BUCKET` (defaults to `royalty`)
   - `ADMIN_API_TOKEN`
   - `DATABASE_URL` for Prisma

2. **Verify Prisma client**
   - Run `npm install`
   - Run `npx prisma generate`
   - Ensure build step runs `npm run postinstall` on deployment platform.

3. **API Smoke Tests**
   - `npm run test` (runs `node --test` suite for API handlers)
   - `curl` or PowerShell requests:
     - `GET /api/test-supabase`
     - `POST /api/royalties/upload-url` with `x-admin-token`
     - `POST /api/royalties/import` for JSON or multipart flow

4. **Supabase Direct Checks**
   - Use Supabase dashboard to confirm bucket exists.
   - If signed URL returns relative path, confirm project URL is correct.

5. **Deployment Notes**
   - Ensure Vercel builds run `npm install` to trigger Prisma generate.
   - For protected deployments, include `x-vercel-protection-bypass` header.
