import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useEffect, useState } from "react";
import { type NetworkStatus as NetworkStatusType } from "@shared/schema";

export default function NetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatusType | null>(null);
  const { lastMessage } = useWebSocket();

  const { data: initialStatus, isLoading } = useQuery({
    queryKey: ['/api/network/status'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    if (initialStatus) {
      setNetworkStatus(initialStatus);
    }
  }, [initialStatus]);

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'network_status_updated') {
      setNetworkStatus(lastMessage.data);
    }
  }, [lastMessage]);

  const getLoadBarColor = (load: number) => {
    if (load < 30) return 'bg-crypto-secondary';
    if (load < 70) return 'bg-crypto-accent';
    return 'bg-crypto-error';
  };

  const getConnectionStatus = (status: string) => {
    switch (status) {
      case 'stable':
        return (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-crypto-secondary rounded-full"></div>
            <span className="text-sm text-crypto-secondary">Stable</span>
          </div>
        );
      case 'unstable':
        return (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-crypto-accent rounded-full animate-pulse"></div>
            <span className="text-sm text-crypto-accent">Unstable</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-crypto-error rounded-full"></div>
            <span className="text-sm text-crypto-error">Disconnected</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-crypto-text-muted rounded-full"></div>
            <span className="text-sm text-crypto-text-muted">Unknown</span>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-crypto-surface border-crypto-surface-variant">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-crypto-surface-variant rounded w-1/2"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 bg-crypto-surface-variant rounded w-1/3"></div>
                  <div className="h-3 bg-crypto-surface-variant rounded w-1/4"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-crypto-surface border-crypto-surface-variant">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <i className="fas fa-network-wired text-crypto-primary mr-2"></i>
          Network Status
        </h2>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-crypto-text-muted">Current Block</span>
            <span className="text-sm font-medium font-mono">
              {networkStatus?.currentBlock || 'N/A'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-crypto-text-muted">Gas Price</span>
            <span className="text-sm font-medium text-crypto-accent">
              {networkStatus?.gasPrice ? `${parseFloat(networkStatus.gasPrice).toFixed(0)} gwei` : 'N/A'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-crypto-text-muted">Network Load</span>
            <div className="flex items-center space-x-2">
              <div className="w-16 bg-crypto-surface-variant rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    networkStatus?.networkLoad 
                      ? getLoadBarColor(parseFloat(networkStatus.networkLoad))
                      : 'bg-crypto-surface-variant'
                  }`}
                  style={{ 
                    width: networkStatus?.networkLoad 
                      ? `${Math.min(parseFloat(networkStatus.networkLoad), 100)}%` 
                      : '0%' 
                  }}
                ></div>
              </div>
              <span className="text-sm">
                {networkStatus?.networkLoad 
                  ? `${Math.round(parseFloat(networkStatus.networkLoad))}%`
                  : '0%'
                }
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-crypto-text-muted">Connection</span>
            {getConnectionStatus(networkStatus?.connectionStatus || 'unknown')}
          </div>

          {networkStatus?.lastUpdated && (
            <div className="pt-2 border-t border-crypto-surface-variant">
              <div className="text-xs text-crypto-text-muted">
                Last updated: {new Date(networkStatus.lastUpdated).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
