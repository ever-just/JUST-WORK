import { useState, useEffect } from 'react';
import { SitemapPage, SitemapResponse } from '../lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ExternalLink, 
  Globe, 
  Star, 
  Clock, 
  RefreshCw,
  Info,
  TrendingUp,
  MapPin
} from 'lucide-react';

interface CompanySitemapProps {
  companyName: string;
  companyUrl?: string;
}

const CompanySitemap = ({ companyName, companyUrl }: CompanySitemapProps) => {
  const [sitemapData, setSitemapData] = useState<SitemapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showAll, setShowAll] = useState<boolean>(false);

  const fetchSitemap = async () => {
    if (!companyName) return;

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/companies/${encodeURIComponent(companyName)}/sitemap?limit=20`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SitemapResponse = await response.json();
      setSitemapData(data);
      
    } catch (err) {
      console.error('Error fetching sitemap:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sitemap');
      setSitemapData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyUrl) {
      fetchSitemap();
    }
  }, [companyName, companyUrl]);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'homepage': return <Globe className="h-4 w-4" />;
      case 'about': return <Info className="h-4 w-4" />;
      case 'services': return <TrendingUp className="h-4 w-4" />;
      case 'contact': return <MapPin className="h-4 w-4" />;
      case 'careers': return <Star className="h-4 w-4" />;
      default: return <ExternalLink className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'homepage': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'about': return 'bg-green-100 text-green-800 border-green-200';
      case 'services': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'contact': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'careers': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'news': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'team': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'portfolio': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'support': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 30) return 'text-green-600 font-semibold';
    if (score >= 20) return 'text-blue-600 font-medium';
    if (score >= 10) return 'text-yellow-600';
    return 'text-gray-500';
  };

  const formatLastModified = (lastmod?: string) => {
    if (!lastmod) return null;
    try {
      return new Date(lastmod).toLocaleDateString();
    } catch {
      return null;
    }
  };

  const displayedPages = showAll ? sitemapData?.pages || [] : (sitemapData?.pages || []).slice(0, 8);

  if (!companyUrl) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Company Sitemap
          </CardTitle>
          <CardDescription>
            Discover relevant pages from the company's website
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No website URL available for this company. Sitemap discovery requires a company website.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Company Sitemap
            </CardTitle>
            <CardDescription>
              Discover relevant pages from {companyName}'s website
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSitemap}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Discovering sitemap pages and subdomains...
            </div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {sitemapData?.error && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {sitemapData.error}
            </AlertDescription>
          </Alert>
        )}

        {sitemapData && !loading && sitemapData.pages.length > 0 && (
          <>
            <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center gap-4">
                <span>Found {sitemapData.totalFound} pages</span>
                <span>•</span>
                <span>Checked {sitemapData.subdomainsChecked} sitemap(s)</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                <span className="text-xs">Sorted by relevance</span>
              </div>
            </div>

            <div className="grid gap-3">
              {displayedPages.map((page, index) => (
                <div
                  key={page.url}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(page.category)}
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getCategoryColor(page.category)}`}
                        >
                          {page.category}
                        </Badge>
                      </div>
                      <div className={`text-sm font-medium ${getRelevanceColor(page.relevanceScore)}`}>
                        {page.relevanceScore}★
                      </div>
                    </div>
                    
                    <h4 className="font-medium text-gray-900 truncate mb-1">
                      {page.title}
                    </h4>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="truncate max-w-md">{page.url}</span>
                      {formatLastModified(page.lastmod) && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Updated {formatLastModified(page.lastmod)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="ml-4 flex-shrink-0"
                  >
                    <a 
                      href={page.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visit
                    </a>
                  </Button>
                </div>
              ))}
            </div>

            {sitemapData.pages.length > 8 && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(!showAll)}
                  className="flex items-center gap-2"
                >
                  {showAll ? (
                    <>Show Less</>
                  ) : (
                    <>Show All {sitemapData.pages.length} Pages</>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        {sitemapData && !loading && sitemapData.pages.length === 0 && !sitemapData.error && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No sitemap pages found for this company. The website may not have a sitemap or may not be accessible.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanySitemap;
