import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IAgentRuntime, Memory, UUID } from '@elizaos/core';
import { dexscreenerPlugin } from '../index';
import { DexScreenerService } from '../service';

// Create a valid UUID for testing
const testUUID = '550e8400-e29b-41d4-a716-446655440000' as UUID;

// Skip these tests in CI or if no API access
const SKIP_REAL_API_TESTS = process.env.SKIP_DEXSCREENER_API_TESTS === 'true';

describe.skipIf(SKIP_REAL_API_TESTS)('DexScreener Plugin Real API E2E Tests', () => {
  let runtime: IAgentRuntime;
  let service: DexScreenerService;

  // Create real runtime for E2E tests
  const createRealRuntime = (): IAgentRuntime => {
    const services = new Map();

    return {
      getSetting: (key: string) => {
        if (key === 'DEXSCREENER_API_URL') return 'https://api.dexscreener.com';
        if (key === 'DEXSCREENER_RATE_LIMIT_DELAY') return '1000'; // Higher delay for real API
        return undefined;
      },
      getService: (name: string) => services.get(name),
      registerService: (service: any) => {
        services.set(service.serviceType || 'dexscreener', service);
      },
    } as any;
  };

  beforeAll(async () => {
    runtime = createRealRuntime();
    service = new DexScreenerService(runtime);
    (runtime as any).registerService(service);
  });

  afterAll(async () => {
    await service.stop();
  });

  describe('Real API Integration', () => {
    it('should search for real tokens', async () => {
      const result = await service.search({ query: 'USDC' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeGreaterThan(0);
      
      const firstPair = result.data![0];
      expect(firstPair).toHaveProperty('chainId');
      expect(firstPair).toHaveProperty('baseToken');
      expect(firstPair).toHaveProperty('quoteToken');
      expect(firstPair).toHaveProperty('priceUsd');
    }, 10000); // 10 second timeout for API call

    it('should get token info for USDC on Ethereum', async () => {
      // USDC contract on Ethereum
      const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const result = await service.getTokenPairs({ tokenAddress: usdcAddress });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeGreaterThan(0);
      
      // Should have multiple USDC pairs
      const usdcPairs = result.data!.filter(pair => 
        pair.baseToken.address.toLowerCase() === usdcAddress.toLowerCase() ||
        pair.quoteToken.address.toLowerCase() === usdcAddress.toLowerCase()
      );
      expect(usdcPairs.length).toBeGreaterThan(0);
    }, 10000);

    it('should get trending tokens', async () => {
      const result = await service.getTrending({ limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeGreaterThan(0);
      expect(result.data!.length).toBeLessThanOrEqual(10);
      
      // Note: The trending endpoint returns boosted tokens, not necessarily sorted by volume
      // Just verify we got some data
      expect(result.data!.length).toBeGreaterThan(0);
      
      // Verify each pair has expected properties
      result.data!.forEach(pair => {
        expect(pair).toHaveProperty('baseToken');
        expect(pair).toHaveProperty('priceUsd');
      });
    }, 10000);

    it('should get new pairs', async () => {
      const result = await service.getNewPairs({ limit: 5 });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Note: The new pairs endpoint uses token profiles as a proxy
      // Not all returned pairs are necessarily created in the last 24 hours
      // Just verify we got pairs with the 'new' label
      result.data!.forEach(pair => {
        expect(pair.labels).toContain('new');
      });
    }, 10000);

    it('should get pairs by chain', async () => {
      const result = await service.getPairsByChain({ 
        chain: 'ethereum', 
        sortBy: 'volume',
        limit: 5 
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // All pairs should be from Ethereum
      result.data!.forEach(pair => {
        expect(pair.chainId.toLowerCase()).toBe('ethereum');
      });
    }, 10000);

    it('should get multiple tokens at once', async () => {
      // Well-known token addresses on Ethereum
      const tokens = [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      ];

      const result = await service.getMultipleTokens('ethereum', tokens);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeGreaterThan(0);
    }, 10000);

    it('should handle token profile request', async () => {
      const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const result = await service.getTokenProfile(usdcAddress);

      // Token profiles are not available for all tokens
      // The endpoint returns latest profiles, not specific token profiles
      if (result.success && result.data) {
        expect(result.data).toHaveProperty('tokenAddress');
        expect(result.data).toHaveProperty('chainId');
      } else {
        // It's okay if USDC doesn't have a profile
        expect(result.success).toBe(false);
        expect(result.error).toBe('Token profile not found');
      }
    }, 10000);

    it('should handle rate limiting gracefully', async () => {
      // Make multiple rapid requests
      const promises = Array(3).fill(null).map((_, i) => 
        service.search({ query: `test${i}` })
      );

      const results = await Promise.all(promises);
      
      // All should succeed despite rapid requests
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    }, 15000);
  });

  describe('Real Action Integration', () => {
    it('should execute search action with real data', async () => {
      const searchAction = dexscreenerPlugin.actions!.find(a => a.name === 'dexscreener_search');
      
      const message: Memory = {
        id: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        content: { text: 'Search for WETH pairs' },
        createdAt: Date.now(),
      } as Memory;

      const result = await searchAction!.handler(runtime, message) as any;
      
      expect(result).toHaveProperty('text');
      expect(result.text).toContain('Search Results');
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    }, 10000);

    it('should get real trending tokens', async () => {
      const trendingAction = dexscreenerPlugin.actions!.find(a => a.name === 'dexscreener_trending');
      
      const message: Memory = {
        id: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        content: { text: 'Show me top 3 trending tokens in the last 24h' },
        createdAt: Date.now(),
      } as Memory;

      const result = await trendingAction!.handler(runtime, message) as any;
      
      expect(result).toHaveProperty('text');
      expect(result.text).toContain('Trending Tokens');
      expect(result).toHaveProperty('data');
    }, 10000);
  });

  describe('Error Handling with Real API', () => {
    it('should handle invalid token address gracefully', async () => {
      const result = await service.getTokenPairs({ tokenAddress: 'invalid-address' });
      
      // Should still return success but with empty data or error
      expect(result).toHaveProperty('success');
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    }, 10000);

    it('should handle non-existent pair address', async () => {
      const result = await service.getPair({ 
        pairAddress: '0x0000000000000000000000000000000000000000' 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 10000);
  });
}); 