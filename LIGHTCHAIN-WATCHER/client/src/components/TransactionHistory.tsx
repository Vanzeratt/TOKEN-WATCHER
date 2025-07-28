import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useEffect, useState } from "react";
import { type Transaction } from "@shared/schema";

interface TransactionHistoryProps {
  walletAddress: string;
}

export default function TransactionHistory({ walletAddress }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { lastMessage } = useWebSocket(walletAddress);

  const { data: initialTransactions, isLoading } = useQuery({
    queryKey: ['/api/wallet', walletAddress, 'transactions'],
    enabled: !!walletAddress,
  });

  useEffect(() => {
    if (initialTransactions) {
      setTransactions(initialTransactions);
    }
  }, [initialTransactions]);

  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'new_transaction':
          setTransactions(prev => [lastMessage.data, ...prev]);
          break;
        case 'transaction_updated':
          setTransactions(prev => 
            prev.map(tx => 
              tx.id === lastMessage.data.id ? lastMessage.data : tx
            )
          );
          break;
      }
    }
  }, [lastMessage]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-crypto-secondary/20 text-crypto-secondary">
            <i className="fas fa-check-circle mr-1"></i>
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-crypto-accent/20 text-crypto-accent">
            <i className="fas fa-clock mr-1"></i>
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-crypto-error/20 text-crypto-error">
            <i className="fas fa-times-circle mr-1"></i>
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-crypto-surface-variant text-crypto-text-muted">
            Unknown
          </span>
        );
    }
  };

  const getTokenIcon = (symbol: string) => {
    const colors = {
      'USDC': 'bg-blue-500',
      'LINK': 'bg-blue-600',
      'UNI': 'bg-purple-500',
      'WBTC': 'bg-orange-500',
      'AAVE': 'bg-purple-600',
    };
    
    return colors[symbol as keyof typeof colors] || 'bg-gray-500';
  };

  const formatTimeAgo = (date: Date | string | null) => {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const txDate = typeof date === 'string' ? new Date(date) : date;
    const diffInSeconds = Math.floor((now.getTime() - txDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const truncateHash = (hash: string | null) => {
    if (!hash) return 'N/A';
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
  };

  if (isLoading) {
    return (
      <Card className="bg-crypto-surface border-crypto-surface-variant">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-crypto-surface-variant rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-crypto-surface-variant rounded"></div>
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
            <i className="fas fa-history text-crypto-primary mr-2"></i>
            Transaction History
          </h2>
          <Button variant="ghost" size="sm" className="text-crypto-primary hover:text-blue-400">
            View All
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        {transactions.length === 0 ? (
          <div className="p-6 text-center">
            <i className="fas fa-receipt text-crypto-text-muted text-2xl mb-2"></i>
            <p className="text-crypto-text-muted">No transactions yet</p>
            <p className="text-sm text-crypto-text-muted">
              Token transfers will appear here
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-crypto-surface-variant">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-crypto-text-muted uppercase tracking-wider">
                  Token
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-crypto-text-muted uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-crypto-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-crypto-text-muted uppercase tracking-wider">
                  Gas Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-crypto-text-muted uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-crypto-text-muted uppercase tracking-wider">
                  Tx Hash
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-crypto-surface-variant">
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-crypto-surface-variant transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 ${getTokenIcon(tx.tokenSymbol)} rounded-full flex items-center justify-center text-xs font-bold mr-3`}>
                        {tx.tokenSymbol.substring(0, 3)}
                      </div>
                      <span className="font-medium">{tx.tokenName || tx.tokenSymbol}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium">
                      {parseFloat(tx.amount).toFixed(4)} {tx.tokenSymbol}
                    </div>
                    <div className="text-sm text-crypto-text-muted">
                      ${tx.amountUSD || '0.00'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(tx.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>
                      {tx.gasUsed ? `${parseFloat(tx.gasUsed).toFixed(6)} ETH` : 'N/A'}
                    </div>
                    <div className="text-crypto-text-muted">
                      {tx.gasPrice ? `${parseFloat(tx.gasPrice).toFixed(0)} gwei` : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-crypto-text-muted">
                    {formatTimeAgo(tx.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tx.txHash ? (
                      <a
                        href={`https://etherscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-crypto-primary hover:text-blue-400 text-sm font-mono"
                      >
                        {truncateHash(tx.txHash)}
                        <i className="fas fa-external-link-alt ml-1"></i>
                      </a>
                    ) : (
                      <span className="text-crypto-text-muted text-sm">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
