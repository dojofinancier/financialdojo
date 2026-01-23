# Netlify Deployment Checklist

This checklist helps ensure a smooth deployment to Netlify.

## ✅ Pre-Deployment Checks

### 1. Build Configuration
- [x] `netlify.toml` build command uses correct script name (`db:generate` not `prisma:generate`)
- [x] Node.js version specified (24)
- [x] Next.js plugin configured (`@netlify/plugin-nextjs`)

### 2. Environment Variables
Ensure all required environment variables are set in Netlify:

**Database:**
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `DIRECT_URL` - Direct database connection (for migrations)

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key
- `SUPABASE_SECRET_KEY` - Supabase secret key (server-side only)

**Stripe:**
- `STRIPE_SECRET_KEY` - Stripe secret key (starts with `sk_`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (starts with `pk_`)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (starts with `whsec_`)

**App:**
- `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., `https://your-site.netlify.app`)
- `NEXT_PUBLIC_SITE_URL` - Alternative site URL variable

### 3. Database Setup
- [ ] Run migrations on production database
- [ ] Verify Prisma client generation works (`npm run db:generate`)
- [ ] Check RLS policies are applied (`prisma/rls-policies.sql`)

### 4. Code Quality
- [ ] Run `npm run lint` - no errors
- [ ] Run `npm run build` locally - successful build
- [ ] Check for TypeScript errors
- [ ] Verify all imports are correct
- [ ] Check for missing dependencies

### 5. File Structure
- [x] Documentation files moved to `docs/` folder
- [x] `.gitignore` updated to exclude development artifacts
- [x] README.md created with project documentation

## 🚨 Common Build Errors & Solutions

### Error: "Command 'prisma:generate' not found"
**Solution:** Fixed in `netlify.toml` - now uses `db:generate`

### Error: "Prisma Client not generated"
**Solution:** Ensure `npm run db:generate` runs before build in Netlify

### Error: "Missing environment variables"
**Solution:** Add all required variables in Netlify dashboard → Site settings → Environment variables

### Error: "Module not found" or import errors
**Solution:** 
- Check all imports use correct paths
- Verify `@/*` path alias is working
- Ensure all dependencies are in `package.json`

### Error: "Type errors"
**Solution:**
- Run `npm run lint` locally
- Check TypeScript strict mode settings
- Verify all types are properly defined

### Error: "Database connection failed"
**Solution:**
- Verify `DATABASE_URL` and `DIRECT_URL` are correct
- Check Supabase connection pooling settings
- Ensure database is accessible from Netlify's IP ranges

## 📋 Post-Deployment Verification

After deployment, verify:

1. **Homepage loads** - Check main route (`/`)
2. **Authentication works** - Test login/logout
3. **Database queries** - Verify data loads correctly
4. **Payments** - Test Stripe integration (use test mode)
5. **Webhooks** - Verify Stripe webhooks are configured
6. **Admin panel** - Test admin routes
7. **Student dashboard** - Test student routes
8. **API routes** - Test API endpoints

## 🔧 Netlify-Specific Configuration

### Build Settings
- **Build command:** `npm run db:generate && npm run build`
- **Publish directory:** Automatically handled by Next.js plugin
- **Node version:** 24 (set in `netlify.toml`)

### Redirects
Next.js App Router handles routing automatically. No manual redirects needed unless you have specific requirements.

### Functions
API routes in `app/api/` are automatically converted to Netlify Functions by the Next.js plugin.

## 📝 Notes

- The `.cursor/` and `chats/` folders are gitignored and won't be deployed
- Development scripts in `scripts/` are not needed for production
- Ensure `node_modules` is not committed (already in `.gitignore`)

## 🆘 Troubleshooting

If deployment fails:

1. Check Netlify build logs for specific errors
2. Compare local build with Netlify build
3. Verify all environment variables are set
4. Check Node.js version compatibility
5. Review recent code changes that might affect build

For more help, see the main [README.md](../README.md).
