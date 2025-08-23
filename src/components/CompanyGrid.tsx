import { Company } from '../lib/types';
import { Link } from 'react-router-dom';

interface CompanyGridProps {
  companies: Company[];
  loading: boolean;
}

const CompanyGrid = ({ companies, loading }: CompanyGridProps) => {
  if (loading) {
    return <div className="loading-container">Loading companies...</div>;
  }

  if (companies.length === 0) {
    return <div className="no-results">No companies found matching your criteria.</div>;
  }

  return (
    <div className="company-grid">
      {companies.map((company, index) => (
        <div key={index} className="company-card">
          <div className="company-header">
            <h2 className="company-name">{company.name}</h2>
            {company.isHeadquarters && <span className="hq-badge">HQ</span>}
          </div>
          <div className="company-industry">{company.industry}</div>
          <div className="company-details">
            <div className="detail-item">
              <span className="detail-label">Location:</span> {company.city}, {company.state}
            </div>
            <div className="detail-item">
              <span className="detail-label">Employees:</span> {company.employees}
            </div>
            <div className="detail-item">
              <span className="detail-label">Sales:</span> {company.sales}
            </div>
          </div>
          <div className="company-description">
            {company.description && company.description.length > 300 
              ? `${company.description.substring(0, 300)}...` 
              : company.description}
          </div>
          <div className="view-details">
            <Link 
              to={`/company/${encodeURIComponent(company.name)}`} 
              className="view-details-link"
            >
              View Details →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CompanyGrid;
