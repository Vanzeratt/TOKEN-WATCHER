import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Target, Plus, Trash2, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SpecificTokenMonitorProps {
  walletAddress: string;
}

export function SpecificTokenMonitor({ walletAddress }: SpecificTokenMonitorProps) {
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sweepStatus } = useQuery({
    queryKey: ['/api/wallet', walletAddress, 'sweep-status'],
    refetchInterval: 5000 // Update every 5 seconds
  });

  const addTokenMutation = useMutation({
    mutationFn: async (tokenAddress: string) => {
      return apiRequest('/api/wallet/' + walletAddress + '/tokens/monitor', 'POST', {
        tokenAddress
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Token Added to Monitoring",
        description: `Successfully added token to specific monitoring list`,
      });
      setNewTokenAddress('');
      queryClient.invalidateQueries({ queryKey: ['/api/wallet', walletAddress, 'tokens'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Adding Token",
        description: error.message || "Failed to add token to monitoring",
        variant: "destructive",
      });
    }
  });

  const removeTokenMutation = useMutation({
    mutationFn: async (tokenAddress: string) => {
      return apiRequest(`/api/wallet/${walletAddress}/tokens/${tokenAddress}/monitor`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "Token Removed",
        description: "Token removed from specific monitoring",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet', walletAddress, 'tokens'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Removing Token",
        description: error.message || "Failed to remove token from monitoring",
        variant: "destructive",
      });
    }
  });

  const manualSweepMutation = useMutation({
    mutationFn: async ({ tokenAddress, urgency }: { tokenAddress: string, urgency: string }) => {
      return apiRequest(`/api/wallet/${walletAddress}/tokens/${tokenAddress}/sweep`, 'POST', {
        urgency
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Manual Sweep Initiated",
        description: `Started transferring ${data.tokenSymbol || 'tokens'} to safe wallet`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet', walletAddress, 'transactions'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sweep Failed",
        description: error.message || "Failed to initiate token sweep",
        variant: "destructive",
      });
    }
  });

  const handleAddToken = () => {
    if (!newTokenAddress.trim()) {
      toast({
        title: "Invalid Token Address",
        description: "Please enter a valid token contract address",
        variant: "destructive",
      });
      return;
    }

    // Basic Ethereum address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(newTokenAddress.trim())) {
      toast({
        title: "Invalid Address Format",
        description: "Please enter a valid Ethereum contract address (0x...)",
        variant: "destructive",
      });
      return;
    }

    addTokenMutation.mutate(newTokenAddress.trim());
  };

  const { data: tokenDetections = [] } = useQuery({
    queryKey: ['/api/wallet', walletAddress, 'tokens'],
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const specificTokens = (tokenDetections as any[]).filter((token: any) => 
    parseFloat(token.balance) > 0
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Target className="h-5 w-5 text-blue-500" />
          <CardTitle>Specific Token Monitor</CardTitle>
        </div>
        <CardDescription>
          Monitor specific tokens that currently have trading disabled. 
          The system will automatically transfer all tokens immediately when trading becomes enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {(sweepStatus as any)?.activeSweeps || 0}
            </div>
            <div className="text-sm text-muted-foreground">Active Sweeps</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {(sweepStatus as any)?.pendingTransactions || 0}
            </div>
            <div className="text-sm text-muted-foreground">Pending Transfers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {specificTokens.length}
            </div>
            <div className="text-sm text-muted-foreground">Monitored Tokens</div>
          </div>
        </div>

        <Separator />

        {/* Add New Token */}
        <div className="space-y-3">
          <h4 className="font-semibold">Add Token to Monitor</h4>
          <div className="flex space-x-2">
            <Input
              placeholder="Enter token contract address (0x...)"
              value={newTokenAddress}
              onChange={(e) => setNewTokenAddress(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleAddToken}
              disabled={addTokenMutation.isPending}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              {addTokenMutation.isPending ? 'Adding...' : 'Add Token'}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Monitored Tokens List */}
        <div className="space-y-3">
          <h4 className="font-semibold">Currently Monitored Tokens</h4>
          
          {specificTokens.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No tokens currently being monitored. Add a token address above to start monitoring for trading status changes.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {specificTokens.map((token: any) => (
                <Card key={token.id} className="border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">{token.tokenSymbol}</span>
                          <Badge variant={token.tradingEnabled ? "default" : "secondary"}>
                            {token.tradingEnabled ? (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 mr-1" />
                            )}
                            {token.tradingEnabled ? 'Trading Active' : 'Trading Disabled'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {token.tokenName}
                        </div>
                        <div className="text-sm">
                          Balance: <span className="font-mono">{parseFloat(token.balance).toFixed(6)}</span> {token.tokenSymbol}
                          {token.balanceUSD && (
                            <span className="ml-2 text-muted-foreground">
                              (${parseFloat(token.balanceUSD).toFixed(2)})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {token.tokenAddress}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {token.tradingEnabled && (
                          <Button
                            size="sm"
                            onClick={() => manualSweepMutation.mutate({ 
                              tokenAddress: token.tokenAddress, 
                              urgency: 'high' 
                            })}
                            disabled={manualSweepMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            Sweep Now
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeTokenMutation.mutate(token.tokenAddress)}
                          disabled={removeTokenMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Important Notice */}
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Important:</strong> The system monitors tokens every 15 seconds for trading status changes. 
            When trading becomes enabled, ALL tokens will be immediately transferred to your safe wallet using optimized gas settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}