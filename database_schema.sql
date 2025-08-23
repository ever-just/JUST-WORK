-- JUST-WORK Database Schema
-- Optimized for search configurator and company discovery
-- Based on CLEANED_companies.csv and CLEANED_contacts.csv structure

-- Enable UUID extension for better primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table - main entity for business directory
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    duns_number VARCHAR(20) UNIQUE NOT NULL, -- D-U-N-S number as business identifier
    company_name VARCHAR(255) NOT NULL,
    tradestyle VARCHAR(255),
    
    -- Address information
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    
    -- Contact information
    phone VARCHAR(50),
    website VARCHAR(500),
    
    -- Financial data (multiple formats for different use cases)
    revenue_raw VARCHAR(50), -- Original scientific notation
    revenue_numeric DECIMAL(15,2), -- For calculations and filtering
    revenue_formatted VARCHAR(20), -- Human-readable display ($45.7M)
    
    -- Employee information
    employees_total INTEGER,
    employees_single_site INTEGER,
    
    -- Business classification
    business_description TEXT,
    industry VARCHAR(255),
    ownership_type VARCHAR(50),
    entity_type VARCHAR(50),
    is_headquarters BOOLEAN DEFAULT false,
    
    -- Contact summary (from primary contact)
    contact_count INTEGER DEFAULT 0,
    primary_contact_name VARCHAR(255),
    primary_contact_title VARCHAR(255),
    primary_contact_email_flag CHAR(1), -- Y/N flag
    primary_contact_phone_flag CHAR(1), -- Y/N flag
    
    -- Search optimization
    search_vector tsvector, -- Full-text search index
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Contacts table - individual contacts associated with companies
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    duns_number VARCHAR(20) NOT NULL REFERENCES companies(duns_number) ON DELETE CASCADE,
    
    -- Name information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    
    -- Contact flags
    email_flag CHAR(1), -- Y/N flag for email availability
    phone_flag CHAR(1), -- Y/N flag for phone availability
    is_primary BOOLEAN DEFAULT false,
    title_priority INTEGER, -- 1=CEO/President, 5=Other
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User management for CRM features
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User saved companies (bookmarks)
CREATE TABLE user_saved_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_id)
);

-- User notes on companies
CREATE TABLE user_company_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User tasks related to companies
CREATE TABLE user_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    due_date DATE,
    is_completed BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User interaction history (for analytics and CRM)
CREATE TABLE user_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL, -- view, search, external_link, note, task
    interaction_data JSONB, -- Flexible data storage for different interaction types
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Saved searches for users
CREATE TABLE user_saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_name VARCHAR(255) NOT NULL,
    search_criteria JSONB NOT NULL, -- Store search parameters as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES for optimal search performance

-- Primary search indexes
CREATE INDEX idx_companies_search_vector ON companies USING gin(search_vector);
CREATE INDEX idx_companies_company_name ON companies USING gin(company_name gin_trgm_ops);
CREATE INDEX idx_companies_industry ON companies(industry);
CREATE INDEX idx_companies_city ON companies(city);
CREATE INDEX idx_companies_state ON companies(state);

-- Revenue filtering indexes
CREATE INDEX idx_companies_revenue_numeric ON companies(revenue_numeric) WHERE revenue_numeric IS NOT NULL;
CREATE INDEX idx_companies_employees_total ON companies(employees_total) WHERE employees_total IS NOT NULL;

-- Contact indexes
CREATE INDEX idx_contacts_duns_number ON contacts(duns_number);
CREATE INDEX idx_contacts_is_primary ON contacts(is_primary) WHERE is_primary = true;
CREATE INDEX idx_contacts_title_priority ON contacts(title_priority);

-- User feature indexes
CREATE INDEX idx_user_saved_companies_user_id ON user_saved_companies(user_id);
CREATE INDEX idx_user_company_notes_user_company ON user_company_notes(user_id, company_id);
CREATE INDEX idx_user_tasks_user_id ON user_tasks(user_id);
CREATE INDEX idx_user_tasks_due_date ON user_tasks(due_date) WHERE is_completed = false;
CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_company_id ON user_interactions(company_id);

-- TRIGGERS for maintaining data integrity and search optimization

-- Update search vector when company data changes
CREATE OR REPLACE FUNCTION update_company_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.company_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.tradestyle, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.business_description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.industry, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.primary_contact_name, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_search_vector 
    BEFORE INSERT OR UPDATE ON companies 
    FOR EACH ROW EXECUTE FUNCTION update_company_search_vector();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_companies_updated_at 
    BEFORE UPDATE ON companies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_contacts_updated_at 
    BEFORE UPDATE ON contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_company_notes_updated_at 
    BEFORE UPDATE ON user_company_notes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_tasks_updated_at 
    BEFORE UPDATE ON user_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- VIEWS for common queries

-- View for companies with primary contact information
CREATE VIEW companies_with_primary_contact AS
SELECT 
    c.*,
    ct.full_name as primary_contact_full_name,
    ct.title as primary_contact_title_full,
    ct.email_flag as primary_contact_email_available,
    ct.phone_flag as primary_contact_phone_available
FROM companies c
LEFT JOIN contacts ct ON c.duns_number = ct.duns_number AND ct.is_primary = true;

-- View for search results with relevance scoring
CREATE VIEW company_search_results AS
SELECT 
    c.*,
    ts_rank(c.search_vector, plainto_tsquery('english', '')) as relevance_score
FROM companies c;

-- SAMPLE QUERIES for the search configurator

-- Example: Search by company name
-- SELECT * FROM companies WHERE search_vector @@ plainto_tsquery('english', 'International Packaging');

-- Example: Filter by revenue range
-- SELECT * FROM companies WHERE revenue_numeric BETWEEN 1000000 AND 50000000;

-- Example: Filter by industry and location
-- SELECT * FROM companies WHERE industry ILIKE '%Electric%' AND city = 'Minneapolis';

-- Example: Get companies with contact information
-- SELECT * FROM companies_with_primary_contact WHERE primary_contact_email_available = 'Y';

-- COMMENTS
COMMENT ON TABLE companies IS 'Main companies directory with search optimization';
COMMENT ON TABLE contacts IS 'Individual contacts associated with companies';
COMMENT ON TABLE users IS 'User accounts for CRM features';
COMMENT ON TABLE user_saved_companies IS 'User bookmarked companies';
COMMENT ON TABLE user_company_notes IS 'User notes on companies';
COMMENT ON TABLE user_tasks IS 'User tasks related to companies and contacts';
COMMENT ON TABLE user_interactions IS 'User interaction history for analytics';
COMMENT ON TABLE user_saved_searches IS 'User saved search configurations';

COMMENT ON COLUMN companies.search_vector IS 'Full-text search index for company search';
COMMENT ON COLUMN companies.revenue_numeric IS 'Revenue in decimal format for calculations';
COMMENT ON COLUMN companies.revenue_formatted IS 'Human-readable revenue display';
COMMENT ON COLUMN contacts.title_priority IS '1=CEO/President, 2=VP, 3=Director, 4=Manager, 5=Other';
