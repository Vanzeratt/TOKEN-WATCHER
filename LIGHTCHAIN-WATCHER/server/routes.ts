import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage.js";
import { web3Service } from "./services/web3Service.js";
import { tokenDetector } from "./services/tokenDetector.js";
import { tokenSweeper } from "./services/tokenSweeper.js";
import { gasOptimizer } from "./services/gasOptimizer.js";
import { insertWalletConfigSchema, insertTransactionSchema, insertNetworkStatusSchema } from "@shared/schema";

interface WebSocketClient extends WebSocket {
  walletAddress?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients = new Set<WebSocketClient>();
  
  wss.on('connection', (ws: WebSocketClient) => {
    clients.add(ws);
    console.log('WebSocket client connected');
    
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'subscribe' && data.walletAddress) {
          ws.walletAddress = data.walletAddress;
          console.log(`Client subscribed to wallet: ${data.walletAddress}`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });
  });

  // Broadcast function for real-time updates
  const broadcast = (data: any, walletAddress?: string) => {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        if (!walletAddress || client.walletAddress === walletAddress) {
          client.send(JSON.stringify(data));
        }
      }
    });
  };

  // Set broadcast callback for services
  tokenDetector.setBroadcastCallback(broadcast);

  // Wallet Configuration Routes
  app.get('/api/wallet/:address/config', async (req, res) => {
    try {
      const config = await storage.getWalletConfig(req.params.address);
      if (!config) {
        return res.status(404).json({ message: 'Wallet configuration not found' });
      }
      
      // Don't return private key in response
      const { privateKey, ...safeConfig } = config;
      res.json(safeConfig);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching wallet configuration' });
    }
  });

  app.post('/api/wallet/config', async (req, res) => {
    try {
      const validatedData = insertWalletConfigSchema.parse(req.body);
      const config = await storage.createWalletConfig(validatedData);
      
      // Start monitoring this wallet
      await tokenDetector.startMonitoring(config.walletAddress);
      
      // Don't return private key in response
      const { privateKey, ...safeConfig } = config;
      res.json(safeConfig);
      
      broadcast({
        type: 'wallet_configured',
        data: safeConfig
      });
    } catch (error) {
      res.status(400).json({ message: 'Invalid wallet configuration data' });
    }
  });

  app.patch('/api/wallet/:address/config', async (req, res) => {
    try {
      const updates = req.body;
      const config = await storage.updateWalletConfig(req.params.address, updates);
      
      if (!config) {
        return res.status(404).json({ message: 'Wallet configuration not found' });
      }
      
      // Handle monitoring state changes
      if (updates.isActive !== undefined) {
        if (updates.isActive) {
          await tokenDetector.startMonitoring(req.params.address);
        } else {
          await tokenDetector.stopMonitoring(req.params.address);
        }
      }
      
      const { privateKey, ...safeConfig } = config;
      res.json(safeConfig);
      
      broadcast({
        type: 'wallet_config_updated',
        data: safeConfig
      }, req.params.address);
    } catch (error) {
      res.status(500).json({ message: 'Error updating wallet configuration' });
    }
  });

  // Wallet Balance and Info Routes
  app.get('/api/wallet/:address/balance', async (req, res) => {
    try {
      const ethBalance = await web3Service.getEthBalance(req.params.address);
      const ethPriceUSD = 2000; // In reality, fetch from price API
      const balanceUSD = (parseFloat(ethBalance) * ethPriceUSD).toFixed(2);
      
      res.json({
        ethBalance,
        ethBalanceUSD: balanceUSD
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching wallet balance' });
    }
  });

  app.get('/api/wallet/:address/stats', async (req, res) => {
    try {
      const stats = await storage.getTransferStats(req.params.address);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching wallet stats' });
    }
  });

  // Token Detection Routes
  app.get('/api/wallet/:address/tokens', async (req, res) => {
    try {
      const tokens = await storage.getTokenDetections(req.params.address);
      res.json(tokens);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching token detections' });
    }
  });

  // Add specific token to monitor
  app.post('/api/wallet/:address/tokens/monitor', async (req, res) => {
    try {
      const { tokenAddress } = req.body;
      if (!tokenAddress) {
        return res.status(400).json({ message: 'Token address is required' });
      }

      const success = await tokenDetector.addAndMonitorSpecificToken(req.params.address, tokenAddress);
      
      if (success) {
        res.json({ 
          message: 'Token added to monitoring',
          tokenAddress,
          walletAddress: req.params.address
        });

        broadcast({
          type: 'token_monitoring_added',    
          data: {
            walletAddress: req.params.address,
            tokenAddress
          }
        }, req.params.address);
      } else {
        res.status(400).json({ message: 'Failed to add token to monitoring' });
      }
    } catch (error) {
      console.error('Error adding token to monitoring:', error);
      res.status(500).json({ message: 'Error adding token to monitoring' });
    }  
  });

  // Remove specific token from monitoring
  app.delete('/api/wallet/:address/tokens/:tokenAddress/monitor', async (req, res) => {
    try {
      tokenDetector.removeSpecificTokenFromMonitor(req.params.address, req.params.tokenAddress);
      res.json({ message: 'Token removed from monitoring' });
      
      broadcast({
        type: 'token_monitoring_removed',
        data: {
          walletAddress: req.params.address,
          tokenAddress: req.params.tokenAddress
        }
      }, req.params.address);
    } catch (error) {
      res.status(500).json({ message: 'Error removing token from monitoring' });
    }
  });

  // Manual token sweep (enhanced)
  app.post('/api/wallet/:address/tokens/:tokenAddress/sweep', async (req, res) => {
    try {
      const { urgency = 'medium' } = req.body;
      
      // Get token info
      const tokens = await storage.getTokenDetections(req.params.address);
      const token = tokens.find(t => t.tokenAddress.toLowerCase() === req.params.tokenAddress.toLowerCase());
      
      if (!token) {
        return res.status(404).json({ message: 'Token not found in wallet' });
      }

      // Initiate sweep with token sweeper
      const txHash = await tokenSweeper.sweepToken(
        req.params.address,
        req.params.tokenAddress,
        token.tokenSymbol,
        token.tokenName,
        token.balance,
        urgency as 'low' | 'medium' | 'high'
      );

      if (txHash) {
        res.json({ 
          message: 'Token sweep initiated',
          transactionHash: txHash,
          tokenSymbol: token.tokenSymbol,
          amount: token.balance
        });
      } else {
        res.status(400).json({ message: 'Failed to initiate token sweep' });
      }
    } catch (error) {
      console.error('Error initiating token sweep:', error);
      res.status(500).json({ message: 'Error initiating token sweep' });
    }
  });

  // Transaction Routes
  app.get('/api/wallet/:address/transactions', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await storage.getTransactions(req.params.address, limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching transactions' });
    }
  });

  app.post('/api/transactions', async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validatedData);
      res.json(transaction);
      
      broadcast({
        type: 'new_transaction',
        data: transaction
      }, transaction.walletAddress);
    } catch (error) {
      res.status(400).json({ message: 'Invalid transaction data' });
    }
  });

  app.patch('/api/transactions/:id', async (req, res) => {
    try {
      const updates = req.body;
      const transaction = await storage.updateTransaction(req.params.id, updates);
      
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }
      
      res.json(transaction);
      
      broadcast({
        type: 'transaction_updated',
        data: transaction
      }, transaction.walletAddress);
    } catch (error) {
      res.status(500).json({ message: 'Error updating transaction' });
    }
  });

  // Activity Feed Routes
  app.get('/api/wallet/:address/activities', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const activities = await storage.getActivities(req.params.address, limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching activities' });
    }
  });

  // Network Status Routes
  app.get('/api/network/status', async (req, res) => {
    try {
      const networkStatus = await storage.getNetworkStatus();
      if (!networkStatus) {
        // Create initial network status if none exists
        const currentBlock = await web3Service.getCurrentBlock();
        const gasPrice = await web3Service.getGasPrice();
        const networkLoad = gasOptimizer.getNetworkLoad();
        
        const newStatus = await storage.updateNetworkStatus({
          currentBlock: currentBlock.toString(),
          gasPrice,
          networkLoad: networkLoad.toString(),
          connectionStatus: 'stable'
        });
        
        return res.json(newStatus);
      }
      
      res.json(networkStatus);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching network status' });
    }
  });

  // Gas Optimization Routes
  app.get('/api/gas/strategies', async (req, res) => {
    try {
      const strategies = gasOptimizer.getAvailableStrategies();
      res.json(strategies);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching gas strategies' });
    }
  });

  app.get('/api/gas/optimal', async (req, res) => {
    try {
      const strategy = req.query.strategy as string || 'standard';
      const urgency = req.query.urgency as 'low' | 'medium' | 'high' || 'medium';
      
      const gasPrice = await gasOptimizer.getOptimalGasPrice(strategy, urgency);
      const recommendedStrategy = await gasOptimizer.getRecommendedStrategy();
      
      res.json({
        gasPrice,
        recommendedStrategy,
        networkLoad: gasOptimizer.getNetworkLoad()
      });
    } catch (error) {
      res.status(500).json({ message: 'Error calculating optimal gas price' });
    }
  });

  app.post('/api/gas/estimate', async (req, res) => {
    try {
      const { tokenAddress, fromAddress, toAddress, amount, gasStrategy } = req.body;
      
      const estimate = await gasOptimizer.estimateTransactionCost(
        tokenAddress,
        fromAddress,
        toAddress,
        amount,
        gasStrategy
      );
      
      res.json(estimate);
    } catch (error) {
      res.status(500).json({ message: 'Error estimating transaction cost' });
    }
  });

  // Emergency Controls
  app.post('/api/emergency/stop', async (req, res) => {
    try {
      const { walletAddress } = req.body;
      
      if (walletAddress) {
        await tokenDetector.stopMonitoring(walletAddress);
        await tokenSweeper.emergencyStop(walletAddress);
        await storage.updateWalletConfig(walletAddress, { isActive: false });
      } else {
        // Stop all monitoring
        const monitoredWallets = tokenDetector.getMonitoredWallets();
        for (const wallet of monitoredWallets) {
          await tokenDetector.stopMonitoring(wallet);
          await storage.updateWalletConfig(wallet, { isActive: false });
        }
        await tokenSweeper.emergencyStop();
      }
      
      res.json({ message: 'Emergency stop executed' });
      
      broadcast({
        type: 'emergency_stop',
        data: { walletAddress }
      }, walletAddress);
    } catch (error) {
      res.status(500).json({ message: 'Error executing emergency stop' });
    }
  });

  // Get sweep status
  app.get('/api/wallet/:address/sweep-status', async (req, res) => {
    try {
      const activeSweeps = tokenSweeper.getActiveSweepCount(req.params.address);
      const recentTransactions = await storage.getTransactions(req.params.address, 10);
      const pendingTransactions = recentTransactions.filter(tx => tx.status === 'pending').length;
      
      res.json({
        activeSweeps,
        pendingTransactions,
        lastActivity: recentTransactions[0]?.createdAt || null
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching sweep status' });
    }
  });

  // Periodic network status updates
  setInterval(async () => {
    try {
      const currentBlock = await web3Service.getCurrentBlock();
      const gasPrice = await web3Service.getGasPrice();
      const networkLoad = gasOptimizer.getNetworkLoad();
      
      const networkStatus = await storage.updateNetworkStatus({
        currentBlock: currentBlock.toString(),
        gasPrice,
        networkLoad: networkLoad.toString(),
        connectionStatus: 'stable'
      });
      
      broadcast({
        type: 'network_status_updated',
        data: networkStatus
      });
    } catch (error) {
      console.error('Error updating network status:', error);
    }
  }, 30000); // Update every 30 seconds

  return httpServer;
}
