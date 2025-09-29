(function attachConfig(root){
  const CONFIG = {
    USE_HARDCODED_CONFIG: true,

    COUNTRY: 'IN',

    // LLM provider (Grok via OpenAI-compatible API)
    LLM: {
      baseUrl: 'https://api.x.ai/v1/chat/completions',
      model: 'grok-beta',
      apiKey: ''
    },

    // Stock data APIs (safe defaults)
    STOCK: {
      alphaVantageKey: 'demo', // public demo key for limited testing
      finnhubKey: ''
    },

    // News APIs (optional)
    NEWS: {
      newsApiKey: '',
      currentsApiKey: ''
    },

    // Optional: Telegram notifications for OTT digest
    TELEGRAM: {
      botToken: '',
      chatId: ''
    }
  };

  // Expose globally
  if (typeof root !== 'undefined') {
    root.CONFIG = CONFIG;
  }
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

// Tip: For personal overrides, create a non-committed `config.local.js` that sets `self.CONFIG = { ... }`
// and load it before other scripts locally. Do not include real keys in version control.
