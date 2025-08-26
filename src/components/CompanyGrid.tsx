import { Company } from '../lib/types';
import { Link } from 'react-router-dom';
import CompanyCard from './CompanyCard';

interface CompanyGridProps {
  companies: Company[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  totalCompanies?: number;
}

const CompanyGrid = ({ companies, loading, loadingMore = false, hasMore = false, totalCompanies = 0 }: CompanyGridProps) => {
  if (loading) {
    return <div className="loading-container">Loading companies...</div>;
  }

  if (companies.length === 0) {
    return <div className="no-results">No companies found matching your criteria.</div>;
  }

  return (
    <div className="company-grid-container">
      <div className="company-grid">
        {companies.map((company, index) => (
          <Link 
            key={`${company.name}-${index}`}
            to={`/company/${encodeURIComponent(company.name)}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <CompanyCard company={company} />
          </Link>
        ))}
      </div>

      {/* Scroll Sentinel for Infinite Loading */}
      {hasMore && (
        <div id="scroll-sentinel" className="scroll-sentinel">
          {loadingMore ? (
            <div className="loading-more">
              <div className="spinner"></div>
              <span>Loading more companies...</span>
            </div>
          ) : (
            <div className="scroll-hint">
              📜 Keep scrolling to load more companies (200 per page)
            </div>
          )}
        </div>
      )}

      {!hasMore && companies.length > 0 && (
        <div className="end-message">
          🎉 You've reached the end! All {totalCompanies} companies loaded.
        </div>
      )}
    </div>
  );
};

export default CompanyGrid;
