import { useState, useEffect } from 'react';
import { Company, Contact } from '../lib/types';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './CompanyDetail.css';

interface CompanyDetailProps {
  company: Company;
}

const CompanyDetail = ({ company }: CompanyDetailProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState<boolean>(true);
  const [contactsError, setContactsError] = useState<string>('');
  const [totalContacts, setTotalContacts] = useState<number>(0);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setContactsLoading(true);
        setContactsError('');
        
        const response = await fetch(`/api/companies/${encodeURIComponent(company.name)}/contacts`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setContacts(data.contacts || []);
        setTotalContacts(data.totalContacts || 0);
        
      } catch (error) {
        console.error('Error fetching contacts:', error);
        setContactsError('Failed to load contacts');
        setContacts([]);
        setTotalContacts(0);
      } finally {
        setContactsLoading(false);
      }
    };

    fetchContacts();
  }, [company.name]);
  return (
    <div className="detail-page">
      <header className="header">
        <h1>Local Companies Catalog</h1>
      </header>

      <div className="back-button-container">
        <Button asChild variant="outline" size="icon">
          <Link to="/" aria-label="Back to Catalog">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="detail-container">
        <div className="company-header">
          <h2 className="company-name">{company.name}</h2>
          <div className="badges">
            {company.isHeadquarters && <span className="badge headquarters-badge">Headquarters</span>}
            {company.ownership && <span className="badge ownership-badge">{company.ownership}</span>}
          </div>
        </div>

        <div className="info-sections">
          <div className="info-section">
            <h3>Company Information</h3>
            <div className="info-grid">
              <div className="info-label">Industry:</div>
              <div className="info-value">{company.industry}</div>
              
              <div className="info-label">Ownership:</div>
              <div className="info-value">{company.ownership || 'N/A'}</div>
              
              {company.ticker && (
                <>
                  <div className="info-label">Ticker:</div>
                  <div className="info-value">{company.ticker}</div>
                </>
              )}
              
              <div className="info-label">Employees (Site):</div>
              <div className="info-value">{company.employeesSite || 'N/A'}</div>
              
              <div className="info-label">Employees (Total):</div>
              <div className="info-value">{company.employees || 'N/A'}</div>
              
              <div className="info-label">Annual Sales:</div>
              <div className="info-value">{company.sales || 'N/A'}</div>
            </div>
          </div>

          <div className="info-section">
            <h3>Contact Information</h3>
            <div className="info-grid">
              <div className="info-label">Address:</div>
              <div className="info-value">{company.address || 'N/A'}</div>
              
              <div className="info-label">City:</div>
              <div className="info-value">{company.city || 'N/A'}</div>
              
              <div className="info-label">State:</div>
              <div className="info-value">{company.state || 'N/A'}</div>
              
              <div className="info-label">Postal Code:</div>
              <div className="info-value">{company.postalCode || 'N/A'}</div>
              
              <div className="info-label">Phone:</div>
              <div className="info-value">{company.phone || 'N/A'}</div>
              
              <div className="info-label">Website:</div>
              <div className="info-value">
                {company.url ? (
                  <a href={company.url} target="_blank" rel="noopener noreferrer" className="website-link">
                    Visit Website
                  </a>
                ) : (
                  'N/A'
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="description-section">
          <h3>Business Description</h3>
          <p className="full-description">{company.description || 'No description available.'}</p>
        </div>

        <div className="contacts-section">
          <h3>
            <User className="section-icon" />
            Contact Information
            {totalContacts > 0 && <span className="contact-count">({totalContacts})</span>}
          </h3>
          
          {contactsLoading ? (
            <div className="contacts-loading">
              <div className="spinner-small"></div>
              <span>Loading contacts...</span>
            </div>
          ) : contactsError ? (
            <div className="contacts-error">
              <p>{contactsError}</p>
            </div>
          ) : contacts.length > 0 ? (
            <div className="contacts-grid">
              {contacts.map((contact, index) => (
                <div key={index} className="contact-card">
                  <div className="contact-header">
                    <h4 className="contact-name">
                      {contact.firstName} {contact.lastName}
                    </h4>
                    <div className="contact-indicators">
                      {contact.hasEmail && <Mail className="contact-icon email-icon" />}
                      {contact.hasPhone && <Phone className="contact-icon phone-icon" />}
                    </div>
                  </div>
                  <p className="contact-title">{contact.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-contacts">
              <p>No contact information available for this company.</p>
            </div>
          )}
        </div>

        <div className="additional-section">
          <h3>Additional Information</h3>
          <div className="info-grid wide-grid">
            <div className="info-label">NAICS Description:</div>
            <div className="info-value">{company.naicsDescription || 'N/A'}</div>
            
            <div className="info-label">SIC Description:</div>
            <div className="info-value">{company.sicDescription || 'N/A'}</div>
            
            <div className="info-label">Tradestyle:</div>
            <div className="info-value">{company.tradestyle || 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyDetail;
