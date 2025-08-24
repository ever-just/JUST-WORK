/**
 * GoDaddy Domain Manager Component
 * Temporarily disabled - will be restored after deployment
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Globe } from 'lucide-react';

interface DomainManagerProps {
  className?: string;
}

export const GoDaddyDomainManager: React.FC<DomainManagerProps> = ({ className }) => {
  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            GoDaddy Domain Manager
          </CardTitle>
          <CardDescription>
            Domain management interface
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              GoDaddy Domain Manager is temporarily disabled during deployment setup.
              This feature will be restored once the application is successfully deployed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};