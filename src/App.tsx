import { useState, useEffect, useCallback, useRef } from 'react';
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

      // Build query parameters - include search/industry filters for server-side filtering
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '200',
      });

      // Add search filter if present
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      // Add industry filter if present
      if (selectedIndustry) {
        params.append('industry', selectedIndustry);
      }

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
  }, [searchQuery, selectedIndustry]);

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
  // Initial data load
  useEffect(() => {
    fetchCompanies(1, true);
  }, []);

  // Reset pagination and reload data when filters change
  useEffect(() => {
    // Skip initial render (when both are empty initially)
    if (searchQuery !== '' || selectedIndustry !== '' || companies.length > 0) {
      setCurrentPage(1);
      setHasMore(true);
      fetchCompanies(1, true);
    }
  }, [searchQuery, selectedIndustry, fetchCompanies]);

  // Client-side filtering effect
  // Since we're using server-side filtering, filteredCompanies is just companies
  useEffect(() => {
    setFilteredCompanies(companies);
  }, [companies]);

  // Stable refs for IntersectionObserver to prevent recreation issues
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef(loadMoreCompanies);
  const stateRef = useRef({ hasMore, loadingMore, loading });

  // Keep refs current
  loadMoreRef.current = loadMoreCompanies;
  stateRef.current = { hasMore, loadingMore, loading };

  // Stable intersection callback that doesn't cause observer recreation
  const stableIntersectionCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    const { hasMore: currentHasMore, loadingMore: currentLoadingMore, loading: currentLoading } = stateRef.current;
    
    if (target.isIntersecting && currentHasMore && !currentLoadingMore && !currentLoading) {
      loadMoreRef.current();
    }
  }, []); // No dependencies - completely stable!

  // Intersection Observer setup - only recreates when absolutely necessary
  useEffect(() => {
    // Don't set up observer until we have initial data
    if (companies.length === 0) {
      return;
    }

    // Create observer only once
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        stableIntersectionCallback,
        {
          threshold: 0.1,
          rootMargin: '100px'
        }
      );
    }

    // Find and observe sentinel (no timeout needed - immediate observation)
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel && observerRef.current) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      // Only unobserve, don't disconnect (keep observer alive)
      if (observerRef.current && sentinel) {
        observerRef.current.unobserve(sentinel);
      }
    };
  }, [companies.length, stableIntersectionCallback]); // Minimal dependencies

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);



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
