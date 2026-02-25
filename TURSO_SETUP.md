# Turso Migration Guide

## Step 1: Install Turso CLI

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Verify installation
turso --version
```

## Step 2: Create Turso Account & Database

```bash
# Login to Turso
turso auth login

# Create database with multi-region replication
# Primary: San Jose (closest to Hawaii)
turso db create the-hub --location sjc

# Add replicas for East Coast coverage
turso db replicate the-hub --location iad  # Virginia (East Coast)
turso db replicate the-hub --location ewr  # Newark (Northeast)

# Get database URL
turso db show the-hub --url
# Output: libsql://the-hub-[your-org].turso.io

# Create auth token
turso db tokens create the-hub
# Output: eyJhbGc... (save this token)
```

## Step 3: Update Environment Variables

Add to your `.env.local` file:

```env
TURSO_DATABASE_URL=libsql://the-hub-[your-org].turso.io
TURSO_AUTH_TOKEN=eyJhbGc...your-token-here
```

## Step 4: Run Migration Script

```bash
# Install dotenv for the migration script
npm install dotenv --save-dev

# Run the migration
npx tsx scripts/migrate-to-turso.ts
```

The script will:
1. Export schema from SQLite
2. Create tables in Turso
3. Migrate all data (batched for performance)
4. Verify data integrity (row counts must match)

## Step 5: Deploy to Railway

1. Go to Railway dashboard
2. Add environment variables:
   - `TURSO_DATABASE_URL` = your Turso URL
   - `TURSO_AUTH_TOKEN` = your Turso token
3. Deploy (Railway will auto-deploy on push)

## Step 6: Verify Production

After deployment:
1. Check Railway logs for "✅ Using Turso database"
2. Test login functionality
3. Test creating/completing tasks
4. Test messaging
5. Monitor Sentry for any errors

## Rollback Plan (if needed)

If issues occur:
1. Remove `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from Railway
2. Redeploy (will fall back to SQLite)
3. Investigate issues in Sentry

## Turso Dashboard

Access your database at: https://turso.tech/app

Features:
- View database metrics
- Run SQL queries
- Monitor performance
- Manage replicas
- Point-in-time recovery

## Benefits You'll Get

✅ **Automatic Backups** - 30-day point-in-time recovery  
✅ **High Availability** - Multi-region replication  
✅ **Better Performance** - Edge replication for low latency  
✅ **Scalability** - Horizontal scaling ready  
✅ **Database Branching** - Test migrations safely  

## Cost

Free tier includes:
- 9 GB total storage
- 1 billion row reads per month
- 25 million row writes per month
- 3 database locations

This should be sufficient for 50+ locations.
