import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';

export class Web3Service {
  private web3: Web3;
  private chainId: number;

  constructor() {
    const rpcUrl = (process.env.ETHEREUM_RPC_URL || process.env.INFURA_URL || process.env.ALCHEMY_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID')
      .replace(/\s+/g, ''); // Remove any spaces from the URL
    console.log('🌐 Connecting to Ethereum RPC:', rpcUrl.replace(/\/v3\/.*/, '/v3/[API_KEY]')); // Log without exposing key
    this.web3 = new Web3(rpcUrl);
    this.chainId = parseInt(process.env.CHAIN_ID || '1');
  }

  async getCurrentBlock(): Promise<number> {
    const blockNumber = await this.web3.eth.getBlockNumber();
    return Number(blockNumber);
  }

  async getGasPrice(): Promise<string> {
    const gasPrice = await this.web3.eth.getGasPrice();
    return this.web3.utils.fromWei(gasPrice, 'gwei');
  }

  async getEthBalance(address: string): Promise<string> {
    const balance = await this.web3.eth.getBalance(address);
    return this.web3.utils.fromWei(balance, 'ether');
  }

  async getTokenBalance(walletAddress: string, tokenAddress: string): Promise<string> {
    const erc20Abi = [
      {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function',
      },
      {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function',
      },
    ];

    const contract = new this.web3.eth.Contract(erc20Abi, tokenAddress);
    const balance = await contract.methods.balanceOf(walletAddress).call();
    const decimals = await contract.methods.decimals().call();
    
    const balanceStr = balance.toString();
    const decimalsNum = Number(decimals);
    const divisor = Math.pow(10, decimalsNum);
    const tokenBalance = (Number(balanceStr) / divisor).toFixed(6);
    
    return tokenBalance;
  }

  async getTokenInfo(tokenAddress: string): Promise<{ name: string; symbol: string; decimals: number }> {
    const erc20Abi = [
      {
        constant: true,
        inputs: [],
        name: 'name',
        outputs: [{ name: '', type: 'string' }],
        type: 'function',
      },
      {
        constant: true,
        inputs: [],
        name: 'symbol',
        outputs: [{ name: '', type: 'string' }],
        type: 'function',
      },
      {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function',
      },
    ];

    const contract = new this.web3.eth.Contract(erc20Abi, tokenAddress);
    
    const [name, symbol, decimals] = await Promise.all([
      contract.methods.name().call(),
      contract.methods.symbol().call(),
      contract.methods.decimals().call(),
    ]);

    return { 
      name: String(name), 
      symbol: String(symbol), 
      decimals: Number(decimals) 
    };
  }

  async transferToken(
    privateKey: string,
    tokenAddress: string,
    toAddress: string,
    amount: string,
    gasPrice: string
  ): Promise<string> {
    const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    this.web3.eth.accounts.wallet.add(account);

    const erc20Abi = [
      {
        constant: false,
        inputs: [
          { name: '_to', type: 'address' },
          { name: '_value', type: 'uint256' },
        ],
        name: 'transfer',
        outputs: [{ name: '', type: 'bool' }],
        type: 'function',
      },
      {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function',
      },
    ];

    const contract = new this.web3.eth.Contract(erc20Abi, tokenAddress);
    const decimals = await contract.methods.decimals().call();
    const decimalsNum = Number(decimals);
    const value = (Number(amount) * Math.pow(10, decimalsNum)).toString();

    const gas = await contract.methods.transfer(toAddress, value).estimateGas({ from: account.address });
    
    const tx = {
      from: account.address,
      to: tokenAddress,
      gas: Number(gas).toString(),
      gasPrice: this.web3.utils.toWei(gasPrice, 'gwei'),
      data: contract.methods.transfer(toAddress, value).encodeABI(),
    };

    const signedTx = await this.web3.eth.accounts.signTransaction(tx, privateKey);
    const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
    
    return receipt.transactionHash as string;
  }

  async transferEth(
    privateKey: string,
    toAddress: string,
    amount: string,
    gasPrice: string
  ): Promise<string> {
    const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    
    const tx = {
      from: account.address,
      to: toAddress,
      value: this.web3.utils.toWei(amount, 'ether'),
      gas: '21000',
      gasPrice: this.web3.utils.toWei(gasPrice, 'gwei'),
    };

    const signedTx = await this.web3.eth.accounts.signTransaction(tx, privateKey);
    const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
    
    return receipt.transactionHash as string;
  }

  // Enhanced trading detection methods for your specific token monitoring
  async isContractTradingEnabled(tokenAddress: string): Promise<boolean> {
    try {
      // Multiple checks to determine if trading is enabled
      const results = await Promise.allSettled([
        this.checkUniswapV2Trading(tokenAddress),
        this.checkUniswapV3Trading(tokenAddress),
        this.checkContractTradingFlag(tokenAddress),
        this.checkRecentTransactions(tokenAddress)
      ]);

      // If any method returns true, trading is likely enabled
      return results.some(result => result.status === 'fulfilled' && result.value === true);
    } catch (error) {
      console.error(`Error checking trading status for ${tokenAddress}:`, error);
      return false;
    }
  }

  private async checkUniswapV2Trading(tokenAddress: string): Promise<boolean> {
    try {
      // Check if there's a Uniswap V2 pair with liquidity
      const UNISWAP_V2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
      const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      
      const factoryAbi = [
        {
          constant: true,
          inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' }
          ],
          name: 'getPair',
          outputs: [{ name: 'pair', type: 'address' }],
          type: 'function'
        }
      ];

      const factory = new this.web3.eth.Contract(factoryAbi, UNISWAP_V2_FACTORY);
      const pairAddress = await factory.methods.getPair(tokenAddress, WETH_ADDRESS).call();
      
      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        return false;
      }

      // Check if pair has reserves (liquidity)
      const pairAbi = [
        {
          constant: true,
          inputs: [],
          name: 'getReserves',
          outputs: [
            { name: '_reserve0', type: 'uint112' },
            { name: '_reserve1', type: 'uint112' },
            { name: '_blockTimestampLast', type: 'uint32' }
          ],
          type: 'function'
        }
      ];

      const pair = new this.web3.eth.Contract(pairAbi, String(pairAddress));
      const reserves = await pair.methods.getReserves().call();
      
      return Number(reserves._reserve0) > 0 && Number(reserves._reserve1) > 0;
    } catch (error) {
      return false;
    }
  }

  private async checkUniswapV3Trading(tokenAddress: string): Promise<boolean> {
    try {
      // Check Uniswap V3 pools for the token
      const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
      const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      
      const factoryAbi = [
        {
          inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'fee', type: 'uint24' }
          ],
          name: 'getPool',
          outputs: [{ name: 'pool', type: 'address' }],
          stateMutability: 'view',
          type: 'function'
        }
      ];

      const factory = new this.web3.eth.Contract(factoryAbi, UNISWAP_V3_FACTORY);
      const fees = [500, 3000, 10000]; // Common fee tiers
      
      for (const fee of fees) {
        const poolAddress = await factory.methods.getPool(tokenAddress, WETH_ADDRESS, fee).call();
        if (poolAddress !== '0x0000000000000000000000000000000000000000') {
          // Check if pool has liquidity
          const poolAbi = [
            {
              inputs: [],
              name: 'liquidity',
              outputs: [{ name: '', type: 'uint128' }],
              stateMutability: 'view',
              type: 'function'
            }
          ];
          
          const pool = new this.web3.eth.Contract(poolAbi, String(poolAddress));
          const liquidity = await pool.methods.liquidity().call();
          
          if (Number(liquidity) > 0) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  private async checkContractTradingFlag(tokenAddress: string): Promise<boolean> {
    try {
      // Many tokens have a tradingEnabled flag or similar
      const commonTradingFlagAbis = [
        {
          constant: true,
          inputs: [],
          name: 'tradingEnabled',
          outputs: [{ name: '', type: 'bool' }],
          type: 'function'
        },
        {
          constant: true,
          inputs: [],
          name: 'tradingActive',
          outputs: [{ name: '', type: 'bool' }],
          type: 'function'
        },
        {
          constant: true,
          inputs: [],
          name: 'launched',
          outputs: [{ name: '', type: 'bool' }],
          type: 'function'
        }
      ];

      const contract = new this.web3.eth.Contract(commonTradingFlagAbis, tokenAddress);
      
      const results = await Promise.allSettled([
        contract.methods.tradingEnabled?.().call(),
        contract.methods.tradingActive?.().call(),
        contract.methods.launched?.().call()
      ]);

      return results.some(result => result.status === 'fulfilled' && result.value === true);
    } catch (error) {
      return false;
    }
  }

  private async checkRecentTransactions(tokenAddress: string): Promise<boolean> {
    try {
      // Check if there are recent transfer transactions (indicating active trading)
      const currentBlock = await this.web3.eth.getBlockNumber();
      const fromBlock = Number(currentBlock) - 100; // Check last 100 blocks
      
      const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      const logs = await this.web3.eth.getPastLogs({
        fromBlock: fromBlock.toString(),
        toBlock: 'latest',
        address: tokenAddress,
        topics: [transferEventSignature]
      });

      // If there are multiple transfers in recent blocks, trading is likely active
      return logs.length > 5;
    } catch (error) {
      return false;
    }
  }

  async getTransactionReceipt(txHash: string) {
    return await this.web3.eth.getTransactionReceipt(txHash);
  }

  async estimateTransferGas(tokenAddress: string, fromAddress: string, toAddress: string, amount: string): Promise<number> {
    const erc20Abi = [
      {
        constant: false,
        inputs: [
          { name: '_to', type: 'address' },
          { name: '_value', type: 'uint256' },
        ],
        name: 'transfer',
        outputs: [{ name: '', type: 'bool' }],
        type: 'function',
      },
    ];

    const contract = new this.web3.eth.Contract(erc20Abi, tokenAddress);
    const decimals = await contract.methods.decimals().call();
    const decimalsNum = Number(decimals);
    const value = (Number(amount) * Math.pow(10, decimalsNum)).toString();
    
    const gasEstimate = await contract.methods.transfer(toAddress, value).estimateGas({ from: fromAddress });
    return Number(gasEstimate);
  }
}

export const web3Service = new Web3Service();
