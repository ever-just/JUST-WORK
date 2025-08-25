const axios = require('axios');
const xml2js = require('xml2js');
const { URL } = require('url');

class SitemapService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Main method to get relevant sitemap pages for a company
   */
  async getRelevantPages(companyUrl, companyName, limit = 10) {
    try {
      if (!companyUrl || !companyName) {
        return { pages: [], error: null };
      }

      // Normalize URL
      const normalizedUrl = this.normalizeUrl(companyUrl);
      if (!normalizedUrl) {
        return { pages: [], error: 'Invalid URL provided' };
      }

      // Check cache first
      const cacheKey = `${normalizedUrl}_${companyName}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return { pages: cached.pages.slice(0, limit), error: null };
        }
        this.cache.delete(cacheKey);
      }

      // Discover all sitemaps (main domain + subdomains)
      const allSitemaps = await this.discoverAllSitemaps(normalizedUrl);
      
      // Extract and score all pages
      const allPages = await this.extractAllPages(allSitemaps);
      const scoredPages = this.scorePageRelevance(allPages, companyName);
      
      // Sort by relevance and take top results
      const topPages = scoredPages
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, Math.max(limit, 20)); // Cache more than requested

      // Cache results
      this.cache.set(cacheKey, {
        pages: topPages,
        timestamp: Date.now()
      });

      return { 
        pages: topPages.slice(0, limit), 
        error: null,
        totalFound: allPages.length,
        subdomainsChecked: allSitemaps.length
      };

    } catch (error) {
      console.error('Error getting relevant pages:', error);
      return { 
        pages: [], 
        error: error.message,
        totalFound: 0,
        subdomainsChecked: 0
      };
    }
  }

  /**
   * Normalize URL to ensure it's properly formatted
   */
  normalizeUrl(url) {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      const urlObj = new URL(url);
      return urlObj.origin;
    } catch (error) {
      return null;
    }
  }

  /**
   * Discover all sitemaps including subdomains
   */
  async discoverAllSitemaps(baseUrl) {
    const sitemaps = [];
    const urlObj = new URL(baseUrl);
    const domain = urlObj.hostname;

    // Common sitemap locations for main domain
    const mainSitemaps = await this.findSitemapsForDomain(baseUrl);
    sitemaps.push(...mainSitemaps);

    // Discover and check common subdomains
    const commonSubdomains = [
      'www', 'blog', 'news', 'support', 'help', 'docs', 'api',
      'shop', 'store', 'careers', 'jobs', 'about', 'portal',
      'app', 'my', 'customer', 'clients', 'partners'
    ];

    const subdomainPromises = commonSubdomains.map(async (subdomain) => {
      const subdomainUrl = `https://${subdomain}.${domain}`;
      try {
        // Quick check if subdomain exists
        const response = await axios.head(subdomainUrl, { 
          timeout: 5000,
          maxRedirects: 3
        });
        if (response.status === 200) {
          const subSitemaps = await this.findSitemapsForDomain(subdomainUrl);
          return subSitemaps;
        }
      } catch (error) {
        // Subdomain doesn't exist or is not accessible
      }
      return [];
    });

    const subdomainResults = await Promise.allSettled(subdomainPromises);
    subdomainResults.forEach(result => {
      if (result.status === 'fulfilled') {
        sitemaps.push(...result.value);
      }
    });

    return [...new Set(sitemaps)]; // Remove duplicates
  }

  /**
   * Find sitemaps for a specific domain
   */
  async findSitemapsForDomain(baseUrl) {
    const sitemaps = [];
    const commonPaths = [
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/sitemaps.xml',
      '/sitemap/sitemap.xml',
      '/sitemaps/sitemap.xml',
      '/wp-sitemap.xml', // WordPress
      '/sitemap-index.xml',
      '/robots.txt' // Check robots.txt for sitemap references
    ];

    for (const path of commonPaths) {
      try {
        const sitemapUrl = baseUrl + path;
        
        if (path === '/robots.txt') {
          // Parse robots.txt for sitemap references
          const robotsSitemaps = await this.extractSitemapsFromRobots(sitemapUrl);
          sitemaps.push(...robotsSitemaps);
        } else {
          // Try to fetch the sitemap directly
          const response = await axios.get(sitemapUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SitemapBot/1.0)'
            }
          });
          
          if (response.status === 200 && response.data) {
            sitemaps.push(sitemapUrl);
          }
        }
      } catch (error) {
        // Sitemap doesn't exist at this path
      }
    }

    return sitemaps;
  }

  /**
   * Extract sitemap URLs from robots.txt
   */
  async extractSitemapsFromRobots(robotsUrl) {
    try {
      const response = await axios.get(robotsUrl, { timeout: 5000 });
      const robotsContent = response.data;
      const sitemapMatches = robotsContent.match(/Sitemap:\s*(https?:\/\/[^\s]+)/gi);
      
      if (sitemapMatches) {
        return sitemapMatches.map(match => match.replace(/Sitemap:\s*/i, '').trim());
      }
    } catch (error) {
      // robots.txt not accessible
    }
    return [];
  }

  /**
   * Extract all pages from discovered sitemaps
   */
  async extractAllPages(sitemapUrls) {
    const allPages = [];
    
    const extractPromises = sitemapUrls.map(async (sitemapUrl) => {
      try {
        const pages = await this.extractPagesFromSitemap(sitemapUrl);
        return pages;
      } catch (error) {
        console.error(`Error extracting from sitemap ${sitemapUrl}:`, error.message);
        return [];
      }
    });

    const results = await Promise.allSettled(extractPromises);
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allPages.push(...result.value);
      }
    });

    // Remove duplicates based on URL
    const uniquePages = [];
    const seenUrls = new Set();
    
    allPages.forEach(page => {
      if (!seenUrls.has(page.url)) {
        seenUrls.add(page.url);
        uniquePages.push(page);
      }
    });

    return uniquePages;
  }

  /**
   * Extract pages from a single sitemap
   */
  async extractPagesFromSitemap(sitemapUrl) {
    try {
      const response = await axios.get(sitemapUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SitemapBot/1.0)'
        }
      });

      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);
      
      const pages = [];

      // Handle sitemap index (contains references to other sitemaps)
      if (result.sitemapindex && result.sitemapindex.sitemap) {
        const childSitemaps = result.sitemapindex.sitemap;
        const childPromises = childSitemaps.map(async (sitemap) => {
          if (sitemap.loc && sitemap.loc[0]) {
            try {
              const childPages = await this.extractPagesFromSitemap(sitemap.loc[0]);
              return childPages;
            } catch (error) {
              return [];
            }
          }
          return [];
        });

        const childResults = await Promise.allSettled(childPromises);
        childResults.forEach(result => {
          if (result.status === 'fulfilled') {
            pages.push(...result.value);
          }
        });
      }

      // Handle regular sitemap (contains actual URLs)
      if (result.urlset && result.urlset.url) {
        const urls = result.urlset.url;
        urls.forEach(urlEntry => {
          if (urlEntry.loc && urlEntry.loc[0]) {
            const page = {
              url: urlEntry.loc[0],
              lastmod: urlEntry.lastmod ? urlEntry.lastmod[0] : null,
              changefreq: urlEntry.changefreq ? urlEntry.changefreq[0] : null,
              priority: urlEntry.priority ? parseFloat(urlEntry.priority[0]) : null,
              title: this.extractTitleFromUrl(urlEntry.loc[0]),
              category: this.categorizeUrl(urlEntry.loc[0])
            };
            pages.push(page);
          }
        });
      }

      return pages;
    } catch (error) {
      throw new Error(`Failed to parse sitemap ${sitemapUrl}: ${error.message}`);
    }
  }

  /**
   * Score page relevance based on company name and URL patterns
   */
  scorePageRelevance(pages, companyName) {
    const companyWords = companyName.toLowerCase().split(/\s+/);
    
    return pages.map(page => {
      let score = 0;
      const url = page.url.toLowerCase();
      const title = page.title.toLowerCase();
      
      // Base score from sitemap priority
      if (page.priority) {
        score += page.priority * 10;
      } else {
        score += 5; // Default base score
      }

      // Boost for important page types
      const importantPatterns = [
        { pattern: /\/(about|company|who-we-are|our-story|mission)/i, boost: 15 },
        { pattern: /\/(services|products|solutions|offerings)/i, boost: 12 },
        { pattern: /\/(contact|get-in-touch|reach-us)/i, boost: 10 },
        { pattern: /\/(careers|jobs|work-with-us)/i, boost: 8 },
        { pattern: /\/(news|blog|press|media)/i, boost: 6 },
        { pattern: /\/(team|leadership|management)/i, boost: 8 },
        { pattern: /\/(case-studies|portfolio|work|projects)/i, boost: 7 },
        { pattern: /^https?:\/\/[^\/]+\/?$/i, boost: 20 } // Homepage
      ];

      importantPatterns.forEach(({ pattern, boost }) => {
        if (pattern.test(url)) {
          score += boost;
        }
      });

      // Penalize less relevant pages
      const penaltyPatterns = [
        { pattern: /\/(privacy|terms|legal|cookie)/i, penalty: 8 },
        { pattern: /\/(sitemap|robots|feed|rss)/i, penalty: 10 },
        { pattern: /\/(admin|wp-|login|register)/i, penalty: 15 },
        { pattern: /\.(pdf|doc|docx|xls|xlsx|zip)$/i, penalty: 5 },
        { pattern: /\/tag\/|\/category\/|\/author\//i, penalty: 6 }
      ];

      penaltyPatterns.forEach(({ pattern, penalty }) => {
        if (pattern.test(url)) {
          score -= penalty;
        }
      });

      // Boost for company name mentions
      companyWords.forEach(word => {
        if (word.length > 2) { // Skip very short words
          if (url.includes(word)) score += 5;
          if (title.includes(word)) score += 3;
        }
      });

      // Boost for recency (if lastmod is available)
      if (page.lastmod) {
        const lastModDate = new Date(page.lastmod);
        const now = new Date();
        const daysSinceUpdate = (now - lastModDate) / (1000 * 60 * 60 * 24);
        
        if (daysSinceUpdate < 30) score += 3;
        else if (daysSinceUpdate < 90) score += 1;
        else if (daysSinceUpdate > 365) score -= 2;
      }

      // Ensure minimum score
      score = Math.max(score, 0);

      return {
        ...page,
        relevanceScore: Math.round(score * 10) / 10 // Round to 1 decimal
      };
    });
  }

  /**
   * Extract a readable title from URL
   */
  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Remove leading/trailing slashes and split by slash
      const segments = pathname.replace(/^\/+|\/+$/g, '').split('/');
      
      if (segments.length === 0 || segments[0] === '') {
        return 'Homepage';
      }
      
      // Take the last meaningful segment
      const lastSegment = segments[segments.length - 1];
      
      // Convert URL-friendly format to readable title
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\.(html?|php|aspx?)$/i, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Page';
        
    } catch (error) {
      return 'Page';
    }
  }

  /**
   * Categorize URL based on patterns
   */
  categorizeUrl(url) {
    const categories = [
      { name: 'About', pattern: /\/(about|company|who-we-are|our-story|mission|vision)/i },
      { name: 'Services', pattern: /\/(services|products|solutions|offerings|what-we-do)/i },
      { name: 'Contact', pattern: /\/(contact|get-in-touch|reach-us|locations)/i },
      { name: 'Careers', pattern: /\/(careers|jobs|work-with-us|employment)/i },
      { name: 'News', pattern: /\/(news|blog|press|media|articles)/i },
      { name: 'Team', pattern: /\/(team|leadership|management|staff|people)/i },
      { name: 'Portfolio', pattern: /\/(case-studies|portfolio|work|projects|gallery)/i },
      { name: 'Support', pattern: /\/(support|help|faq|documentation|docs)/i },
      { name: 'Homepage', pattern: /^https?:\/\/[^\/]+\/?$/i }
    ];

    for (const category of categories) {
      if (category.pattern.test(url)) {
        return category.name;
      }
    }

    return 'Other';
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

module.exports = SitemapService;
