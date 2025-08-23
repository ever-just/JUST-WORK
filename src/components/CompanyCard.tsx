import { Company } from '../lib/types';
import { formatSales } from '../lib/utils';

interface CompanyCardProps {
  company: Company;
}

const CompanyCard = ({ company }: CompanyCardProps) => {
  return (
    <div className="company-card">
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
          <span className="detail-label">Sales:</span> {formatSales(company.sales || '')}
        </div>
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
};

export default CompanyCard;
