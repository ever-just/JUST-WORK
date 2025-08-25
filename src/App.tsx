import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import CompanyGrid from './components/CompanyGrid';
import CompanyDetail from './components/CompanyDetail';
import { Company, IndustryOption } from './lib/types';
// Removed unused CSV parsing imports - now using API
import './App.css';

interface HomePageProps {
  filteredCompanies: Company[];
  industries: IndustryOption[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalCompanies: number;
  searchQuery: string;
  selectedIndustry: string;
  handleSearch: (query: string) => void;
  handleIndustryChange: (industry: string) => void;
  handleClearFilters: () => void;
}

function HomePage({ filteredCompanies, industries, loading, loadingMore, hasMore, totalCompanies, searchQuery, selectedIndustry, handleSearch, handleIndustryChange, handleClearFilters }: HomePageProps) {
  return (
    <>
                  <header className="header">
              <h1>JUST WORK</h1>
            </header>
      
      <main className="main-content">
        <SearchBar 
          onSearch={handleSearch}
          onIndustryChange={handleIndustryChange}
          onClearFilters={handleClearFilters}
          industries={industries}
          totalCompanies={totalCompanies}
          searchQuery={searchQuery}
          selectedIndustry={selectedIndustry}
        />
        
        
        <CompanyGrid 
          companies={filteredCompanies}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          totalCompanies={totalCompanies}
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
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [totalCompanies, setTotalCompanies] = useState<number>(0);

  const fetchCompanies = useCallback(async (page: number, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Build query parameters - no search/industry filters for API
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      const response = await fetch(`/api/companies?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const newCompanies = data.companies || [];
      
      if (reset) {
        setCompanies(newCompanies);
      } else {
        setCompanies(prev => [...prev, ...newCompanies]);
      }
      
      setTotalCompanies(data.pagination?.total || 0);
      setHasMore(page < (data.pagination?.pages || 1));
      
    } catch (error) {
      console.error('Error fetching companies:', error);
      if (reset) {
        setCompanies([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadMoreCompanies = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchCompanies(nextPage, false);
    }
  }, [loadingMore, hasMore, currentPage, fetchCompanies, loading]);

  useEffect(() => {
    const fetchIndustries = async () => {
      try {
        const response = await fetch('/api/industries');
        if (response.ok) {
          const data = await response.json();
          setIndustries(data || []);
        }
      } catch (error) {
        console.error('Error fetching industries:', error);
      }
    };
    
    fetchIndustries();
  }, []);

  // Initial companies loading
  useEffect(() => {
    fetchCompanies(1, true);
  }, []);

  // Client-side filtering effect
  useEffect(() => {
    let filtered = [...companies];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(company => 
        company.name.toLowerCase().includes(query) ||
        company.description.toLowerCase().includes(query) ||
        company.industry.toLowerCase().includes(query) ||
        company.city.toLowerCase().includes(query)
      );
    }
    
    // Apply industry filter
    if (selectedIndustry) {
      filtered = filtered.filter(company => company.industry === selectedIndustry);
    }
    
    setFilteredCompanies(filtered);
  }, [companies, searchQuery, selectedIndustry]);

  // Intersection Observer for infinite scroll - only set up after initial data is loaded
  useEffect(() => {
    // Don't set up observer until we have initial data and are not loading
    if (loading || companies.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreCompanies();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    // Add a small delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      const sentinel = document.getElementById('scroll-sentinel');
      if (sentinel) {
        observer.observe(sentinel);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [hasMore, loadingMore, loading, currentPage, loadMoreCompanies, companies.length]);



  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleIndustryChange = (industry: string) => {
    setSelectedIndustry(industry);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedIndustry('');
  };

  return (
    <div className="app">
      <Router>
        <Routes>
                    <Route
            path="/"
            element={
              <HomePage
                filteredCompanies={filteredCompanies}
                industries={industries}
                loading={loading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                totalCompanies={totalCompanies}
                searchQuery={searchQuery}
                selectedIndustry={selectedIndustry}
                handleSearch={handleSearch}
                handleIndustryChange={handleIndustryChange}
                handleClearFilters={handleClearFilters}
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
