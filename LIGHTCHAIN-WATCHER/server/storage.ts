import { 
  type WalletConfig, 
  type InsertWalletConfig,
  type Transaction,
  type InsertTransaction,
  type TokenDetection,
  type InsertTokenDetection,
  type Activity,
  type InsertActivity,
  type NetworkStatus,
  type InsertNetworkStatus
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Wallet Config methods
  getWalletConfig(walletAddress: string): Promise<WalletConfig | undefined>;
  createWalletConfig(config: InsertWalletConfig): Promise<WalletConfig>;
  updateWalletConfig(walletAddress: string, updates: Partial<WalletConfig>): Promise<WalletConfig | undefined>;
  
  // Transaction methods
  getTransactions(walletAddress: string, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;
  getTransactionsByStatus(status: string): Promise<Transaction[]>;
  
  // Token Detection methods
  getTokenDetections(walletAddress: string): Promise<TokenDetection[]>;
  createTokenDetection(detection: InsertTokenDetection): Promise<TokenDetection>;
  updateTokenDetection(id: string, updates: Partial<TokenDetection>): Promise<TokenDetection | undefined>;
  getTokenDetectionsByTradingStatus(tradingEnabled: boolean): Promise<TokenDetection[]>;
  
  // Activity methods
  getActivities(walletAddress: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  
  // Network Status methods
  getNetworkStatus(): Promise<NetworkStatus | undefined>;
  updateNetworkStatus(status: InsertNetworkStatus): Promise<NetworkStatus>;
  
  // Stats methods
  getTransferStats(walletAddress: string): Promise<{
    transfersToday: number;
    totalValueToday: string;
    tokenCount: number;
  }>;
}

export class MemStorage implements IStorage {
  private walletConfigs: Map<string, WalletConfig>;
  private transactions: Map<string, Transaction>;
  private tokenDetections: Map<string, TokenDetection>;
  private activities: Map<string, Activity>;
  private networkStatus: NetworkStatus | undefined;

  constructor() {
    this.walletConfigs = new Map();
    this.transactions = new Map();
    this.tokenDetections = new Map();
    this.activities = new Map();
    this.networkStatus = undefined;
  }

  async getWalletConfig(walletAddress: string): Promise<WalletConfig | undefined> {
    return this.walletConfigs.get(walletAddress);
  }

  async createWalletConfig(config: InsertWalletConfig): Promise<WalletConfig> {
    const id = randomUUID();
    const walletConfig: WalletConfig = {
      id,
      walletAddress: config.walletAddress,
      privateKey: config.privateKey,
      safeWalletAddress: config.safeWalletAddress,
      gasStrategy: config.gasStrategy || 'standard',
      minTransferAmount: config.minTransferAmount || '10.00',
      autoSweepEnabled: config.autoSweepEnabled !== undefined ? config.autoSweepEnabled : true,
      isActive: config.isActive !== undefined ? config.isActive : true,
      createdAt: new Date(),
    };
    this.walletConfigs.set(config.walletAddress, walletConfig);
    return walletConfig;
  }

  async updateWalletConfig(walletAddress: string, updates: Partial<WalletConfig>): Promise<WalletConfig | undefined> {
    const existing = this.walletConfigs.get(walletAddress);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.walletConfigs.set(walletAddress, updated);
    return updated;
  }

  async getTransactions(walletAddress: string, limit: number = 50): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(tx => tx.walletAddress === walletAddress)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const tx: Transaction = {
      id,
      walletAddress: transaction.walletAddress,
      tokenAddress: transaction.tokenAddress,
      tokenSymbol: transaction.tokenSymbol,
      tokenName: transaction.tokenName,
      amount: transaction.amount,
      amountUSD: transaction.amountUSD || null,
      txHash: transaction.txHash || null,
      status: transaction.status || 'pending',
      gasUsed: transaction.gasUsed || null,
      gasPrice: transaction.gasPrice || null,
      blockNumber: transaction.blockNumber || null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.transactions.set(id, tx);
    return tx;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const existing = this.transactions.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    if (updates.status === 'completed' && !updated.completedAt) {
      updated.completedAt = new Date();
    }
    this.transactions.set(id, updated);
    return updated;
  }

  async getTransactionsByStatus(status: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(tx => tx.status === status);
  }

  async getTokenDetections(walletAddress: string): Promise<TokenDetection[]> {
    return Array.from(this.tokenDetections.values())
      .filter(detection => detection.walletAddress === walletAddress)
      .sort((a, b) => (b.detectedAt?.getTime() || 0) - (a.detectedAt?.getTime() || 0));
  }

  async createTokenDetection(detection: InsertTokenDetection): Promise<TokenDetection> {
    const id = randomUUID();
    const tokenDetection: TokenDetection = {
      id,
      walletAddress: detection.walletAddress,
      tokenAddress: detection.tokenAddress,
      tokenSymbol: detection.tokenSymbol,
      tokenName: detection.tokenName,
      balance: detection.balance,
      balanceUSD: detection.balanceUSD || null,
      tradingEnabled: detection.tradingEnabled !== undefined ? detection.tradingEnabled : false,
      detectedAt: new Date(),
      lastCheckedAt: new Date(),
    };
    this.tokenDetections.set(id, tokenDetection);
    return tokenDetection;
  }

  async updateTokenDetection(id: string, updates: Partial<TokenDetection>): Promise<TokenDetection | undefined> {
    const existing = this.tokenDetections.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates, lastCheckedAt: new Date() };
    this.tokenDetections.set(id, updated);
    return updated;
  }

  async getTokenDetectionsByTradingStatus(tradingEnabled: boolean): Promise<TokenDetection[]> {
    return Array.from(this.tokenDetections.values()).filter(
      detection => detection.tradingEnabled === tradingEnabled
    );
  }

  async getActivities(walletAddress: string, limit: number = 20): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .filter(activity => activity.walletAddress === walletAddress)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const activityRecord: Activity = {
      id,
      walletAddress: activity.walletAddress,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      status: activity.status,
      metadata: activity.metadata || null,
      createdAt: new Date(),
    };
    this.activities.set(id, activityRecord);
    return activityRecord;
  }

  async getNetworkStatus(): Promise<NetworkStatus | undefined> {
    return this.networkStatus;
  }

  async updateNetworkStatus(status: InsertNetworkStatus): Promise<NetworkStatus> {
    const id = randomUUID();
    const networkStatus: NetworkStatus = {
      id,
      currentBlock: status.currentBlock,
      gasPrice: status.gasPrice,
      networkLoad: status.networkLoad,
      connectionStatus: status.connectionStatus || 'stable',
      lastUpdated: new Date(),
    };
    this.networkStatus = networkStatus;
    return networkStatus;
  }

  async getTransferStats(walletAddress: string): Promise<{
    transfersToday: number;
    totalValueToday: string;
    tokenCount: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysTransactions = Array.from(this.transactions.values()).filter(
      tx => tx.walletAddress === walletAddress && 
           (tx.createdAt?.getTime() || 0) >= today.getTime() &&
           tx.status === 'completed'
    );
    
    const totalValueToday = todaysTransactions.reduce((sum, tx) => {
      return sum + parseFloat(tx.amountUSD || '0');
    }, 0);
    
    const tokenCount = Array.from(this.tokenDetections.values()).filter(
      detection => detection.walletAddress === walletAddress
    ).length;

    return {
      transfersToday: todaysTransactions.length,
      totalValueToday: totalValueToday.toFixed(2),
      tokenCount,
    };
  }
}

export const storage = new MemStorage();
