import { web3Service } from './web3Service.js';

export interface GasStrategy {
  name: string;
  multiplier: number; // Multiplier for base gas price
  description: string;
}

export class GasOptimizer {
  private strategies: Map<string, GasStrategy> = new Map();
  private currentNetworkLoad: number = 0;

  constructor() {
    this.initializeStrategies();
    this.startNetworkMonitoring();
  }

  private initializeStrategies() {
    this.strategies.set('slow', {
      name: 'Slow',
      multiplier: 0.8,
      description: '20-30 gwei - Lower priority',
    });

    this.strategies.set('standard', {
      name: 'Standard',
      multiplier: 1.0,
      description: '30-50 gwei - Normal priority',
    });

    this.strategies.set('fast', {
      name: 'Fast',
      multiplier: 1.3,
      description: '50+ gwei - High priority',
    });
  }

  private startNetworkMonitoring() {
    // Monitor network congestion every minute
    setInterval(async () => {
      await this.updateNetworkLoad();
    }, 60000);

    // Initial update
    this.updateNetworkLoad().catch(console.error);
  }

  private async updateNetworkLoad() {
    try {
      const currentGasPrice = await web3Service.getGasPrice();
      const gasPriceGwei = parseFloat(currentGasPrice);
      
      // Simple network load calculation based on gas price
      // In reality, you'd use more sophisticated metrics
      if (gasPriceGwei < 20) {
        this.currentNetworkLoad = 25; // Low load
      } else if (gasPriceGwei < 50) {
        this.currentNetworkLoad = 50; // Medium load
      } else if (gasPriceGwei < 100) {
        this.currentNetworkLoad = 75; // High load
      } else {
        this.currentNetworkLoad = 95; // Very high load
      }

      console.log(`Network load updated: ${this.currentNetworkLoad}% (${gasPriceGwei} gwei)`);
    } catch (error) {
      console.error('Error updating network load:', error);
    }
  }

  async getOptimalGasPrice(strategy: string = 'standard', urgency: 'low' | 'medium' | 'high' = 'medium'): Promise<string> {
    try {
      const baseGasPrice = await web3Service.getGasPrice();
      const baseGasPriceGwei = parseFloat(baseGasPrice);
      
      const selectedStrategy = this.strategies.get(strategy) || this.strategies.get('standard')!;
      let gasPrice = baseGasPriceGwei * selectedStrategy.multiplier;

      // Adjust based on urgency
      switch (urgency) {
        case 'high':
          gasPrice *= 1.2;
          break;
        case 'low':
          gasPrice *= 0.9;
          break;
        // medium is default
      }

      // Adjust based on network congestion
      if (this.currentNetworkLoad > 80) {
        gasPrice *= 1.1; // Increase gas price during high congestion
      } else if (this.currentNetworkLoad < 30) {
        gasPrice *= 0.95; // Slightly reduce during low congestion
      }

      // Ensure minimum gas price
      const minGasPrice = 1; // 1 gwei minimum
      gasPrice = Math.max(gasPrice, minGasPrice);

      return gasPrice.toFixed(2);
    } catch (error) {
      console.error('Error calculating optimal gas price:', error);
      return '30'; // Fallback to 30 gwei
    }
  }

  async estimateTransactionCost(
    tokenAddress: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    gasStrategy: string = 'standard'
  ): Promise<{
    gasLimit: number;
    gasPrice: string;
    estimatedCostETH: string;
    estimatedCostUSD: string;
  }> {
    try {
      const gasLimit = await web3Service.estimateTransferGas(tokenAddress, fromAddress, toAddress, amount);
      const gasPrice = await this.getOptimalGasPrice(gasStrategy);
      
      // Calculate cost in ETH
      const gasCostWei = gasLimit * parseFloat(gasPrice) * 1e9; // Convert gwei to wei
      const gasCostETH = (gasCostWei / 1e18).toFixed(6);
      
      // Rough ETH price for USD calculation (in reality, fetch from price API)
      const ethPriceUSD = 2000; // Placeholder
      const gasCostUSD = (parseFloat(gasCostETH) * ethPriceUSD).toFixed(2);

      return {
        gasLimit,
        gasPrice,
        estimatedCostETH: gasCostETH,
        estimatedCostUSD: gasCostUSD,
      };
    } catch (error) {
      console.error('Error estimating transaction cost:', error);
      return {
        gasLimit: 21000,
        gasPrice: '30',
        estimatedCostETH: '0.00063',
        estimatedCostUSD: '1.26',
      };
    }
  }

  getNetworkLoad(): number {
    return this.currentNetworkLoad;
  }

  getAvailableStrategies(): GasStrategy[] {
    return Array.from(this.strategies.values());
  }

  async shouldDelayTransaction(gasStrategy: string): Promise<boolean> {
    // If using slow strategy and network is congested, suggest delay
    if (gasStrategy === 'slow' && this.currentNetworkLoad > 80) {
      return true;
    }
    
    return false;
  }

  async getRecommendedStrategy(): Promise<string> {
    if (this.currentNetworkLoad < 30) {
      return 'slow'; // Save on gas when network is quiet
    } else if (this.currentNetworkLoad > 80) {
      return 'fast'; // Use fast when network is congested
    }
    
    return 'standard'; // Default to standard
  }
}

export const gasOptimizer = new GasOptimizer();
