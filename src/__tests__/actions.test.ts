import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IAgentRuntime, Memory, UUID } from '@elizaos/core';
import {
  searchTokensAction,
  getTokenInfoAction,
  getTrendingAction,
  getNewPairsAction,
  getPairsByChainAction,
} from '../actions';
import { DexScreenerService } from '../service';

// Create a valid UUID for testing
const testUUID = '550e8400-e29b-41d4-a716-446655440000' as UUID;

describe('DexScreener Actions', () => {
  let mockRuntime: IAgentRuntime;
  let mockService: DexScreenerService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DexScreenerService
    mockService = {
      search: vi.fn(),
      getTokenPairs: vi.fn(),
      getTrending: vi.fn(),
      getNewPairs: vi.fn(),
      getPairsByChain: vi.fn(),
      formatPrice: vi.fn((price) => price.toString()),
      formatPriceChange: vi.fn((change) => `${change}%`),
      formatUsdValue: vi.fn((value) => `$${value}`),
    } as any;

    // Mock runtime
    mockRuntime = {
      getService: vi.fn().mockReturnValue(mockService),
    } as any;
  });

  describe('searchTokensAction', () => {
    it('should validate search queries', async () => {
      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'Search for PEPE tokens' },
        type: 'message',
        createdAt: Date.now(),
      };

      const isValid = await searchTokensAction.validate(mockRuntime, message);
      expect(isValid).toBe(true);
    });

    it('should handle search successfully', async () => {
      const mockPairs = [
        {
          baseToken: { symbol: 'PEPE' },
          quoteToken: { symbol: 'WETH' },
          dexId: 'uniswap',
          chainId: 'ethereum',
          priceUsd: '0.001',
          priceChange: { h24: 10 },
          volume: { h24: 1000000 },
          liquidity: { usd: 5000000 },
          url: 'https://dexscreener.com/ethereum/0x123',
        },
      ];

      (mockService.search as any).mockResolvedValue({
        success: true,
        data: mockPairs,
      });

      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'Search for PEPE' },
        type: 'message',
        createdAt: Date.now(),
      };

      const result = await searchTokensAction.handler(mockRuntime, message);

      expect(mockService.search).toHaveBeenCalledWith({ query: 'PEPE' });
      expect(result.text).toContain('Search Results for "PEPE"');
      expect(result.text).toContain('PEPE/WETH');
    });
  });

  describe('getTokenInfoAction', () => {
    it('should validate token info queries', async () => {
      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'Get token info for 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        type: 'message',
        createdAt: Date.now(),
      };

      const isValid = await getTokenInfoAction.validate(mockRuntime, message);
      expect(isValid).toBe(true);
    });

    it('should handle token info request', async () => {
      const mockPairs = [
        {
          baseToken: {
            name: 'USD Coin',
            symbol: 'USDC',
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          },
          quoteToken: { symbol: 'WETH' },
          dexId: 'uniswap',
          chainId: 'ethereum',
          priceUsd: '1',
          priceChange: { h24: 0.1 },
          volume: { h24: 10000000 },
          liquidity: { usd: 50000000 },
          marketCap: 30000000000,
          fdv: 30000000000,
        },
      ];

      (mockService.getTokenPairs as any).mockResolvedValue({
        success: true,
        data: mockPairs,
      });

      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'Get token info for 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        type: 'message',
        createdAt: Date.now(),
      };

      const result = await getTokenInfoAction.handler(mockRuntime, message);

      expect(mockService.getTokenPairs).toHaveBeenCalledWith({
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      });
      expect(result.text).toContain('USD Coin (USDC)');
      expect(result.text).toContain('Token Information');
    });
  });

  describe('getTrendingAction', () => {
    it('should validate trending queries', async () => {
      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'Show me trending tokens' },
        type: 'message',
        createdAt: Date.now(),
      };

      const isValid = await getTrendingAction.validate(mockRuntime, message);
      expect(isValid).toBe(true);
    });

    it('should handle trending request with timeframe', async () => {
      const mockPairs = [
        {
          baseToken: { symbol: 'HOT' },
          quoteToken: { symbol: 'USDC' },
          priceUsd: '0.01',
          priceChange: { h24: 50 },
          volume: { h24: 5000000 },
          marketCap: 1000000,
          txns: { h24: { buys: 1000, sells: 500 } },
        },
      ];

      (mockService.getTrending as any).mockResolvedValue({
        success: true,
        data: mockPairs,
      });

      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'What are the top 5 hot tokens in the last 6h?' },
        type: 'message',
        createdAt: Date.now(),
      };

      const result = await getTrendingAction.handler(mockRuntime, message);

      expect(mockService.getTrending).toHaveBeenCalledWith({
        timeframe: '6h',
        limit: 5,
      });
      expect(result.text).toContain('Trending Tokens (6h)');
      expect(result.text).toContain('HOT/USDC');
    });
  });

  describe('getNewPairsAction', () => {
    it('should validate new pairs queries', async () => {
      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'Show me new pairs' },
        type: 'message',
        createdAt: Date.now(),
      };

      const isValid = await getNewPairsAction.validate(mockRuntime, message);
      expect(isValid).toBe(true);
    });

    it('should handle new pairs request', async () => {
      const mockPairs = [
        {
          baseToken: { symbol: 'NEW' },
          quoteToken: { symbol: 'WETH' },
          dexId: 'uniswap',
          chainId: 'ethereum',
          priceUsd: '0.001',
          liquidity: { usd: 100000 },
          pairCreatedAt: Date.now() - 3600000,
          labels: ['new'],
        },
      ];

      (mockService.getNewPairs as any).mockResolvedValue({
        success: true,
        data: mockPairs,
      });

      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'What are the 5 new tokens on ethereum?' },
        type: 'message',
        createdAt: Date.now(),
      };

      const result = await getNewPairsAction.handler(mockRuntime, message);

      expect(mockService.getNewPairs).toHaveBeenCalledWith({
        chain: 'ethereum',
        limit: 5,
      });
      expect(result.text).toContain('New Trading Pairs on ethereum');
      expect(result.text).toContain('NEW/WETH');
    });
  });

  describe('getPairsByChainAction', () => {
    it('should validate chain-specific queries', async () => {
      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'Show me top tokens on ethereum' },
        type: 'message',
        createdAt: Date.now(),
      };

      const isValid = await getPairsByChainAction.validate(mockRuntime, message);
      expect(isValid).toBe(true);
    });

    it('should handle chain pairs request', async () => {
      const mockPairs = [
        {
          baseToken: { symbol: 'USDC' },
          quoteToken: { symbol: 'ETH' },
          dexId: 'uniswap',
          priceUsd: '1',
          volume: { h24: 10000000 },
        },
      ];

      (mockService.getPairsByChain as any).mockResolvedValue({
        success: true,
        data: mockPairs,
      });

      const message: Memory = {
        id: testUUID,
        userId: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        entityId: testUUID,
        content: { text: 'What are the most liquid pairs on polygon?' },
        type: 'message',
        createdAt: Date.now(),
      };

      const result = await getPairsByChainAction.handler(mockRuntime, message);

      expect(mockService.getPairsByChain).toHaveBeenCalledWith({
        chain: 'polygon',
        sortBy: 'liquidity',
        limit: 10,
      });
      expect(result.text).toContain('Top Polygon Pairs by liquidity');
    });
  });
});
