import { Action, ActionExample, IAgentRuntime, Memory, Content } from '@elizaos/core';
import { DexScreenerService } from './service';

// Search Action
export const searchTokensAction: Action = {
  name: 'dexscreener_search',
  description: 'Search for tokens/pairs on DexScreener',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = typeof message.content === 'string' ? message.content : message.content.text;
    return (
      content.toLowerCase().includes('search') ||
      content.toLowerCase().includes('find') ||
      content.toLowerCase().includes('look for')
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService('dexscreener') as DexScreenerService;
    const content = typeof message.content === 'string' ? message.content : message.content.text;

    // Extract search query
    const queryMatch = content.match(
      /(?:search|find|look for)\s+(?:for\s+)?(.+?)(?:\s+on\s+dexscreener)?$/i
    );

    if (!queryMatch) {
      return {
        text: 'Please provide a search query. Example: "Search for PEPE"',
        action: 'dexscreener_search',
      };
    }

    const result = await service.search({ query: queryMatch[1].trim() });

    if (!result.success || !result.data) {
      return {
        text: `Failed to search: ${result.error}`,
        action: 'dexscreener_search',
      };
    }

    const pairs = result.data.slice(0, 5); // Limit to 5 results

    if (pairs.length === 0) {
      return {
        text: `No results found for "${queryMatch[1].trim()}"`,
        action: 'dexscreener_search',
      };
    }

    const pairList = pairs
      .map((pair, i) => {
        const priceChange = service.formatPriceChange(pair.priceChange.h24);
        return (
          `**${i + 1}. ${pair.baseToken.symbol}/${pair.quoteToken.symbol}** on ${pair.dexId} (${pair.chainId})\n` +
          `   💰 Price: ${service.formatPrice(pair.priceUsd || pair.priceNative)}\n` +
          `   📈 24h: ${priceChange} | Vol: ${service.formatUsdValue(pair.volume.h24)}\n` +
          `   💧 Liq: ${pair.liquidity?.usd ? service.formatUsdValue(pair.liquidity.usd) : 'N/A'}\n` +
          `   🔗 ${pair.url}`
        );
      })
      .join('\n\n');

    return {
      text: `**🔍 Search Results for "${queryMatch[1].trim()}"**\n\n${pairList}`,
      action: 'dexscreener_search',
      data: pairs,
    };
  },

  similes: ['find token', 'look for', 'search dexscreener'],

  examples: [
    [
      {
        name: 'Search for token',
        content: { text: 'Search for PEPE tokens' } as Content,
      },
      {
        name: 'Find specific token',
        content: { text: 'Find USDC pairs on dexscreener' } as Content,
      },
    ],
  ],
};

