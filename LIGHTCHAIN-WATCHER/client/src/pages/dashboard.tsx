import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";

import WalletOverview from "@/components/WalletOverview";
import ActivityFeed from "@/components/ActivityFeed";
import TransactionHistory from "@/components/TransactionHistory";
import ConfigurationPanel from "@/components/ConfigurationPanel";
import NetworkStatus from "@/components/NetworkStatus";
import { SpecificTokenMonitor } from "@/components/SpecificTokenMonitor";

export default function Dashboard() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [networkSelection, setNetworkSelection] = useState<string>('mainnet');
  const [emergencyModalOpen, setEmergencyModalOpen] = useState<boolean>(false);
  
  const { toast } = useToast();
  const { isConnected } = useWebSocket(walletAddress);

  const setupWalletMutation = useMutation({
    mutationFn: async (config: {
      walletAddress: string;
      privateKey: string;
      safeWalletAddress: string;
    }) => {
      const res = await apiRequest('POST', '/api/wallet/config', config);
      return res.json();
    },
    onSuccess: (data) => {
      setWalletAddress(data.walletAddress);
      setIsConfigured(true);
      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
      toast({
        title: "Wallet Configured",
        description: "Ethereum sweeper is now monitoring your wallet.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to configure wallet. Please check your inputs.",
        variant: "destructive",
      });
    },
  });

  const emergencyStopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/emergency/stop', {});
      return res.json();
    },
    onSuccess: () => {
      setIsConfigured(false);
      setWalletAddress('');
      setEmergencyModalOpen(false);
      toast({
        title: "Emergency Stop Executed",
        description: "All monitoring and transfers have been halted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to execute emergency stop.",
        variant: "destructive",
      });
    },
  });

  const handleWalletSetup = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const config = {
      walletAddress: formData.get('walletAddress') as string,
      privateKey: formData.get('privateKey') as string,
      safeWalletAddress: formData.get('safeWalletAddress') as string,
      gasStrategy: 'standard',
      minTransferAmount: '10.00',
      autoSweepEnabled: true,
      isActive: true,
    };

    setupWalletMutation.mutate(config);
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-crypto-bg">
        {/* Header */}
        <header className="bg-crypto-surface border-b border-crypto-surface-variant">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-shield-alt text-crypto-primary text-2xl"></i>
              <h1 className="text-xl font-bold text-crypto-text">Ethereum Sweeper</h1>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-6 py-12">
          <div className="max-w-md mx-auto">
            <Card className="bg-crypto-surface border-crypto-surface-variant">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <i className="fas fa-wallet text-crypto-primary text-3xl mb-4"></i>
                  <h2 className="text-xl font-bold text-crypto-text mb-2">Configure Your Wallet</h2>
                  <p className="text-crypto-text-muted text-sm">
                    Set up your Ethereum wallet for automatic token sweeping
                  </p>
                </div>

                <Alert className="mb-4 border-crypto-accent/20 bg-crypto-accent/10">
                  <i className="fas fa-exclamation-triangle text-crypto-accent"></i>
                  <AlertDescription className="text-crypto-text">
                    Your private key is encrypted and stored securely. Never share it with anyone.
                  </AlertDescription>
                </Alert>

                <form onSubmit={handleWalletSetup} className="space-y-4">
                  <div>
                    <Label className="text-crypto-text-muted">Wallet Address to Monitor</Label>
                    <Input
                      name="walletAddress"
                      type="text"
                      placeholder="0x..."
                      className="bg-crypto-surface-variant border-crypto-surface-variant text-crypto-text font-mono"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-crypto-text-muted">Private Key</Label>
                    <Input
                      name="privateKey"
                      type="password"
                      placeholder="Private key for wallet access"
                      className="bg-crypto-surface-variant border-crypto-surface-variant text-crypto-text font-mono"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-crypto-text-muted">Safe Wallet Address</Label>
                    <Input
                      name="safeWalletAddress"
                      type="text"
                      placeholder="0x..."
                      className="bg-crypto-surface-variant border-crypto-surface-variant text-crypto-text font-mono"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-crypto-text-muted">Network</Label>
                    <Select value={networkSelection} onValueChange={setNetworkSelection}>
                      <SelectTrigger className="bg-crypto-surface-variant border-crypto-surface-variant text-crypto-text">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-crypto-surface border-crypto-surface-variant">
                        <SelectItem value="mainnet">Ethereum Mainnet</SelectItem>
                        <SelectItem value="goerli">Goerli Testnet</SelectItem>
                        <SelectItem value="sepolia">Sepolia Testnet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-crypto-primary hover:bg-blue-600"
                    disabled={setupWalletMutation.isPending}
                  >
                    {setupWalletMutation.isPending ? (
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                    ) : (
                      <i className="fas fa-play mr-2"></i>
                    )}
                    {setupWalletMutation.isPending ? 'Setting up...' : 'Start Monitoring'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-crypto-bg">
      {/* Header Navigation */}
      <header className="bg-crypto-surface border-b border-crypto-surface-variant">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <i className="fas fa-shield-alt text-crypto-primary text-2xl"></i>
                <h1 className="text-xl font-bold text-crypto-text">Ethereum Sweeper</h1>
              </div>
              <span className="bg-crypto-secondary/20 text-crypto-secondary px-2 py-1 rounded-full text-xs font-medium">
                <i className="fas fa-circle text-crypto-secondary mr-1"></i>
                Active
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Wallet Connection Status */}
              <div className="flex items-center space-x-2 bg-crypto-surface-variant px-3 py-2 rounded-lg">
                <i className="fas fa-wallet text-crypto-secondary"></i>
                <span className="text-sm font-medium font-mono">
                  {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'Not connected'}
                </span>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-crypto-secondary animate-pulse' : 'bg-crypto-error'}`}></div>
              </div>
              
              {/* Network Selector */}
              <Select value={networkSelection} onValueChange={setNetworkSelection}>
                <SelectTrigger className="bg-crypto-surface-variant border-crypto-surface-variant text-crypto-text w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-crypto-surface border-crypto-surface-variant">
                  <SelectItem value="mainnet">Ethereum Mainnet</SelectItem>
                  <SelectItem value="goerli">Goerli Testnet</SelectItem>
                  <SelectItem value="sepolia">Sepolia Testnet</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Emergency Stop */}
              <Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="bg-crypto-error hover:bg-red-600">
                    <i className="fas fa-stop-circle mr-2"></i>
                    Emergency Stop
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-crypto-surface border-crypto-surface-variant">
                  <DialogHeader>
                    <DialogTitle className="text-crypto-text flex items-center">
                      <i className="fas fa-exclamation-triangle text-crypto-error mr-2"></i>
                      Emergency Stop
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-crypto-text-muted">
                      This will immediately halt all monitoring and pending transactions. Are you sure you want to continue?
                    </p>
                    <div className="flex space-x-3">
                      <Button
                        variant="outline"
                        onClick={() => setEmergencyModalOpen(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => emergencyStopMutation.mutate()}
                        disabled={emergencyStopMutation.isPending}
                        className="flex-1 bg-crypto-error hover:bg-red-600"
                      >
                        {emergencyStopMutation.isPending ? 'Stopping...' : 'Stop Now'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Top Row - Overview and Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WalletOverview walletAddress={walletAddress} />
            <NetworkStatus />
          </div>

          {/* Specific Token Monitor - Full Width */}
          <SpecificTokenMonitor walletAddress={walletAddress} />

          {/* Bottom Row - Activity and Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <ActivityFeed walletAddress={walletAddress} />
              <TransactionHistory walletAddress={walletAddress} />
            </div>

            {/* Configuration Sidebar */}
            <div className="space-y-6">
              <ConfigurationPanel walletAddress={walletAddress} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
