-- FAVICON COLUMNS MIGRATION
-- Add favicon support to companies table

-- Add favicon columns if they don't exist
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS favicon_url TEXT,
ADD COLUMN IF NOT EXISTS favicon_last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_favicon_url 
ON companies(favicon_url) WHERE favicon_url IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_website_not_null 
ON companies(website) WHERE website IS NOT NULL AND website != '';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_favicon_needed
ON companies(id) WHERE website IS NOT NULL AND website != '' AND (favicon_url IS NULL OR favicon_url = '');

-- Add comments for documentation
COMMENT ON COLUMN companies.favicon_url IS 'Google Favicon API URL for company logo';
COMMENT ON COLUMN companies.favicon_last_updated IS 'Timestamp when favicon was last updated';

-- Show statistics
SELECT 
  COUNT(*) as total_companies,
  COUNT(CASE WHEN website IS NOT NULL AND website != '' THEN 1 END) as companies_with_websites,
  COUNT(CASE WHEN favicon_url IS NOT NULL AND favicon_url != '' THEN 1 END) as companies_with_favicons,
  COUNT(CASE WHEN website IS NOT NULL AND website != '' AND (favicon_url IS NULL OR favicon_url = '') THEN 1 END) as companies_needing_favicons
FROM companies;

-- Sample query to test favicon URLs
SELECT 
  id, 
  company_name, 
  website,
  favicon_url,
  favicon_last_updated
FROM companies 
WHERE website IS NOT NULL 
AND website != '' 
LIMIT 5;