// Get Token Info Action
export const getTokenInfoAction: Action = {
  name: 'dexscreener_token_info',
  description: 'Get detailed information about a token from DexScreener',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = typeof message.content === 'string' ? message.content : message.content.text;
    return (
      content.toLowerCase().includes('token') &&
      (content.includes('info') || content.includes('details') || content.includes('price'))
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService('dexscreener') as DexScreenerService;
    const content = typeof message.content === 'string' ? message.content : message.content.text;

    // Extract token address
    const addressMatch = content.match(/0x[a-fA-F0-9]{40}/);

    if (!addressMatch) {
      return {
        text: 'Please provide a token address. Example: "Get token info for 0x..."',
        action: 'dexscreener_token_info',
      };
    }

    const result = await service.getTokenPairs({ tokenAddress: addressMatch[0] });

    if (!result.success || !result.data) {
      return {
        text: `Failed to get token info: ${result.error}`,
        action: 'dexscreener_token_info',
      };
    }

    const pairs = result.data;

    if (pairs.length === 0) {
      return {
        text: `No pairs found for token ${addressMatch[0]}`,
        action: 'dexscreener_token_info',
      };
    }

    // Get the most liquid pair
    const mainPair = pairs.reduce((prev, curr) =>
      (curr.liquidity?.usd || 0) > (prev.liquidity?.usd || 0) ? curr : prev
    );

    const pairList = pairs
      .slice(0, 3)
      .map(
        (pair) =>
          `• **${pair.baseToken.symbol}/${pair.quoteToken.symbol}** on ${pair.dexId} (${pair.chainId})\n` +
          `  Price: ${service.formatPrice(pair.priceUsd || pair.priceNative)} | Liq: ${pair.liquidity?.usd ? service.formatUsdValue(pair.liquidity.usd) : 'N/A'}`
      )
      .join('\n');

    return {
      text:
        `**📊 Token Information**\n\n` +
        `**Token:** ${mainPair.baseToken.name} (${mainPair.baseToken.symbol})\n` +
        `**Address:** \`${mainPair.baseToken.address}\`\n` +
        `**Price:** ${service.formatPrice(mainPair.priceUsd || mainPair.priceNative)}\n` +
        `**24h Change:** ${service.formatPriceChange(mainPair.priceChange.h24)}\n` +
        `**24h Volume:** ${service.formatUsdValue(mainPair.volume.h24)}\n` +
        `**Market Cap:** ${mainPair.marketCap ? service.formatUsdValue(mainPair.marketCap) : 'N/A'}\n` +
        `**FDV:** ${mainPair.fdv ? service.formatUsdValue(mainPair.fdv) : 'N/A'}\n\n` +
        `**Top Trading Pairs:**\n${pairList}`,
      action: 'dexscreener_token_info',
      data: pairs,
    };
  },

  similes: ['token details', 'token price', 'get token', 'check token'],

  examples: [
    [
      {
        name: 'Get token info',
        content: {
          text: 'Get token info for 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        } as Content,
      },
      {
        name: 'Check token price',
        content: { text: 'What is the price of token 0x...' } as Content,
      },
    ],
  ],
};

// Get Trending Tokens Action
export const getTrendingAction: Action = {
  name: 'dexscreener_trending',
  description: 'Get trending tokens from DexScreener',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = typeof message.content === 'string' ? message.content : message.content.text;
    return (
      content.toLowerCase().includes('trending') ||
      content.toLowerCase().includes('hot') ||
      content.toLowerCase().includes('popular') ||
      content.toLowerCase().includes('gainers')
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService('dexscreener') as DexScreenerService;
    const content = typeof message.content === 'string' ? message.content : message.content.text;

    // Extract timeframe and limit
    const timeframeMatch = content.match(/\b(1h|6h|24h)\b/);
    const limitMatch = content.match(/top\s+(\d+)/i);

    const result = await service.getTrending({
      timeframe: (timeframeMatch?.[1] as '1h' | '6h' | '24h') || '24h',
      limit: limitMatch ? parseInt(limitMatch[1]) : 10,
    });

    if (!result.success || !result.data) {
      return {
        text: `Failed to get trending tokens: ${result.error}`,
        action: 'dexscreener_trending',
      };
    }

    const pairs = result.data;

    const trendingList = pairs
      .map((pair, i) => {
        const priceChange = service.formatPriceChange(pair.priceChange.h24);
        return (
          `**${i + 1}. ${pair.baseToken.symbol}/${pair.quoteToken.symbol}**\n` +
          `   💰 ${service.formatPrice(pair.priceUsd || pair.priceNative)} (${priceChange})\n` +
          `   📊 Vol: ${service.formatUsdValue(pair.volume.h24)} | MCap: ${pair.marketCap ? service.formatUsdValue(pair.marketCap) : 'N/A'}\n` +
          `   🔥 Buys: ${pair.txns.h24.buys} | Sells: ${pair.txns.h24.sells}`
        );
      })
      .join('\n\n');

    return {
      text: `**🔥 Trending Tokens (${timeframeMatch?.[1] || '24h'})**\n\n${trendingList}`,
      action: 'dexscreener_trending',
      data: pairs,
    };
  },

  similes: ['hot tokens', 'popular coins', 'top gainers', "what's trending"],

  examples: [
    [
      {
        name: 'Get trending tokens',
        content: { text: 'Show me trending tokens on DexScreener' } as Content,
      },
      {
        name: 'Top gainers with timeframe',
        content: { text: 'What are the top 5 hot tokens in the last 6h?' } as Content,
      },
    ],
  ],
};

// Get New Pairs Action
export const getNewPairsAction: Action = {
  name: 'dexscreener_new_pairs',
  description: 'Get newly created trading pairs from DexScreener',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = typeof message.content === 'string' ? message.content : message.content.text;
    return (
      content.toLowerCase().includes('new') &&
      (content.toLowerCase().includes('pairs') ||
        content.toLowerCase().includes('tokens') ||
        content.toLowerCase().includes('listings'))
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService('dexscreener') as DexScreenerService;
    const content = typeof message.content === 'string' ? message.content : message.content.text;

    // Extract chain and limit
    const chainMatch = content.match(/on\s+(\w+)/i);
    const limitMatch = content.match(/(\d+)\s+(?:new|latest)/i);

    const result = await service.getNewPairs({
      chain: chainMatch?.[1],
      limit: limitMatch ? parseInt(limitMatch[1]) : 10,
    });

    if (!result.success || !result.data) {
      return {
        text: `Failed to get new pairs: ${result.error}`,
        action: 'dexscreener_new_pairs',
      };
    }

    const pairs = result.data;

    const newPairsList = pairs
      .map((pair, i) => {
        const age = pair.pairCreatedAt
          ? `${Math.floor((Date.now() - pair.pairCreatedAt) / 60000)} mins ago`
          : 'Unknown';
        return (
          `**${i + 1}. ${pair.baseToken.symbol}/${pair.quoteToken.symbol}** ${pair.labels?.includes('new') ? '🆕' : ''}\n` +
          `   ⏰ Created: ${age} on ${pair.dexId} (${pair.chainId})\n` +
          `   💰 Price: ${service.formatPrice(pair.priceUsd || pair.priceNative)}\n` +
          `   💧 Liquidity: ${pair.liquidity?.usd ? service.formatUsdValue(pair.liquidity.usd) : 'N/A'}`
        );
      })
      .join('\n\n');

    return {
      text: `**🆕 New Trading Pairs${chainMatch ? ` on ${chainMatch[1]}` : ''}**\n\n${newPairsList}`,
      action: 'dexscreener_new_pairs',
      data: pairs,
    };
  },

  similes: ['new listings', 'latest pairs', 'new tokens', 'fresh pairs'],

  examples: [
    [
      {
        name: 'Get new pairs',
        content: { text: 'Show me new pairs on DexScreener' } as Content,
      },
      {
        name: 'New pairs on specific chain',
        content: { text: 'What are the 5 new tokens on ethereum?' } as Content,
      },
    ],
  ],
};

// Get Pairs by Chain Action
export const getPairsByChainAction: Action = {
  name: 'dexscreener_chain_pairs',
  description: 'Get top trading pairs from a specific blockchain',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = typeof message.content === 'string' ? message.content : message.content.text;
    const chains = [
      'ethereum',
      'bsc',
      'polygon',
      'arbitrum',
      'optimism',
      'base',
      'solana',
      'avalanche',
    ];
    return chains.some((chain) => content.toLowerCase().includes(chain));
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService('dexscreener') as DexScreenerService;
    const content = typeof message.content === 'string' ? message.content : message.content.text;

    // Extract chain
    const chains = [
      'ethereum',
      'bsc',
      'polygon',
      'arbitrum',
      'optimism',
      'base',
      'solana',
      'avalanche',
    ];
    const chain = chains.find((c) => content.toLowerCase().includes(c));

    if (!chain) {
      return {
        text: 'Please specify a blockchain. Supported: ethereum, bsc, polygon, arbitrum, optimism, base, solana, avalanche',
        action: 'dexscreener_chain_pairs',
      };
    }

    // Extract sort criteria
    let sortBy: 'volume' | 'liquidity' | 'priceChange' | 'txns' = 'volume';
    if (content.includes('liquid')) sortBy = 'liquidity';
    else if (content.includes('gain') || content.includes('change')) sortBy = 'priceChange';
    else if (content.includes('active') || content.includes('trades')) sortBy = 'txns';

    const result = await service.getPairsByChain({
      chain,
      sortBy,
      limit: 10,
    });

    if (!result.success || !result.data) {
      return {
        text: `Failed to get ${chain} pairs: ${result.error}`,
        action: 'dexscreener_chain_pairs',
      };
    }

    const pairs = result.data;

    const pairsList = pairs
      .slice(0, 5)
      .map((pair, i) => {
        const metric =
          sortBy === 'volume'
            ? `Vol: ${service.formatUsdValue(pair.volume.h24)}`
            : sortBy === 'liquidity'
              ? `Liq: ${pair.liquidity?.usd ? service.formatUsdValue(pair.liquidity.usd) : 'N/A'}`
              : sortBy === 'priceChange'
                ? `24h: ${service.formatPriceChange(pair.priceChange.h24)}`
                : `Trades: ${pair.txns.h24.buys + pair.txns.h24.sells}`;
        return (
          `**${i + 1}. ${pair.baseToken.symbol}/${pair.quoteToken.symbol}** on ${pair.dexId}\n` +
          `   💰 ${service.formatPrice(pair.priceUsd || pair.priceNative)} | ${metric}`
        );
      })
      .join('\n\n');

    return {
      text: `**⛓️ Top ${chain.charAt(0).toUpperCase() + chain.slice(1)} Pairs by ${sortBy}**\n\n${pairsList}`,
      action: 'dexscreener_chain_pairs',
      data: pairs,
    };
  },

  similes: ['tokens on', 'pairs on', 'top on'],

  examples: [
    [
      {
        name: 'Get chain pairs',
        content: { text: 'Show me top tokens on ethereum' } as Content,
      },
      {
        name: 'Most liquid on chain',
        content: { text: 'What are the most liquid pairs on polygon?' } as Content,
      },
    ],
  ],
};

