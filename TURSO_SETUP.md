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

## Step 4: Download Railway Database

**IMPORTANT:** The migration script needs to migrate from your Railway production database, not your local database.

```bash
# Install Railway CLI if you haven't already
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Download the production database from Railway
railway run --service the-hub "cat /data/hub.db" > railway-hub.db

# Verify the download
ls -lh railway-hub.db
```

This will download your production SQLite database to a file called `railway-hub.db` in your current directory.

## Step 5: Run Migration Script

```bash
# Run the migration with the Railway database
npx tsx scripts/migrate-to-turso.ts railway-hub.db
```

The script will:
1. Export schema from Railway SQLite database
2. Create tables in Turso
3. Migrate all data (batched for performance, 1000 rows at a time)
4. Verify data integrity (row counts must match)

**Expected output:**
```
📍 Database source: railway-hub.db
🎯 Turso destination: libsql://the-hub-[your-org].turso.io

🚀 Starting migration from SQLite to Turso...

📋 Step 1: Exporting schema from SQLite...
🏗️  Step 2: Creating tables in Turso...
  ✅ Created table: locations
  ✅ Created table: arls
  ✅ Created table: tasks
  ... (more tables)

📑 Step 3: Creating indexes...
  ✅ Created index: idx_tasks_location_id
  ... (more indexes)

📦 Step 4: Migrating data...
  ✅ locations: 10 rows migrated
  ✅ arls: 5 rows migrated
  ✅ tasks: 150 rows migrated
  ... (more tables)

🔍 Step 5: Verifying data integrity...
  ✅ locations: 10 rows (match)
  ✅ arls: 5 rows (match)
  ✅ tasks: 150 rows (match)
  ... (more tables)

============================================================
✅ Migration completed successfully!
📊 Total rows migrated: 1,234
🎉 All data verified - counts match between SQLite and Turso
```

If any row counts don't match, the script will show an error and you should NOT proceed to deployment.

## Step 6: Deploy to Railway

1. Go to Railway dashboard
2. Add environment variables:
   - `TURSO_DATABASE_URL` = your Turso URL
   - `TURSO_AUTH_TOKEN` = your Turso token
3. Deploy (Railway will auto-deploy on push)

## Step 7: Verify Production

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
