import { web3Service } from './web3Service.js';
import { tokenSweeper } from './tokenSweeper.js';
import { storage } from '../storage.js';
import { type InsertTokenDetection, type InsertActivity } from '@shared/schema';

interface TokenPrice {
  [address: string]: number;
}

export class TokenDetector {
  private monitoringWallets: Set<string> = new Set();
  private knownTokens: Map<string, { name: string; symbol: string }> = new Map();
  private tokenPrices: TokenPrice = {};
  private broadcastCallback?: (data: any, walletAddress?: string) => void;
  private specificTokensToMonitor: Map<string, string[]> = new Map(); // wallet -> token addresses

  constructor() {
    this.initializeKnownTokens();
    this.startPriceUpdates();
  }

  setBroadcastCallback(callback: (data: any, walletAddress?: string) => void) {
    this.broadcastCallback = callback;
    tokenSweeper.setBroadcastCallback(callback);
  }

  // Add specific token to monitor for a wallet
  addSpecificTokenToMonitor(walletAddress: string, tokenAddress: string) {
    const tokens = this.specificTokensToMonitor.get(walletAddress) || [];
    if (!tokens.includes(tokenAddress.toLowerCase())) {
      tokens.push(tokenAddress.toLowerCase());
      this.specificTokensToMonitor.set(walletAddress, tokens);
      console.log(`🎯 Added specific token ${tokenAddress} to monitoring for wallet ${walletAddress}`);
    }
  }

  // Remove specific token from monitoring
  removeSpecificTokenFromMonitor(walletAddress: string, tokenAddress: string) {
    const tokens = this.specificTokensToMonitor.get(walletAddress) || [];
    const index = tokens.indexOf(tokenAddress.toLowerCase());
    if (index > -1) {
      tokens.splice(index, 1);
      this.specificTokensToMonitor.set(walletAddress, tokens);
      console.log(`🚫 Removed specific token ${tokenAddress} from monitoring for wallet ${walletAddress}`);
    }
  }

