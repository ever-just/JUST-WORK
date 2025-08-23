import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import CompanyGrid from './components/CompanyGrid';
import CompanyDetail from './components/CompanyDetail';
import { Company, IndustryOption } from './lib/types';
import { parseCSVData, getUniqueIndustries, formatSales } from './lib/utils';
import './App.css';

interface HomePageProps {
  companies: Company[];
  filteredCompanies: Company[];
  industries: IndustryOption[];
  loading: boolean;
  handleSearch: (query: string) => void;
  handleIndustryChange: (industry: string) => void;
}

function HomePage({ filteredCompanies, industries, loading, handleSearch, handleIndustryChange }: HomePageProps) {
  return (
    <>
      <header className="header">
        <h1>MINNESOTA COMPANIES</h1>
      </header>
      
      <main className="main-content">
        <SearchBar 
          onSearch={handleSearch}
          onIndustryChange={handleIndustryChange}
          industries={industries}
          totalCompanies={filteredCompanies.length}
        />
        
        <CompanyGrid 
          companies={filteredCompanies}
          loading={loading}
        />
      </main>
    </>
  );
}

interface DetailPageWrapperProps {
  companies: Company[];
}

function DetailPageWrapper({ companies }: DetailPageWrapperProps) {
  const { id } = useParams<{ id: string }>();
  const company = companies.find(c => c.name === decodeURIComponent(id || ''));
  
  if (!company) {
    return <div className="loading-container">Company not found</div>;
  }
  
  return <CompanyDetail company={company} />;
}

function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/ForMinnesotacompanies.org $10M + 10+ ppl + MN Only.csv');
        const csvText = await response.text();
        const parsedData = parseCSVData(csvText);
        
        // Filter out null values before mapping
        const validData = parsedData.filter(item => item !== null);
        
        // Process and format the data with strict typing
        const processedData: Company[] = validData
          .filter(Boolean)
          .map(company => ({
            name: company.name || '',
            address: company.address || '',
            city: company.city || '',
            state: company.state || '',
            postalCode: company.postalCode || '',
            sales: formatSales(company.sales || ''),
            employees: company.employees || '',
            description: company.description || '',
            industry: company.industry || '',
            isHeadquarters: Boolean(company.isHeadquarters),
            naicsDescription: company.naicsDescription || '',
            tradestyle: company.tradestyle || '',
            phone: company.phone || '',
            url: company.url || '',
            rawSales: company.sales || '',
            ownership: company.ownership || '',
            ticker: company.ticker || '',
            employeesSite: company.employeesSite || '',
            sicDescription: company.sicDescription || ''
          }));
        
        setCompanies(processedData);
        setFilteredCompanies(processedData);
        
        // Extract unique industries for the filter dropdown
        const uniqueIndustries = getUniqueIndustries(processedData);
        const industryOptions = uniqueIndustries.map(industry => ({
          value: industry,
          label: industry
        }));
        
        setIndustries(industryOptions);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  useEffect(() => {
    // Filter companies based on search query and selected industry
    let filtered = [...companies];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(company => 
        company.name.toLowerCase().includes(query) || 
        (company.description && company.description.toLowerCase().includes(query))
      );
    }
    
    if (selectedIndustry) {
      filtered = filtered.filter(company => company.industry === selectedIndustry);
    }
    
    setFilteredCompanies(filtered);
  }, [searchQuery, selectedIndustry, companies]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleIndustryChange = (industry: string) => {
    setSelectedIndustry(industry);
  };

  return (
    <div className="app">
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={
              <HomePage 
                companies={companies}
                filteredCompanies={filteredCompanies}
                industries={industries}
                loading={loading}
                handleSearch={handleSearch}
                handleIndustryChange={handleIndustryChange}
              />
            } 
          />
          <Route 
            path="/company/:id" 
            element={<DetailPageWrapper companies={companies} />} 
          />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
