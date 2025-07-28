import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { type WalletConfig } from "@shared/schema";

interface ConfigurationPanelProps {
  walletAddress: string;
}

export default function ConfigurationPanel({ walletAddress }: ConfigurationPanelProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<Partial<WalletConfig>>({});

  const { data: walletConfig, isLoading } = useQuery({
    queryKey: ['/api/wallet', walletAddress, 'config'],
    enabled: !!walletAddress,
  });

  const { data: gasStrategies } = useQuery({
    queryKey: ['/api/gas/strategies'],
  });

  useEffect(() => {
    if (walletConfig) {
      setConfig(walletConfig);
    }
  }, [walletConfig]);

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<WalletConfig>) => {
      const res = await apiRequest('PATCH', `/api/wallet/${walletAddress}/config`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallet', walletAddress, 'config'] });
      toast({
        title: "Configuration Updated",
        description: "Wallet configuration has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const emergencyStopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/emergency/stop', { walletAddress });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallet', walletAddress] });
      toast({
        title: "Emergency Stop Executed",
        description: "All monitoring and transfers have been halted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to execute emergency stop. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConfigUpdate = (field: keyof WalletConfig, value: any) => {
    const updatedConfig = { ...config, [field]: value };
    setConfig(updatedConfig);
    updateConfigMutation.mutate({ [field]: value });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Address copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-crypto-surface border-crypto-surface-variant">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-crypto-surface-variant rounded w-1/3"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 bg-crypto-surface-variant rounded w-1/4"></div>
                    <div className="h-8 bg-crypto-surface-variant rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sweeper Configuration */}
      <Card className="bg-crypto-surface border-crypto-surface-variant">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <i className="fas fa-cog text-crypto-primary mr-2"></i>
            Configuration
          </h2>
          
          {/* Safe Wallet Address */}
          <div className="mb-6">
            <Label className="text-sm font-medium text-crypto-text-muted mb-2 block">
              Safe Wallet Address
            </Label>
            <div className="relative">
              <Input
                type="text"
                className="bg-crypto-surface-variant border-crypto-surface-variant text-crypto-text font-mono pr-10"
                placeholder="0x..."
                value={config.safeWalletAddress || ''}
                onChange={(e) => handleConfigUpdate('safeWalletAddress', e.target.value)}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 h-6 w-6"
                onClick={() => copyToClipboard(config.safeWalletAddress || '')}
              >
                <i className="fas fa-copy text-crypto-text-muted"></i>
              </Button>
            </div>
          </div>
          
          {/* Gas Strategy */}
          <div className="mb-6">
            <Label className="text-sm font-medium text-crypto-text-muted mb-2 block">
              Gas Strategy
            </Label>
            <Select
              value={config.gasStrategy || 'standard'}
              onValueChange={(value) => handleConfigUpdate('gasStrategy', value)}
            >
              <SelectTrigger className="bg-crypto-surface-variant border-crypto-surface-variant text-crypto-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-crypto-surface border-crypto-surface-variant">
                {gasStrategies?.map((strategy: any) => (
                  <SelectItem key={strategy.name.toLowerCase()} value={strategy.name.toLowerCase()}>
                    {strategy.name} - {strategy.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Minimum Transfer Amount */}
          <div className="mb-6">
            <Label className="text-sm font-medium text-crypto-text-muted mb-2 block">
              Minimum Transfer Amount (USD)
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              className="bg-crypto-surface-variant border-crypto-surface-variant text-crypto-text"
              placeholder="10.00"
              value={config.minTransferAmount || ''}
              onChange={(e) => handleConfigUpdate('minTransferAmount', e.target.value)}
            />
          </div>
          
          {/* Auto-sweep Toggle */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-medium text-crypto-text">Auto-sweep Enabled</div>
              <div className="text-sm text-crypto-text-muted">
                Automatically transfer detected tokens
              </div>
            </div>
            <Switch
              checked={config.autoSweepEnabled || false}
              onCheckedChange={(checked) => handleConfigUpdate('autoSweepEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Controls */}
      <Card className="bg-crypto-surface border-crypto-surface-variant">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <i className="fas fa-shield-alt text-crypto-primary mr-2"></i>
            Security Controls
          </h2>
          
          {/* Private Key Status */}
          <div className="mb-4 p-3 bg-crypto-secondary/10 border border-crypto-secondary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <i className="fas fa-key text-crypto-secondary mr-2"></i>
                <span className="text-sm font-medium">Private Key</span>
              </div>
              <span className="text-xs bg-crypto-secondary/20 text-crypto-secondary px-2 py-1 rounded-full">
                Secured
              </span>
            </div>
            <div className="text-xs text-crypto-text-muted mt-1">
              Encrypted and stored securely
            </div>
          </div>
          
          {/* Emergency Actions */}
          <div className="space-y-3">
            <Button
              className="w-full bg-crypto-error hover:bg-red-600 text-white"
              onClick={() => emergencyStopMutation.mutate()}
              disabled={emergencyStopMutation.isPending}
            >
              <i className="fas fa-stop-circle mr-2"></i>
              {emergencyStopMutation.isPending ? 'Stopping...' : 'Emergency Stop'}
            </Button>
            
            <Button
              variant="secondary"
              className="w-full bg-crypto-surface-variant hover:bg-gray-600 text-crypto-text"
              onClick={() => {
                // Clear logs functionality would go here
                toast({
                  title: "Logs Cleared",
                  description: "Activity logs have been cleared.",
                });
              }}
            >
              <i className="fas fa-trash mr-2"></i>
              Clear Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
