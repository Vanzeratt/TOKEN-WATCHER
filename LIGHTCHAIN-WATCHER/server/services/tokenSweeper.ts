import { web3Service } from './web3Service.js';
import { gasOptimizer } from './gasOptimizer.js';
import { storage } from '../storage.js';
import { type InsertTransaction, type InsertActivity } from '@shared/schema';

export class TokenSweeper {
  private activeSweeps: Map<string, boolean> = new Map();
  private broadcastCallback?: (data: any, walletAddress?: string) => void;

  setBroadcastCallback(callback: (data: any, walletAddress?: string) => void) {
    this.broadcastCallback = callback;
  }

  async sweepToken(
    walletAddress: string,
    tokenAddress: string,
    tokenSymbol: string,
    tokenName: string,
    balance: string,
    urgency: 'low' | 'medium' | 'high' = 'high'
  ): Promise<string | null> {
    const sweepKey = `${walletAddress}-${tokenAddress}`;
    
    // Prevent duplicate simultaneous sweeps
    if (this.activeSweeps.get(sweepKey)) {
      console.log(`Sweep already in progress for ${tokenSymbol} in wallet ${walletAddress}`);
      return null;
    }

    this.activeSweeps.set(sweepKey, true);

    try {
      // Get wallet configuration
      const walletConfig = await storage.getWalletConfig(walletAddress);
      if (!walletConfig || !walletConfig.isActive) {
        throw new Error('Wallet not configured or inactive');
      }

      // Check minimum transfer amount
      const balanceUSD = await this.getTokenValueUSD(tokenAddress, balance);
      const minTransferUSD = parseFloat(walletConfig.minTransferAmount);
      
      if (balanceUSD < minTransferUSD) {
        console.log(`Token value $${balanceUSD} below minimum threshold $${minTransferUSD}`);
        return null;
      }

      // Get optimal gas price based on urgency
      const gasPrice = await gasOptimizer.getOptimalGasPrice(walletConfig.gasStrategy, urgency);

      // Create transaction record
      const transaction = await storage.createTransaction({
        walletAddress,
        tokenAddress,
        tokenSymbol,
        tokenName,
        amount: balance,
        amountUSD: balanceUSD.toFixed(2),
        status: 'pending',
        gasPrice,
      });

      // Log sweep initiation
      await storage.createActivity({
        walletAddress,
        type: 'transfer_started',
        title: `${tokenSymbol} Auto-Sweep Started`,
        description: `Transferring ${balance} ${tokenSymbol} ($${balanceUSD.toFixed(2)}) to safe wallet`,
        status: 'pending',
        metadata: {
          tokenAddress,
          amount: balance,
          estimatedValueUSD: balanceUSD,
          gasStrategy: walletConfig.gasStrategy,
          urgency
        },
      });

      // Broadcast real-time update
      this.broadcastCallback?.({
        type: 'sweep_initiated',
        data: {
          transactionId: transaction.id,
          tokenSymbol,
          amount: balance,
          status: 'pending'
        }
      }, walletAddress);

      // Execute the transfer
      const txHash = await web3Service.transferToken(
        walletConfig.privateKey,
        tokenAddress,
        walletConfig.safeWalletAddress,
        balance,
        gasPrice
      );

      // Update transaction with hash
      await storage.updateTransaction(transaction.id, {
        txHash,
        status: 'completed',
      });

      // Log successful sweep
      await storage.createActivity({
        walletAddress,
        type: 'transfer_completed',
        title: `${tokenSymbol} Transfer Completed`,
        description: `Successfully transferred ${balance} ${tokenSymbol} to safe wallet`,
        status: 'completed',
        metadata: {
          tokenAddress,
          txHash,
          amount: balance,
          gasUsed: 'pending'
        },
      });

      // Broadcast completion
      this.broadcastCallback?.({
        type: 'sweep_completed',
        data: {
          transactionId: transaction.id,
          txHash,
          tokenSymbol,
          amount: balance,
          status: 'completed'
        }
      }, walletAddress);

      console.log(`✅ Successfully swept ${balance} ${tokenSymbol} from ${walletAddress}`);
      console.log(`📋 Transaction hash: ${txHash}`);

      // Start monitoring transaction receipt
      this.monitorTransactionReceipt(transaction.id, txHash, walletAddress);

      return txHash;

    } catch (error) {
      console.error(`❌ Error sweeping ${tokenSymbol} from ${walletAddress}:`, error);

      // Update transaction status to failed
      const transactions = await storage.getTransactionsByStatus('pending');
      const failedTx = transactions.find(tx => 
        tx.walletAddress === walletAddress && 
        tx.tokenAddress === tokenAddress
      );

      if (failedTx) {
        await storage.updateTransaction(failedTx.id, {
          status: 'failed',
        });

        // Log failed sweep
        await storage.createActivity({
          walletAddress,
          type: 'transfer_failed',
          title: `${tokenSymbol} Transfer Failed`,
          description: `Failed to transfer ${balance} ${tokenSymbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'failed',
          metadata: {
            tokenAddress,
            error: error instanceof Error ? error.message : 'Unknown error',
            amount: balance
          },
        });

        // Broadcast failure
        this.broadcastCallback?.({
          type: 'sweep_failed',
          data: {
            transactionId: failedTx.id,
            tokenSymbol,
            amount: balance,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }, walletAddress);
      }

      return null;
    } finally {
      this.activeSweeps.delete(sweepKey);
    }
  }

  private async monitorTransactionReceipt(transactionId: string, txHash: string, walletAddress: string) {
    try {
      // Poll for transaction receipt
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes maximum
      
      const checkReceipt = async () => {
        try {
          const receipt = await web3Service.getTransactionReceipt(txHash);
          
          if (receipt) {
            const gasUsed = Number(receipt.gasUsed);
            const gasPrice = Number(receipt.gasPrice || 0);
            const gasCostETH = (gasUsed * gasPrice / 1e18).toFixed(6);

            // Update transaction with gas details
            await storage.updateTransaction(transactionId, {
              gasUsed: gasCostETH,
              blockNumber: receipt.blockNumber?.toString(),
              status: receipt.status ? 'completed' : 'failed',
            });

            // Broadcast final status
            this.broadcastCallback?.({
              type: 'transaction_receipt',
              data: {
                transactionId,
                txHash,
                gasUsed: gasCostETH,
                blockNumber: receipt.blockNumber,
                status: receipt.status ? 'completed' : 'failed'
              }
            }, walletAddress);

            console.log(`📊 Transaction ${txHash} confirmed in block ${receipt.blockNumber}`);
            console.log(`⛽ Gas used: ${gasCostETH} ETH`);
            
            return;
          }

          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkReceipt, 5000); // Check again in 5 seconds
          } else {
            console.log(`⏰ Transaction ${txHash} not confirmed after ${maxAttempts} attempts`);
          }
        } catch (error) {
          console.error(`Error checking transaction receipt for ${txHash}:`, error);
        }
      };

      // Start monitoring after a short delay
      setTimeout(checkReceipt, 10000); // Wait 10 seconds before first check
    } catch (error) {
      console.error(`Error setting up transaction monitoring for ${txHash}:`, error);
    }
  }

  private async getTokenValueUSD(tokenAddress: string, balance: string): Promise<number> {
    try {
      // In a real implementation, you'd fetch from a price API like CoinGecko
      // For now, using simple mock pricing based on known tokens
      const mockPrices: { [key: string]: number } = {
        '0xa0b86a33e6441b56c6b15fb8b0beaddd8f1af6c4': 1.00, // USDC
        '0x514910771af9ca656af840dff83e8264ecf986ca': 14.50, // LINK
        '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 6.80, // UNI
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 45000, // WBTC
        '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 85.30, // AAVE
      };

      const price = mockPrices[tokenAddress.toLowerCase()] || 0;
      return parseFloat(balance) * price;
    } catch (error) {
      console.error(`Error calculating USD value for token ${tokenAddress}:`, error);
      return 0;
    }
  }

  // Emergency stop all active sweeps
  async emergencyStop(walletAddress?: string): Promise<void> {
    if (walletAddress) {
      // Stop sweeps for specific wallet
      for (const [key] of this.activeSweeps.entries()) {
        if (key.startsWith(walletAddress)) {
          this.activeSweeps.delete(key);
        }
      }
      console.log(`🛑 Emergency stop executed for wallet ${walletAddress}`);
    } else {
      // Stop all sweeps
      this.activeSweeps.clear();
      console.log('🛑 Emergency stop executed for all wallets');
    }
  }

  getActiveSweepCount(walletAddress?: string): number {
    if (walletAddress) {
      let count = 0;
      for (const [key] of this.activeSweeps.entries()) {
        if (key.startsWith(walletAddress)) {
          count++;
        }
      }
      return count;
    }
    return this.activeSweeps.size;
  }
}

export const tokenSweeper = new TokenSweeper();