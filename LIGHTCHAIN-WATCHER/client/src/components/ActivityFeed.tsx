import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useEffect, useState } from "react";
import { type Activity } from "@shared/schema";

interface ActivityFeedProps {
  walletAddress: string;
}

export default function ActivityFeed({ walletAddress }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const { lastMessage } = useWebSocket(walletAddress);

  const { data: initialActivities, isLoading } = useQuery({
    queryKey: ['/api/wallet', walletAddress, 'activities'],
    enabled: !!walletAddress,
  });

  useEffect(() => {
    if (initialActivities) {
      setActivities(initialActivities);
    }
  }, [initialActivities]);

  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'new_activity':
          setActivities(prev => [lastMessage.data, ...prev.slice(0, 19)]);
          break;
        case 'wallet_config_updated':
        case 'transaction_updated':
        case 'manual_sweep_initiated':
          // Refresh activities when these events occur
          break;
      }
    }
  }, [lastMessage]);

  const getActivityIcon = (type: string, status: string) => {
    switch (type) {
      case 'token_detected':
        return <i className="fas fa-search text-crypto-primary"></i>;
      case 'trading_enabled':
        return <i className="fas fa-chart-line text-crypto-secondary"></i>;
      case 'transfer_started':
      case 'transfer_completed':
        return <i className="fas fa-arrow-right text-crypto-secondary"></i>;
      case 'transfer_failed':
        return <i className="fas fa-exclamation-triangle text-crypto-error"></i>;
      default:
        return <i className="fas fa-circle text-crypto-primary"></i>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-crypto-secondary';
      case 'pending':
        return 'text-crypto-accent';
      case 'failed':
        return 'text-crypto-error';
      case 'active':
        return 'text-crypto-primary';
      default:
        return 'text-crypto-text-muted';
    }
  };

  const formatTimeAgo = (date: Date | string | null) => {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const activityDate = typeof date === 'string' ? new Date(date) : date;
    const diffInSeconds = Math.floor((now.getTime() - activityDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  if (isLoading) {
    return (
      <Card className="bg-crypto-surface border-crypto-surface-variant">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-crypto-surface-variant rounded w-1/3"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex space-x-4">
                  <div className="w-10 h-10 bg-crypto-surface-variant rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-crypto-surface-variant rounded w-3/4"></div>
                    <div className="h-3 bg-crypto-surface-variant rounded w-1/2"></div>
                  </div>
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
      <div className="p-6 border-b border-crypto-surface-variant">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <i className="fas fa-activity text-crypto-primary mr-2"></i>
            Live Activity Feed
          </h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-crypto-secondary rounded-full animate-pulse"></div>
            <span className="text-sm text-crypto-text-muted">Live</span>
          </div>
        </div>
      </div>
      
      <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <i className="fas fa-search text-crypto-text-muted text-2xl mb-2"></i>
            <p className="text-crypto-text-muted">No recent activity</p>
            <p className="text-sm text-crypto-text-muted">
              Token detections and transfers will appear here
            </p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center space-x-4 p-4 bg-crypto-surface-variant rounded-lg"
            >
              <div className="w-10 h-10 bg-crypto-secondary/20 rounded-full flex items-center justify-center">
                {getActivityIcon(activity.type, activity.status)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{activity.title}</div>
                    <div className="text-sm text-crypto-text-muted">{activity.description}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium capitalize ${getStatusColor(activity.status)}`}>
                      {activity.status}
                    </div>
                    <div className="text-xs text-crypto-text-muted">
                      {formatTimeAgo(activity.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
