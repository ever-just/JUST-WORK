-- JUST-WORK Data Import Script
-- Import cleaned CSV data into PostgreSQL database

-- First, create temporary tables to match CSV structure exactly
CREATE TEMP TABLE temp_companies (
    company_name TEXT,
    duns_number TEXT,
    tradestyle TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    phone TEXT,
    website TEXT,
    revenue_raw TEXT,
    revenue_numeric TEXT,
    revenue_formatted TEXT,
    employees_total TEXT,
    employees_single_site TEXT,
    business_description TEXT,
    industry TEXT,
    ownership_type TEXT,
    entity_type TEXT,
    is_headquarters TEXT,
    contact_count TEXT,
    primary_contact_name TEXT,
    primary_contact_title TEXT,
    primary_contact_email_flag TEXT,
    primary_contact_phone_flag TEXT
);

CREATE TEMP TABLE temp_contacts (
    company_name TEXT,
    duns_number TEXT,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    title TEXT,
    email_flag TEXT,
    phone_flag TEXT,
    is_primary TEXT,
    title_priority TEXT
);

-- Import CSV data (these commands would be run with actual file paths)
-- COPY temp_companies FROM '/path/to/CLEANED_companies.csv' DELIMITER ',' CSV HEADER;
-- COPY temp_contacts FROM '/path/to/CLEANED_contacts.csv' DELIMITER ',' CSV HEADER;

-- For now, we'll create the structure for when the files are available

-- Insert companies data with proper type conversion
INSERT INTO companies (
    duns_number,
    company_name,
    tradestyle,
    address_line_1,
    address_line_2,
    city,
    state,
    postal_code,
    phone,
    website,
    revenue_raw,
    revenue_numeric,
    revenue_formatted,
    employees_total,
    employees_single_site,
    business_description,
    industry,
    ownership_type,
    entity_type,
    is_headquarters,
    contact_count,
    primary_contact_name,
    primary_contact_title,
    primary_contact_email_flag,
    primary_contact_phone_flag
)
SELECT 
    duns_number,
    company_name,
    NULLIF(tradestyle, ''),
    NULLIF(address_line_1, ''),
    NULLIF(address_line_2, ''),
    city,
    state,
    postal_code,
    NULLIF(phone, ''),
    NULLIF(website, ''),
    revenue_raw,
    CASE 
        WHEN revenue_numeric ~ '^[0-9]+\.?[0-9]*$' THEN revenue_numeric::DECIMAL(15,2)
        ELSE NULL 
    END,
    NULLIF(revenue_formatted, ''),
    CASE 
        WHEN employees_total ~ '^[0-9]+$' THEN employees_total::INTEGER
        ELSE NULL 
    END,
    CASE 
        WHEN employees_single_site ~ '^[0-9]+$' THEN employees_single_site::INTEGER
        ELSE NULL 
    END,
    business_description,
    industry,
    ownership_type,
    entity_type,
    CASE 
        WHEN LOWER(is_headquarters) = 'true' THEN true
        WHEN LOWER(is_headquarters) = 'false' THEN false
        ELSE false
    END,
    CASE 
        WHEN contact_count ~ '^[0-9]+$' THEN contact_count::INTEGER
        ELSE 0 
    END,
    NULLIF(primary_contact_name, ''),
    NULLIF(primary_contact_title, ''),
    NULLIF(primary_contact_email_flag, ''),
    NULLIF(primary_contact_phone_flag, '')
FROM temp_companies
WHERE duns_number IS NOT NULL AND duns_number != '';

-- Insert contacts data with proper type conversion
INSERT INTO contacts (
    duns_number,
    first_name,
    last_name,
    full_name,
    title,
    email_flag,
    phone_flag,
    is_primary,
    title_priority
)
SELECT 
    duns_number,
    NULLIF(first_name, ''),
    NULLIF(last_name, ''),
    full_name,
    NULLIF(title, ''),
    NULLIF(email_flag, ''),
    NULLIF(phone_flag, ''),
    CASE 
        WHEN LOWER(is_primary) = 'true' THEN true
        WHEN LOWER(is_primary) = 'false' THEN false
        ELSE false
    END,
    CASE 
        WHEN title_priority ~ '^[0-9]+$' THEN title_priority::INTEGER
        ELSE 5 
    END
FROM temp_contacts
WHERE duns_number IS NOT NULL 
  AND duns_number != ''
  AND full_name IS NOT NULL 
  AND full_name != '';

-- Clean up temporary tables
DROP TABLE temp_companies;
DROP TABLE temp_contacts;

-- Update statistics for query optimization
ANALYZE companies;
ANALYZE contacts;

-- Verify import results
SELECT 
    'Companies imported' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN revenue_numeric IS NOT NULL THEN 1 END) as with_revenue,
    COUNT(CASE WHEN website IS NOT NULL THEN 1 END) as with_website,
    COUNT(CASE WHEN primary_contact_name IS NOT NULL THEN 1 END) as with_primary_contact
FROM companies

UNION ALL

SELECT 
    'Contacts imported' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN is_primary = true THEN 1 END) as primary_contacts,
    COUNT(CASE WHEN email_flag = 'Y' THEN 1 END) as with_email,
    COUNT(CASE WHEN phone_flag = 'Y' THEN 1 END) as with_phone
FROM contacts;

-- Sample queries to test the data
SELECT 'Sample Companies' as query_type, company_name, city, revenue_formatted, industry
FROM companies 
WHERE revenue_numeric IS NOT NULL 
ORDER BY revenue_numeric DESC 
LIMIT 5;

SELECT 'Sample Contacts' as query_type, full_name, title, is_primary, title_priority
FROM contacts c
JOIN companies co ON c.duns_number = co.duns_number
WHERE c.is_primary = true
ORDER BY c.title_priority
LIMIT 5;
