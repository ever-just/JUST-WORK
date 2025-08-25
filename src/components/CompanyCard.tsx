import { Company } from '../lib/types';
import { memo } from 'react';
import { useState } from 'react';

interface CompanyCardProps {
  company: Company;
}

const CompanyCard = memo(({ company }: CompanyCardProps) => {
  const [logoError, setLogoError] = useState(false);
  const [logoLoading, setLogoLoading] = useState(true);

  const handleLogoError = () => {
    setLogoError(true);
    setLogoLoading(false);
  };

  const handleLogoLoad = () => {
    setLogoLoading(false);
  };

  return (
    <div className="company-card">
      <div className="company-header">
        <div className="company-logo-container">
          {company.favicon_url && !logoError ? (
            <img 
              src={company.favicon_url}
              alt={`${company.name} logo`}
              className="company-logo"
              onError={handleLogoError}
              onLoad={handleLogoLoad}
              style={{ display: logoLoading ? 'none' : 'block' }}
            />
          ) : (
            <div className="company-logo-fallback">
              {company.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="company-title-section">
          <h2 className="company-name">{company.name}</h2>
          {company.isHeadquarters && <span className="hq-badge">HQ</span>}
        </div>
      </div>
      <div className="company-industry">{company.industry}</div>
      <div className="company-details">
        <div className="detail-item">
          <span className="detail-label">Location:</span> {company.city}, {company.state}
        </div>
        <div className="detail-item">
          <span className="detail-label">Employees:</span> {company.employees}
        </div>
        {company.approxAnnualRevenue && (
          <div className="detail-item">
            <span className="detail-label">Approx Annual Revenue:</span> {company.approxAnnualRevenue}
          </div>
        )}
      </div>
      <div className="company-description">
        {company.description && company.description.length > 300 
          ? `${company.description.substring(0, 300)}...` 
          : company.description}
      </div>
      <div className="view-details">
        <a href="#" className="view-details-link">View Details →</a>
      </div>
    </div>
  );
});

export default CompanyCard;
