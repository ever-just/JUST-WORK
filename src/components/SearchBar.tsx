import { useState, useEffect } from 'react';
import { IndustryOption } from '../lib/types';
import { X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onIndustryChange: (industry: string) => void;
  onClearFilters: () => void;
  industries: IndustryOption[];
  totalCompanies: number;
  searchQuery: string;
  selectedIndustry: string;
}

const SearchBar = ({ onSearch, onIndustryChange, onClearFilters, industries, totalCompanies, searchQuery, selectedIndustry }: SearchBarProps) => {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Sync local state with props when they change (e.g., when filters are cleared)
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchQuery(value);
    onSearch(value);
  };
  
  const handleIndustryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onIndustryChange(e.target.value);
  };
  
  const hasActiveFilters = localSearchQuery || selectedIndustry;
  const selectedIndustryLabel = industries.find(ind => ind.value === selectedIndustry)?.label;

  return (
    <div className="search-container">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search companies by name or description..."
          value={localSearchQuery}
          onChange={handleSearchChange}
          className="search-input"
        />
      </div>
      
      <div className="filter-container">
        <select 
          className={`industry-select ${selectedIndustry ? 'active' : ''}`}
          onChange={handleIndustryChange}
          value={selectedIndustry}
        >
          <option value="">All Industries</option>
          {industries.map((industry, index) => (
            <option key={index} value={industry.value}>
              {industry.label}
            </option>
          ))}
        </select>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="active-filters">
          <span className="active-filters-label">Active filters:</span>
          {localSearchQuery && (
            <span className="filter-tag">
              Search: "{localSearchQuery}"
              <button 
                onClick={() => {
                  setLocalSearchQuery('');
                  onSearch('');
                }}
                className="filter-remove"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            </span>
          )}
          {selectedIndustry && (
            <span className="filter-tag">
              Industry: {selectedIndustryLabel}
              <button 
                onClick={() => onIndustryChange('')}
                className="filter-remove"
                aria-label="Clear industry filter"
              >
                <X size={14} />
              </button>
            </span>
          )}
          <button 
            onClick={onClearFilters}
            className="clear-all-filters"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="results-count">
        {totalCompanies} companies found
      </div>
    </div>
  );
};

export default SearchBar;
