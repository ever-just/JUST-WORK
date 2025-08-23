import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface CompanyData {
  [key: string]: string;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const parseCSVData = (csvData: string) => {
  // CSV parsing logic remains the same
  const rows = csvData.split('\n');
  const headers = rows[0].split(',').map(h => h.replace(/"/g, ''));
  
  return rows.slice(1).map(row => {
    if (!row.trim()) return null;
    
    // Handle commas within quoted fields
    const values: string[] = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.replace(/"/g, ''));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    values.push(currentValue.replace(/"/g, ''));
    
    const company: CompanyData = {};
    headers.forEach((header, index) => {
      company[header] = values[index] || '';
    });
    
    return {
      name: company['Company Name'] || '',
      tradestyle: company['Tradestyle'] || '',
      address: company['Address Line 1'] || '',
      city: company['City'] || '',
      state: company['State Or Province'] || '',
      postalCode: company['Postal Code'] || '',
      phone: company['Phone'] || '',
      url: company['URL'] || '',
      sales: company['Sales (USD)'] || '',
      employees: company['Employees (Total)'] || '',
      description: company['Business Description'] || '',
      industry: company['D&B Hoovers Industry'] || '',
      isHeadquarters: company['Is Headquarters'] === 'true',
      naicsDescription: company['NAICS 2022 Description'] || '',
      ownership: company['Ownership Type'] || '',
      ticker: company['Ticker'] || '',
      employeesSite: company['Employees (Single Site)'] || '',
      sicDescription: company['US 8-Digit SIC Description'] || ''
    };
  }).filter(Boolean);
};

export const formatSales = (sales: string): string => {
  if (!sales) return 'N/A';
  
  const num = parseFloat(sales);
  if (isNaN(num)) return 'N/A';
  
  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(1)}B`;
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(1)}M`;
  } else {
    return `$${num.toLocaleString()}`;
  }
};

export const getUniqueIndustries = (companies: any[]) => {
  const industries = new Set<string>();
  
  companies.forEach((company: any) => {
    if (company.industry) {
      industries.add(company.industry);
    }
  });
  
  return Array.from(industries).sort();
};

export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  
  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX if it's a 10-digit number
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
};
