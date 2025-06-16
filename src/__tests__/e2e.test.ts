import { describe, it, expect } from 'vitest';
import { IAgentRuntime, Memory, UUID } from '@elizaos/core';
import { dexscreenerPlugin } from '../index';
import { DexScreenerService } from '../service';

// Create a valid UUID for testing
const testUUID = '550e8400-e29b-41d4-a716-446655440000' as UUID;

describe('DexScreener Plugin E2E Tests', () => {
  // Mock runtime for E2E tests
  const createMockRuntime = (): IAgentRuntime => {
    const services = new Map();

    return {
      getSetting: (key: string) => {
        if (key === 'DEXSCREENER_API_URL') return 'https://api.dexscreener.com';
        if (key === 'DEXSCREENER_RATE_LIMIT_DELAY') return '100';
        return undefined;
      },
      getService: (name: string) => services.get(name),
      registerService: (service: any) => {
        services.set(service.serviceType || 'dexscreener', service);
      },
    } as any;
  };

  describe('Plugin Integration', () => {
    it('should initialize plugin correctly', async () => {
      const runtime = createMockRuntime();

      expect(dexscreenerPlugin.name).toBe('dexscreener-analytics-plugin');
      expect(dexscreenerPlugin.description).toBe(
        'Plugin for DexScreener DEX analytics and token information'
      );
      expect(dexscreenerPlugin.actions).toHaveLength(7);
      expect(dexscreenerPlugin.services).toHaveLength(1);
    });

    it('should register DexScreenerService', async () => {
      const runtime = createMockRuntime();

      // Initialize service
      const service = new DexScreenerService(runtime);
      (runtime as any).registerService(service);

      // Verify service is registered
      const retrievedService = runtime.getService('dexscreener');
      expect(retrievedService).toBeDefined();
      expect((retrievedService as any).serviceType).toBe('dexscreener');
    });
  });

  describe('Service Methods', () => {
    it('should search for tokens', async () => {
      const runtime = createMockRuntime();
      const service = new DexScreenerService(runtime);

      // Test with mock data (since we're using mock implementation)
      const result = await service.search({ query: 'PEPE' });

      // Note: In a real E2E test, this would make actual API calls
      // For now, we're testing the interface works correctly
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
    });

    it('should get trending tokens', async () => {
      const runtime = createMockRuntime();
      const service = new DexScreenerService(runtime);

      const result = await service.getTrending({ timeframe: '24h', limit: 5 });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      if (result.data && result.data.length > 0) {
        expect(result.data[0]).toHaveProperty('baseToken');
        expect(result.data[0]).toHaveProperty('quoteToken');
        expect(result.data[0]).toHaveProperty('priceUsd');
      }
    });

    it('should get new pairs', async () => {
      const runtime = createMockRuntime();
      const service = new DexScreenerService(runtime);

      const result = await service.getNewPairs({ chain: 'ethereum', limit: 5 });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data && result.data.length > 0) {
        expect(result.data[0].chainId).toBe('ethereum');
        expect(result.data[0]).toHaveProperty('pairCreatedAt');
      }
    });

    it('should format values correctly', async () => {
      const runtime = createMockRuntime();
      const service = new DexScreenerService(runtime);

      // Test formatters
      expect(service.formatPrice(0.00001234)).toBe('0.00001234');
      expect(service.formatPrice(1234.56)).toBe('1234.56');
      expect(service.formatPriceChange(12.34)).toBe('+12.34%');
      expect(service.formatPriceChange(-5.67)).toBe('-5.67%');
      expect(service.formatUsdValue(1234567)).toBe('$1.23M');
      expect(service.formatUsdValue(1234)).toBe('$1.23K');
    });
  });

  describe('Action Integration', () => {
    it('should execute search action', async () => {
      const runtime = createMockRuntime();
      const service = new DexScreenerService(runtime);
      (runtime as any).registerService(service);

      // Get search action
      const searchAction = dexscreenerPlugin.actions!.find((a) => a.name === 'dexscreener_search');
      expect(searchAction).toBeDefined();

      // Create a message
      const message: Memory = {
        id: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        content: { text: 'Search for PEPE tokens' },
        createdAt: Date.now(),
      } as Memory;

      // Validate and execute
      const isValid = await searchAction!.validate(runtime, message);
      expect(isValid).toBe(true);

      const result = await searchAction!.handler(runtime, message);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('action', 'dexscreener_search');
    });

    it('should execute trending action', async () => {
      const runtime = createMockRuntime();
      const service = new DexScreenerService(runtime);
      (runtime as any).registerService(service);

      // Get trending action
      const trendingAction = dexscreenerPlugin.actions!.find(
        (a) => a.name === 'dexscreener_trending'
      );
      expect(trendingAction).toBeDefined();

      // Create a message
      const message: Memory = {
        id: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        content: { text: 'Show me trending tokens' },
        createdAt: Date.now(),
      } as Memory;

      // Validate and execute
      const isValid = await trendingAction!.validate(runtime, message);
      expect(isValid).toBe(true);

      const result = await trendingAction!.handler(runtime, message) as any;
      expect(result).toHaveProperty('text');
      expect(result.text).toContain('Trending Tokens');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing token address gracefully', async () => {
      const runtime = createMockRuntime();
      const service = new DexScreenerService(runtime);
      (runtime as any).registerService(service);

      const tokenInfoAction = dexscreenerPlugin.actions!.find(
        (a) => a.name === 'dexscreener_token_info'
      );

      const message: Memory = {
        id: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        content: { text: 'Get token info' },
        createdAt: Date.now(),
      } as Memory;

      const result = await tokenInfoAction!.handler(runtime, message) as any;
      expect(result.text).toContain('Please provide a token address');
    });

    it('should handle service errors gracefully', async () => {
      const runtime = createMockRuntime();
      const service = new DexScreenerService(runtime);

      // Override search to simulate error
      service.search = async () => ({
        success: false,
        error: 'API Error',
      });

      (runtime as any).registerService(service);

      const searchAction = dexscreenerPlugin.actions!.find((a) => a.name === 'dexscreener_search');

      const message: Memory = {
        id: testUUID,
        agentId: testUUID,
        roomId: testUUID,
        content: { text: 'Search for INVALID' },
        createdAt: Date.now(),
      } as Memory;

      const result = await searchAction!.handler(runtime, message) as any;
      expect(result.text).toContain('Failed to search');
    });
  });
});
