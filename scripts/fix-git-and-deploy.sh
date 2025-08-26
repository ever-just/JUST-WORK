#!/bin/bash

echo "🔧 Fixing Git History and Deploying to Production"
echo "================================================"

# Step 1: Create a backup branch just in case
echo "📌 Creating backup branch..."
git branch backup-before-fix

# Step 2: Reset to origin/main to start fresh
echo "🔄 Resetting to origin/main..."
git reset --hard origin/main

# Step 3: Apply all the changes we made (without the password)
echo "📝 Re-applying all changes..."

# Add all modified files
git add src/App.tsx \
        src/App.css \
        src/components/CompanyCard.tsx \
        src/components/CompanyGrid.tsx \
        src/components/CompanyDetail.tsx \
        src/components/CompanyDetail.css \
        src/lib/types.ts \
        server/index.js \
        scripts/favicon-bulk-processor.js \
        scripts/add-favicon-columns.sql

# Commit all changes in one clean commit
git commit -m "Add company logos/favicons feature with improved layout

- Added favicon_url column to database and populated for 5000+ companies
- Updated Company interface to include favicon_url
- Display logos on home page (top-right of cards) and detail pages (next to name)
- Improved layout: centered logo/name, removed badges, better spacing
- Fixed infinite scroll to work properly with 200 items per page
- Made all company cards same height with consistent spacing
- Added proper fallback when logos fail to load"

# Step 4: Push to origin
echo "🚀 Pushing to GitHub..."
git push origin main --force-with-lease

# Step 5: Deploy to production
echo "🌐 Deploying to production server..."
./scripts/deploy-to-server.sh

echo "✅ Done! Your changes should now be live on just-work.app"
