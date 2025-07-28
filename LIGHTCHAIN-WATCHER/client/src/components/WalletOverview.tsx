import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

interface WalletOverviewProps {
  walletAddress: string;
}

export default function WalletOverview({ walletAddress }: WalletOverviewProps) {
  const { data: balance } = useQuery({
    queryKey: ['/api/wallet', walletAddress, 'balance'],
    enabled: !!walletAddress,
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/wallet', walletAddress, 'stats'],
    enabled: !!walletAddress,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ETH Balance Card */}
      <Card className="bg-crypto-surface border-crypto-surface-variant">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-crypto-text-muted text-sm font-medium">ETH Balance</h3>
            <i className="fab fa-ethereum text-crypto-primary text-lg"></i>
          </div>
          <div className="text-2xl font-bold mb-1">
            {balance ? `${parseFloat(balance.ethBalance).toFixed(4)} ETH` : '0.0000 ETH'}
          </div>
          <div className="text-crypto-text-muted text-sm">
            ${balance?.ethBalanceUSD || '0.00'}
          </div>
        </CardContent>
      </Card>
      
      {/* Tokens Detected Card */}
      <Card className="bg-crypto-surface border-crypto-surface-variant">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-crypto-text-muted text-sm font-medium">Tokens Detected</h3>
            <i className="fas fa-coins text-crypto-accent text-lg"></i>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats?.tokenCount || 0}
          </div>
          <div className="text-crypto-text-muted text-sm">Active monitoring</div>
        </CardContent>
      </Card>
      
      {/* Transfers Today Card */}
      <Card className="bg-crypto-surface border-crypto-surface-variant">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-crypto-text-muted text-sm font-medium">Transfers Today</h3>
            <i className="fas fa-exchange-alt text-crypto-secondary text-lg"></i>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats?.transfersToday || 0}
          </div>
          <div className="text-crypto-text-muted text-sm">
            ${stats?.totalValueToday || '0.00'} total
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