// Get Boosted Tokens Action
export const getBoostedTokensAction: Action = {
  name: 'dexscreener_boosted_tokens',
  description: 'Get boosted tokens from DexScreener',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = typeof message.content === 'string' ? message.content : message.content.text;
    return (
      content.toLowerCase().includes('boosted') ||
      content.toLowerCase().includes('promoted') ||
      content.toLowerCase().includes('sponsored')
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService('dexscreener') as DexScreenerService;
    const content = typeof message.content === 'string' ? message.content : message.content.text;

    // Check if asking for top or latest
    const isTop = content.toLowerCase().includes('top');

    const result = isTop
      ? await service.getTopBoostedTokens()
      : await service.getLatestBoostedTokens();

    if (!result.success || !result.data) {
      return {
        text: `Failed to get boosted tokens: ${result.error}`,
        action: 'dexscreener_boosted_tokens',
      };
    }

    const tokens = result.data.slice(0, 10);

    if (tokens.length === 0) {
      return {
        text: 'No boosted tokens found',
        action: 'dexscreener_boosted_tokens',
      };
    }

    const tokenList = tokens
      .map((token: any, i: number) => {
        return (
          `**${i + 1}. ${token.tokenAddress}** on ${token.chainId}\n` +
          `   💰 Boost Amount: ${token.amount} (Total: ${token.totalAmount})\n` +
          `   📝 ${token.description || 'No description'}\n` +
          `   🔗 ${token.url}`
        );
      })
      .join('\n\n');

    return {
      text: `**⚡ ${isTop ? 'Top' : 'Latest'} Boosted Tokens**\n\n${tokenList}`,
      action: 'dexscreener_boosted_tokens',
      data: tokens,
    };
  },

  similes: ['promoted tokens', 'sponsored tokens', 'boosted coins'],

  examples: [
    [
      {
        name: 'Get boosted tokens',
        content: { text: 'Show me boosted tokens on DexScreener' } as Content,
      },
      {
        name: 'Top boosted tokens',
        content: { text: 'What are the top promoted tokens?' } as Content,
      },
    ],
  ],
};