  private initializeKnownTokens() {
    // Popular ERC-20 tokens
    const tokens = [
      { address: '0xA0b86a33E6441b56C6B15fb8b0BeaDDD8F1aF6c4', name: 'USD Coin', symbol: 'USDC' },
      { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', name: 'Chainlink', symbol: 'LINK' },
      { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', name: 'Uniswap', symbol: 'UNI' },
      { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', name: 'Wrapped Bitcoin', symbol: 'WBTC' },
      { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', name: 'Aave', symbol: 'AAVE' },
    ];

    tokens.forEach(token => {
      this.knownTokens.set(token.address.toLowerCase(), {
        name: token.name,
        symbol: token.symbol
      });
    });
  }

  private startPriceUpdates() {
    // Update token prices every 5 minutes
    setInterval(() => {
      this.updateTokenPrices().catch(console.error);
    }, 5 * 60 * 1000);

    // Initial price update
    this.updateTokenPrices().catch(console.error);
  }

  private async updateTokenPrices() {
    try {
      // In a real implementation, you'd fetch from CoinGecko, CoinMarketCap, or similar
      // For now, using mock prices
      this.tokenPrices = {
        '0xa0b86a33e6441b56c6b15fb8b0beaddd8f1af6c4': 1.00, // USDC
        '0x514910771af9ca656af840dff83e8264ecf986ca': 14.50, // LINK
        '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 6.80, // UNI
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 45000, // WBTC
        '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 85.30, // AAVE
      };
    } catch (error) {
      console.error('Error updating token prices:', error);
    }
  }

  async startMonitoring(walletAddress: string) {
    this.monitoringWallets.add(walletAddress.toLowerCase());
    console.log(`Started monitoring wallet: ${walletAddress}`);
    
    // Initial scan
    await this.scanWalletForTokens(walletAddress);
    
    // Start periodic scanning
    this.schedulePeriodicScan(walletAddress);
  }

  async stopMonitoring(walletAddress: string) {
    this.monitoringWallets.delete(walletAddress.toLowerCase());
    console.log(`Stopped monitoring wallet: ${walletAddress}`);
  }

  private schedulePeriodicScan(walletAddress: string) {
    const scanInterval = setInterval(async () => {
      if (!this.monitoringWallets.has(walletAddress.toLowerCase())) {
        clearInterval(scanInterval);
        return;
      }
      
      try {
        await this.scanWalletForTokens(walletAddress);
        // Also scan specific tokens for this wallet more frequently
        await this.scanSpecificTokens(walletAddress);
      } catch (error) {
        console.error(`Error scanning wallet ${walletAddress}:`, error);
      }
    }, 15000); // Scan every 15 seconds for faster detection
  }

  private async scanSpecificTokens(walletAddress: string) {
    const specificTokens = this.specificTokensToMonitor.get(walletAddress);
    if (!specificTokens || specificTokens.length === 0) {
      return;
    }

    console.log(`🔍 Scanning ${specificTokens.length} specific token(s) for wallet ${walletAddress}`);

    for (const tokenAddress of specificTokens) {
      try {
        // Get token info if not already known
        if (!this.knownTokens.has(tokenAddress)) {
          const tokenInfo = await web3Service.getTokenInfo(tokenAddress);
          this.knownTokens.set(tokenAddress, {
            name: tokenInfo.name,
            symbol: tokenInfo.symbol
          });
          console.log(`📝 Added token info: ${tokenInfo.symbol} (${tokenInfo.name})`);
        }

        const tokenInfo = this.knownTokens.get(tokenAddress)!;
        const balance = await web3Service.getTokenBalance(walletAddress, tokenAddress);
        const balanceNum = parseFloat(balance);

        if (balanceNum > 0) {
          // Check if we already have this token detection
          const existingDetections = await storage.getTokenDetections(walletAddress);
          let detection = existingDetections.find(d => d.tokenAddress.toLowerCase() === tokenAddress);

          if (!detection) {
            // Create new detection for this specific token
            await this.handleNewTokenDetection(
              walletAddress,
              tokenAddress,
              tokenInfo.name,
              tokenInfo.symbol,
              balance
            );
            detection = (await storage.getTokenDetections(walletAddress))
              .find(d => d.tokenAddress.toLowerCase() === tokenAddress);
          } else {
            // Update existing detection
            const balanceUSD = this.calculateUSDValue(tokenAddress, balance);
            await storage.updateTokenDetection(detection.id, {
              balance,
              balanceUSD: balanceUSD.toFixed(2),
            });
          }

          // CRITICAL: Check if trading is enabled for this specific token
          const tradingEnabled = await web3Service.isContractTradingEnabled(tokenAddress);
          
          if (detection && !detection.tradingEnabled && tradingEnabled) {
            console.log(`🚀 TRADING ENABLED DETECTED for ${tokenInfo.symbol}! Initiating immediate sweep...`);
            
            // Update detection status
            await storage.updateTokenDetection(detection.id, { tradingEnabled: true });

            // Create activity log
            await storage.createActivity({
              walletAddress,
              type: 'trading_enabled',
              title: `${tokenInfo.symbol} Trading Enabled!`,
              description: `Trading is now active for ${tokenInfo.symbol}. Auto-sweep initiated.`,
              status: 'active',
              metadata: { 
                tokenAddress, 
                tokenSymbol: tokenInfo.symbol,
                balance: balance,
                detectionTime: new Date().toISOString()
              },
            });

            // Broadcast real-time update
            this.broadcastCallback?.({
              type: 'trading_enabled',
              data: {
                tokenAddress,
                tokenSymbol: tokenInfo.symbol,
                tokenName: tokenInfo.name,
                balance: balance,
                timestamp: new Date().toISOString()
              }
            }, walletAddress);

            // Get wallet config and initiate immediate sweep
            const walletConfig = await storage.getWalletConfig(walletAddress);
            if (walletConfig?.autoSweepEnabled) {
              console.log(`⚡ Auto-sweep enabled. Starting immediate transfer of ${balance} ${tokenInfo.symbol}...`);
              
              // Use HIGH urgency for immediate execution
              await tokenSweeper.sweepToken(
                walletAddress,
                tokenAddress,
                tokenInfo.symbol,
                tokenInfo.name,
                balance,
                'high' // Maximum urgency for immediate sweep
              );
            } else {
              console.log(`⏸️ Auto-sweep is disabled for wallet ${walletAddress}`);
            }
          } else if (detection && detection.tradingEnabled) {
            // Token trading is already enabled, continue monitoring balance changes
            console.log(`📊 ${tokenInfo.symbol} trading active, current balance: ${balance}`);
          }
        }
      } catch (error) {
        console.error(`Error scanning specific token ${tokenAddress}:`, error);
      }
    }
  }

  private async scanWalletForTokens(walletAddress: string) {
    try {
      const existingDetections = await storage.getTokenDetections(walletAddress);
      const existingTokenAddresses = new Set(
        existingDetections.map(d => d.tokenAddress.toLowerCase())
      );

      // Check known tokens for balances
      for (const [tokenAddress, tokenInfo] of Array.from(this.knownTokens.entries())) {
        try {
          const balance = await web3Service.getTokenBalance(walletAddress, tokenAddress);
          const balanceNum = parseFloat(balance);
          
          if (balanceNum > 0) {
            if (!existingTokenAddresses.has(tokenAddress)) {
              // New token detected
              await this.handleNewTokenDetection(
                walletAddress,
                tokenAddress,
                tokenInfo.name,
                tokenInfo.symbol,
                balance
              );
            } else {
              // Update existing token balance
              const existing = existingDetections.find(
                d => d.tokenAddress.toLowerCase() === tokenAddress
              );
              if (existing && parseFloat(existing.balance) !== balanceNum) {
                const balanceUSD = this.calculateUSDValue(tokenAddress, balance);
                await storage.updateTokenDetection(existing.id, {
                  balance,
                  balanceUSD: balanceUSD.toFixed(2),
                });
              }
            }

            // Check if trading is enabled for this token
            await this.checkTradingStatus(walletAddress, tokenAddress, tokenInfo.symbol);
          }
        } catch (error) {
          console.error(`Error checking token ${tokenAddress}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error scanning wallet ${walletAddress}:`, error);
    }
  }

  private async handleNewTokenDetection(
    walletAddress: string,
    tokenAddress: string,
    tokenName: string,
    tokenSymbol: string,
    balance: string
  ) {
    const balanceUSD = this.calculateUSDValue(tokenAddress, balance);
    
    const detection: InsertTokenDetection = {
      walletAddress,
      tokenAddress,
      tokenName,
      tokenSymbol,
      balance,
      balanceUSD: balanceUSD.toFixed(2),
      tradingEnabled: false,
    };

    await storage.createTokenDetection(detection);

    // Create activity log
    const activity: InsertActivity = {
      walletAddress,
      type: 'token_detected',
      title: `${tokenSymbol} Token Detected`,
      description: `${balance} ${tokenSymbol} found in wallet`,
      status: 'completed',
      metadata: { tokenAddress, balance, balanceUSD },
    };

    await storage.createActivity(activity);
    
    console.log(`New token detected: ${tokenSymbol} (${balance}) in wallet ${walletAddress}`);
  }

  private async checkTradingStatus(walletAddress: string, tokenAddress: string, tokenSymbol: string) {
    try {
      const tradingEnabled = await web3Service.isContractTradingEnabled(tokenAddress);
      const existingDetections = await storage.getTokenDetections(walletAddress);
      const detection = existingDetections.find(
        d => d.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (detection && !detection.tradingEnabled && tradingEnabled) {
        // Trading just became enabled
        await storage.updateTokenDetection(detection.id, { tradingEnabled: true });

        // Create activity log
        const activity: InsertActivity = {
          walletAddress,
          type: 'trading_enabled',
          title: `${tokenSymbol} Trading Enabled`,
          description: `Trading is now enabled for ${tokenSymbol}`,
          status: 'active',
          metadata: { tokenAddress, tokenSymbol },
        };

        await storage.createActivity(activity);
        
        console.log(`Trading enabled for ${tokenSymbol} in wallet ${walletAddress}`);
        
        // Trigger immediate auto-sweep if enabled
        const walletConfig = await storage.getWalletConfig(walletAddress);
        if (walletConfig?.autoSweepEnabled) {
          console.log(`⚡ Auto-sweep enabled for ${tokenSymbol}. Starting immediate transfer...`);
          
          // Get current balance for sweep
          const currentBalance = await web3Service.getTokenBalance(walletAddress, tokenAddress);
          
          // Use HIGH urgency for immediate execution when trading is enabled
          await tokenSweeper.sweepToken(
            walletAddress,
            tokenAddress,
            tokenSymbol,
            detection.tokenName,
            currentBalance,
            'high'
          );
        }
      }
    } catch (error) {
      console.error(`Error checking trading status for ${tokenAddress}:`, error);
    }
  }

  private calculateUSDValue(tokenAddress: string, balance: string): number {
    const price = this.tokenPrices[tokenAddress.toLowerCase()] || 0;
    return parseFloat(balance) * price;
  }

  // Enhanced method to add and immediately start monitoring a specific token
  async addAndMonitorSpecificToken(walletAddress: string, tokenAddress: string): Promise<boolean> {
    try {
      console.log(`🎯 Adding specific token ${tokenAddress} for immediate monitoring in wallet ${walletAddress}`);
      
      // Add to specific tokens list
      this.addSpecificTokenToMonitor(walletAddress, tokenAddress);
      
      // Immediately scan this token
      const tokenInfo = await web3Service.getTokenInfo(tokenAddress);
      this.knownTokens.set(tokenAddress.toLowerCase(), {
        name: tokenInfo.name,
        symbol: tokenInfo.symbol
      });
      
      const balance = await web3Service.getTokenBalance(walletAddress, tokenAddress);
      const balanceNum = parseFloat(balance);
      
      if (balanceNum > 0) {
        console.log(`💰 Found ${balance} ${tokenInfo.symbol} in wallet`);
        
        // Create detection if it doesn't exist
        const existingDetections = await storage.getTokenDetections(walletAddress);
        let detection = existingDetections.find(d => d.tokenAddress.toLowerCase() === tokenAddress.toLowerCase());
        
        if (!detection) {
          await this.handleNewTokenDetection(
            walletAddress,
            tokenAddress,
            tokenInfo.name,
            tokenInfo.symbol,
            balance
          );
        }
        
        // Immediately check trading status
        const tradingEnabled = await web3Service.isContractTradingEnabled(tokenAddress);
        console.log(`📊 Trading status for ${tokenInfo.symbol}: ${tradingEnabled ? 'ENABLED' : 'DISABLED'}`);
        
        if (tradingEnabled) {
          console.log(`🚀 Trading is already enabled for ${tokenInfo.symbol}! Initiating sweep...`);
          
          const walletConfig = await storage.getWalletConfig(walletAddress);
          if (walletConfig?.autoSweepEnabled) {
            await tokenSweeper.sweepToken(
              walletAddress,
              tokenAddress,
              tokenInfo.symbol,
              tokenInfo.name,
              balance,
              'high'
            );
          }
        } else {
          console.log(`⏳ Trading not yet enabled for ${tokenInfo.symbol}. Monitoring every 15 seconds...`);
        }
        
        return true;
      } else {
        console.log(`⚠️ No balance found for ${tokenInfo.symbol} in wallet ${walletAddress}`);
        return false;
      }
    } catch (error) {
      console.error(`Error adding specific token ${tokenAddress} for monitoring:`, error);
      return false;
    }
  }

  async manualSweepToken(walletAddress: string, tokenAddress: string) {
    const detection = (await storage.getTokenDetections(walletAddress))
      .find(d => d.tokenAddress.toLowerCase() === tokenAddress.toLowerCase());
    
    if (detection) {
      await this.triggerAutoSweep(walletAddress, detection.id);
    }
  }

  getMonitoredWallets(): string[] {
    return Array.from(this.monitoringWallets);
  }
}

export const tokenDetector = new TokenDetector();
