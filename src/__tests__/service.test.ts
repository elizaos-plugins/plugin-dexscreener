import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IAgentRuntime } from '@elizaos/core';
import { DexScreenerService } from '../service';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('DexScreenerService', () => {
  let service: DexScreenerService;
  let mockRuntime: IAgentRuntime;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
    };

    (axios.create as any).mockReturnValue(mockAxiosInstance);

    // Mock runtime
    mockRuntime = {
      getSetting: vi.fn((key: string) => {
        if (key === 'DEXSCREENER_API_URL') return 'https://api.dexscreener.com';
        if (key === 'DEXSCREENER_RATE_LIMIT_DELAY') return '100';
        return undefined;
      }),
    } as any;

    service = new DexScreenerService(mockRuntime);
  });

  describe('constructor', () => {
    it('should initialize with correct service type', () => {
      expect(service.serviceType).toBe('dexscreener');
    });

    it('should initialize with correct capability description', () => {
      expect(service.capabilityDescription).toBe(
        'Provides DEX analytics and token information from DexScreener'
      );
    });

    it('should create axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.dexscreener.com',
        timeout: 10000,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ElizaOS-DexScreener-Plugin/1.0',
        },
      });
    });
  });

  describe('search', () => {
    it('should search for tokens successfully', async () => {
      const mockResponse = {
        data: {
          pairs: [
            {
              chainId: 'ethereum',
              dexId: 'uniswap',
              baseToken: { symbol: 'PEPE' },
              quoteToken: { symbol: 'WETH' },
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.search({ query: 'PEPE' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].baseToken.symbol).toBe('PEPE');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/latest/dex/search', {
        params: { q: 'PEPE' },
      });
    });

    it('should handle search errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

      const result = await service.search({ query: 'INVALID' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
    });
  });

  describe('getTokenPairs', () => {
    it('should get token pairs successfully', async () => {
      const mockResponse = {
        data: {
          pairs: [
            {
              chainId: 'ethereum',
              dexId: 'uniswap',
              baseToken: { address: '0x123' },
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getTokenPairs({ tokenAddress: '0x123' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/latest/dex/tokens/0x123');
    });
  });

  describe('getTrending', () => {
    it('should return trending pairs', async () => {
      // Mock boosted tokens response
      const mockBoostedResponse = {
        data: [
          { chainId: 'ethereum', tokenAddress: '0x123' },
          { chainId: 'ethereum', tokenAddress: '0x456' },
        ],
      };

      // Mock token pairs responses
      const mockPairResponse1 = {
        data: [{
          chainId: 'ethereum',
          baseToken: { symbol: 'PEPE', address: '0x123' },
          quoteToken: { symbol: 'WETH' },
          volume: { h24: 1000000 },
          priceChange: { h24: 50 },
        }],
      };

      const mockPairResponse2 = {
        data: [{
          chainId: 'ethereum',
          baseToken: { symbol: 'SHIB', address: '0x456' },
          quoteToken: { symbol: 'WETH' },
          volume: { h24: 500000 },
          priceChange: { h24: 25 },
        }],
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce(mockBoostedResponse)
        .mockResolvedValueOnce(mockPairResponse1)
        .mockResolvedValueOnce(mockPairResponse2);

      const result = await service.getTrending({ limit: 2 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].baseToken.symbol).toBe('PEPE');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/token-boosts/top/v1');
    });
  });

  describe('formatters', () => {
    it('should format price correctly', () => {
      expect(service.formatPrice(100)).toBe('100.00');
      expect(service.formatPrice(0.5)).toBe('0.5000');
      expect(service.formatPrice(0.00001)).toBe('0.00001000');
    });

    it('should format price change correctly', () => {
      expect(service.formatPriceChange(5.5)).toBe('+5.50%');
      expect(service.formatPriceChange(-3.25)).toBe('-3.25%');
    });

    it('should format USD value correctly', () => {
      expect(service.formatUsdValue(1500000)).toBe('$1.50M');
      expect(service.formatUsdValue(5000)).toBe('$5.00K');
      expect(service.formatUsdValue(100)).toBe('$100.00');
    });
  });

  describe('stop', () => {
    it('should stop gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      await service.stop();
      expect(consoleSpy).toHaveBeenCalledWith('DexScreener service stopped');
    });
  });

  describe('getMultipleTokens', () => {
    it('should get multiple tokens successfully', async () => {
      const mockResponse = {
        data: [
          {
            chainId: 'ethereum',
            baseToken: { address: '0x123' },
            priceUsd: '1.5',
          },
          {
            chainId: 'ethereum',
            baseToken: { address: '0x456' },
            priceUsd: '2.5',
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getMultipleTokens('ethereum', ['0x123', '0x456']);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/tokens/v1/ethereum/0x123,0x456');
    });

    it('should reject more than 30 addresses', async () => {
      const addresses = Array(31).fill('0x123');
      const result = await service.getMultipleTokens('ethereum', addresses);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Maximum 30 token addresses allowed');
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });
  });

  describe('getLatestTokenProfiles', () => {
    it('should get latest token profiles successfully', async () => {
      const mockResponse = {
        data: [
          {
            chainId: 'ethereum',
            tokenAddress: '0x123',
            description: 'Test token',
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getLatestTokenProfiles();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/token-profiles/latest/v1');
    });

    it('should handle single profile response', async () => {
      const mockResponse = {
        data: {
          chainId: 'ethereum',
          tokenAddress: '0x123',
          description: 'Test token',
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getLatestTokenProfiles();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].tokenAddress).toBe('0x123');
    });
  });

  describe('boosted tokens', () => {
    it('should get latest boosted tokens', async () => {
      const mockResponse = {
        data: [
          {
            chainId: 'ethereum',
            tokenAddress: '0x123',
            amount: 100,
            totalAmount: 1000,
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getLatestBoostedTokens();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/token-boosts/latest/v1');
    });

    it('should get top boosted tokens', async () => {
      const mockResponse = {
        data: [
          {
            chainId: 'ethereum',
            tokenAddress: '0x123',
            amount: 500,
            totalAmount: 5000,
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getTopBoostedTokens();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/token-boosts/top/v1');
    });
  });

  describe('checkOrderStatus', () => {
    it('should check order status successfully', async () => {
      const mockResponse = {
        data: [
          {
            type: 'tokenProfile',
            status: 'completed',
            paymentTimestamp: Date.now(),
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.checkOrderStatus('ethereum', '0x123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/orders/v1/ethereum/0x123');
    });
  });

  describe('getTokenPairsByChain', () => {
    it('should get token pairs by chain successfully', async () => {
      const mockResponse = {
        data: [
          {
            chainId: 'ethereum',
            baseToken: { address: '0x123' },
            priceUsd: '1.5',
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getTokenPairsByChain('ethereum', '0x123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/token-pairs/v1/ethereum/0x123');
    });
  });
});
