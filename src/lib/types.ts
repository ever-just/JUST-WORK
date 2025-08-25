export interface Contact {
  firstName: string;
  lastName: string;
  title: string;
  hasEmail: boolean;
  hasPhone: boolean;
}

export interface Company {
  name: string;
  tradestyle: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  url: string;
  sales: string;
  employees: string;
  description: string;
  industry: string;
  isHeadquarters: boolean;
  naicsDescription: string;
  rawSales?: string;
  ownership?: string;
  ticker?: string;
  employeesSite?: string;
  sicDescription?: string;
  contacts?: Contact[];
  totalContacts?: number;
  approxAnnualRevenue?: string;
}

export interface IndustryOption {
  value: string;
  label: string;
}

export interface SitemapPage {
  url: string;
  title: string;
  category: string;
  relevanceScore: number;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface SitemapResponse {
  pages: SitemapPage[];
  error?: string;
  totalFound: number;
  subdomainsChecked: number;
}
