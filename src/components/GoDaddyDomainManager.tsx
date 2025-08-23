/**
 * GoDaddy Domain Manager Component
 * Provides UI for managing domains through GoDaddy API
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { 
  Globe, 
  Settings, 
  Plus, 
  Search, 
  RefreshCw, 
  ExternalLink,
  Shield,
  Clock,
  Server
} from 'lucide-react';
import { GoDaddyDomain, DNSRecord, godaddyAPI } from '../lib/godaddy-api';

interface DomainManagerProps {
  className?: string;
}

export const GoDaddyDomainManager: React.FC<DomainManagerProps> = ({ className }) => {
  const [domains, setDomains] = useState<GoDaddyDomain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Load domains on component mount
  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    setLoading(true);
    setError('');
    
    try {
      const domainList = await godaddyAPI.getDomains();
      setDomains(domainList);
      
      if (domainList.length > 0 && !selectedDomain) {
        setSelectedDomain(domainList[0].domain);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  const loadDNSRecords = async (domain: string) => {
    if (!domain) return;
    
    setLoading(true);
    setError('');
    
    try {
      const records = await godaddyAPI.getDNSRecords(domain);
      setDnsRecords(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DNS records');
    } finally {
      setLoading(false);
    }
  };

  const searchDomains = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const domainSuggestions = await godaddyAPI.getDomainSuggestions(searchQuery, 10);
      setSuggestions(domainSuggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search domains');
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = async (domain: string) => {
    try {
      const result = await godaddyAPI.checkDomainAvailability(domain);
      return result;
    } catch (err) {
      console.error('Failed to check availability:', err);
      return { available: false };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDNSRecordIcon = (type: string) => {
    switch (type) {
      case 'A': return '🌐';
      case 'AAAA': return '🌐';
      case 'CNAME': return '🔗';
      case 'MX': return '📧';
      case 'TXT': return '📝';
      case 'NS': return '🏢';
      default: return '📋';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Globe className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Domain Manager</h2>
        </div>
        <Button onClick={loadDomains} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="domains" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="domains">My Domains</TabsTrigger>
          <TabsTrigger value="dns">DNS Management</TabsTrigger>
          <TabsTrigger value="search">Domain Search</TabsTrigger>
        </TabsList>

        {/* Domains Tab */}
        <TabsContent value="domains" className="space-y-4">
          <div className="grid gap-4">
            {domains.map((domain) => (
              <Card key={domain.domain} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{domain.domain}</CardTitle>
                    <Badge className={getStatusColor(domain.status)}>
                      {domain.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>Expires: {formatDate(domain.expires)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 text-gray-500" />
                      <span>Auto-renew: {domain.renewAuto ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-gray-500" />
                      <span>Privacy: {domain.privacy ? 'On' : 'Off'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Server className="h-4 w-4 text-gray-500" />
                      <span>Locked: {domain.locked ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                  
                  <Separator className="my-3" />
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Nameservers: {domain.nameServers?.slice(0, 2).join(', ')}
                      {domain.nameServers && domain.nameServers.length > 2 && '...'}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedDomain(domain.domain);
                        loadDNSRecords(domain.domain);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* DNS Management Tab */}
        <TabsContent value="dns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DNS Records</CardTitle>
              <CardDescription>
                {selectedDomain ? `Managing DNS for ${selectedDomain}` : 'Select a domain to manage DNS records'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDomain ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">DNS Records for {selectedDomain}</h3>
                    <Button 
                      onClick={() => loadDNSRecords(selectedDomain)} 
                      disabled={loading}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {dnsRecords.map((record, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{getDNSRecordIcon(record.type)}</span>
                          <div>
                            <div className="font-medium">
                              {record.type} {record.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {record.data}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          TTL: {record.ttl || 'default'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select a domain from the "My Domains" tab to manage DNS records
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domain Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Domain Search</CardTitle>
              <CardDescription>
                Search for available domains and get suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter domain name or keywords..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchDomains()}
                  />
                  <Button onClick={searchDomains} disabled={loading || !searchQuery.trim()}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>

                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Domain Suggestions</h3>
                    <div className="grid gap-2">
                      {suggestions.map((suggestion, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Globe className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">{suggestion}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => checkAvailability(suggestion)}
                            >
                              Check Availability
                            </Button>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
