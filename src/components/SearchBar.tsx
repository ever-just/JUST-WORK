import { useState } from 'react';
import { IndustryOption } from '../lib/types';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onIndustryChange: (industry: string) => void;
  industries: IndustryOption[];
  totalCompanies: number;
}

const SearchBar = ({ onSearch, onIndustryChange, industries, totalCompanies }: SearchBarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch(value);
  };
  
  const handleIndustryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onIndustryChange(e.target.value);
  };
  
  return (
    <div className="search-container">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search companies by name or description..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="search-input"
        />
      </div>
      <div className="filter-container">
        <select 
          className="industry-select"
          onChange={handleIndustryChange}
          defaultValue=""
        >
          <option value="">All Industries</option>
          {industries.map((industry, index) => (
            <option key={index} value={industry.value}>
              {industry.label}
            </option>
          ))}
        </select>
      </div>
      <div className="results-count">
        {totalCompanies} companies found
      </div>
    </div>
  );
};

export default SearchBar;
