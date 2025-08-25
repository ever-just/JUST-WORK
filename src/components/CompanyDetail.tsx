import { useState, useEffect } from 'react';
import { Company, Contact } from '../lib/types';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, ExternalLink, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CompanySitemap from './CompanySitemap';
import './CompanyDetail.css';

interface CompanyDetailProps {
  company: Company;
}

const CompanyDetail = ({ company }: CompanyDetailProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState<boolean>(true);
  const [contactsError, setContactsError] = useState<string>('');
  const [totalContacts, setTotalContacts] = useState<number>(0);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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

  const openContactModal = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const closeContactModal = () => {
    setSelectedContact(null);
    setIsModalOpen(false);
  };

  const getLinkedInSearchUrl = (contact: Contact) => {
    const query = `${contact.firstName} ${contact.lastName} ${company.name}`;
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
  };
  return (
    <div className="detail-page">
      <header className="header">
        <div className="header-content">
          <Button asChild variant="outline" size="icon" className="back-button">
            <Link to="/" aria-label="Back to Catalog">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1>{company.name}</h1>
          <div className="header-badges">
            {company.isHeadquarters && <span className="badge headquarters-badge">Headquarters</span>}
            {company.ownership && <span className="badge ownership-badge">{company.ownership}</span>}
          </div>
        </div>
      </header>

      <div className="detail-container">

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
              
                            <div className="info-label">Employees:</div>
              <div className="info-value">{company.employees || company.employeesSite || 'N/A'}</div>

              {company.approxAnnualRevenue && (
                <>
                  <div className="info-label">Approx Annual Revenue:</div>
                  <div className="info-value">{company.approxAnnualRevenue}</div>
                </>
              )}
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
                  <div className="website-container">
                    <span className="website-url">{company.url}</span>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="website-button"
                    >
                      <a href={company.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
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
                <div 
                  key={index} 
                  className="contact-card clickable"
                  onClick={() => openContactModal(contact)}
                >
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
                  <div className="contact-action-hint">Click for more info</div>
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

        <div className="sitemap-section">
          <CompanySitemap 
            companyName={company.name} 
            companyUrl={company.url} 
          />
        </div>
      </div>

      {/* Contact Modal */}
      {isModalOpen && selectedContact && (
        <div className="modal-overlay" onClick={closeContactModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Contact Details</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={closeContactModal}
                className="modal-close"
              >
                ×
              </Button>
            </div>
            
            <div className="modal-body">
              <div className="contact-details">
                <h4 className="modal-contact-name">
                  {selectedContact.firstName} {selectedContact.lastName}
                </h4>
                <p className="modal-contact-title">{selectedContact.title}</p>
                <p className="modal-company-name">at {company.name}</p>
                
                <div className="contact-availability">
                  <div className="availability-item">
                    <Mail className="availability-icon" />
                    <span>{selectedContact.hasEmail ? 'Email available' : 'No email on file'}</span>
                  </div>
                  <div className="availability-item">
                    <Phone className="availability-icon" />
                    <span>{selectedContact.hasPhone ? 'Phone available' : 'No phone on file'}</span>
                  </div>
                </div>

                <div className="modal-actions">
                  <Button
                    asChild
                    variant="default"
                    className="linkedin-button"
                  >
                    <a 
                      href={getLinkedInSearchUrl(selectedContact)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Linkedin className="h-4 w-4 mr-2" />
                      Find on LinkedIn
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyDetail;