// Get Token Profiles Action
export const getTokenProfilesAction: Action = {
  name: 'dexscreener_token_profiles',
  description: 'Get latest token profiles from DexScreener',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = typeof message.content === 'string' ? message.content : message.content.text;
    return (
      content.toLowerCase().includes('profile') &&
      content.toLowerCase().includes('token')
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    const service = runtime.getService('dexscreener') as DexScreenerService;

    const result = await service.getLatestTokenProfiles();

    if (!result.success || !result.data) {
      return {
        text: `Failed to get token profiles: ${result.error}`,
        action: 'dexscreener_token_profiles',
      };
    }

    const profiles = result.data.slice(0, 5);

    if (profiles.length === 0) {
      return {
        text: 'No token profiles found',
        action: 'dexscreener_token_profiles',
      };
    }

    const profileList = profiles
      .map((profile, i) => {
        const links = profile.links?.map(l => `[${l.label}](${l.url})`).join(' | ') || 'No links';
        return (
          `**${i + 1}. ${profile.tokenAddress}** on ${profile.chainId}\n` +
          `   📝 ${profile.description || 'No description'}\n` +
          `   🔗 Links: ${links}\n` +
          `   🌐 ${profile.url}`
        );
      })
      .join('\n\n');

    return {
      text: `**📋 Latest Token Profiles**\n\n${profileList}`,
      action: 'dexscreener_token_profiles',
      data: profiles,
    };
  },

  similes: ['token profiles', 'token details page'],

  examples: [
    [
      {
        name: 'Get token profiles',
        content: { text: 'Show me latest token profiles' } as Content,
      },
    ],
  ],
};

// Export all actions
export const dexscreenerActions = [
  searchTokensAction,
  getTokenInfoAction,
  getTrendingAction,
  getNewPairsAction,
  getPairsByChainAction,
  getBoostedTokensAction,
  getTokenProfilesAction,
];
