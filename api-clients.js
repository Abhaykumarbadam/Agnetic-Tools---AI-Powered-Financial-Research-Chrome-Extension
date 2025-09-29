class StockDataClient {
    constructor() {
        this.clients = {
            alphaVantage: new AlphaVantageAPI(),
            yahooFinance: new YahooFinanceAPI(),
            finhub: new FinnhubAPI()
        };
        this.cache = new Map();
        this.lastFetchTime = new Map();
        this.CACHE_DURATION = 60000; // 1 minute cache
    }

    async getStockPrice(symbol) {
        const cacheKey = `stock_${symbol}`;
        const now = Date.now();
        
        if (this.cache.has(cacheKey) && this.lastFetchTime.has(cacheKey)) {
            const cachedData = this.cache.get(cacheKey);
            const lastFetch = this.lastFetchTime.get(cacheKey);
            
            if (now - lastFetch < this.CACHE_DURATION) {
                return cachedData;
            }
        }

        try {
            // Try Alpha Vantage first
            const data = await this.clients.alphaVantage.getStockData(symbol);
            this.cache.set(cacheKey, data);
            this.lastFetchTime.set(cacheKey, now);
            return data;
        } catch (error) {
            console.warn('Alpha Vantage failed, trying Yahoo Finance:', error);
            
            try {
                const data = await this.clients.yahooFinance.getStockData(symbol);
                this.cache.set(cacheKey, data);
                this.lastFetchTime.set(cacheKey, now);
                return data;
            } catch (error2) {
                console.error('All stock APIs failed:', error2);
                throw new Error(`Unable to fetch data for ${symbol}`);
            }
        }
    }

    async getMultipleStockPrices(symbols) {
        const promises = symbols.map(symbol => 
            this.getStockPrice(symbol).catch(error => ({ symbol, error: error.message }))
        );
        
        const results = await Promise.all(promises);
        const data = {};
        
        results.forEach(result => {
            if (result.error) {
                // Reduce noise and fix corrupted message text
                console.warn(`Failed to get data for symbol ${result.symbol}:`, result.error);
                data[result.symbol] = { symbol: result.symbol, error: result.error };
            } else {
                data[result.symbol] = result;
            }
        });
        
        return data;
    }

    async getStockHistory(symbol, timeframe = '1day') {
        try {
            return await this.clients.alphaVantage.getHistoricalData(symbol, timeframe);
        } catch (error) {
            console.error('Error fetching stock history:', error);
            return null;
        }
    }
}

class AlphaVantageAPI {
    constructor() {
        this.baseUrl = 'https://www.alphavantage.co/query';
        this.apiKey = (typeof CONFIG !== 'undefined' && CONFIG.USE_HARDCODED_CONFIG && CONFIG.STOCK?.alphaVantageKey)
            ? CONFIG.STOCK.alphaVantageKey
            : 'demo';
    }

    async getStockData(symbol) {
        const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data['Note']) {
                throw new Error('API rate limit exceeded');
            }
            
            const quote = data['Global Quote'];
            if (!quote) {
                throw new Error('No data found for symbol');
            }
            
            return {
                symbol: symbol,
                price: parseFloat(quote['05. price']),
                open: parseFloat(quote['02. open']),
                high: parseFloat(quote['03. high']),
                low: parseFloat(quote['04. low']),
                volume: parseInt(quote['06. volume']),
                change: parseFloat(quote['09. change']),
                changePercent: quote['10. change percent'],
                timestamp: new Date().toISOString(),
                source: 'alpha_vantage'
            };
        } catch (error) {
            throw new Error(`Alpha Vantage API error: ${error.message}`);
        }
    }

    async getHistoricalData(symbol, timeframe) {
        const functionMap = {
            '1day': 'TIME_SERIES_DAILY',
            '1week': 'TIME_SERIES_WEEKLY',
            '1month': 'TIME_SERIES_MONTHLY'
        };
        
        const url = `${this.baseUrl}?function=${functionMap[timeframe]}&symbol=${symbol}&apikey=${this.apiKey}&outputsize=compact`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data['Note']) {
                throw new Error('API rate limit exceeded');
            }
            
            const timeKeyMap = {
                'TIME_SERIES_DAILY': 'Time Series (Daily)',
                'TIME_SERIES_WEEKLY': 'Weekly Time Series',
                'TIME_SERIES_MONTHLY': 'Monthly Time Series'
            };
            
            const timeSeries = data[timeKeyMap[functionMap[timeframe]]];
            const result = [];
            
            Object.entries(timeSeries).slice(0, 10).forEach(([date, values]) => {
                result.push({
                    date,
                    open: parseFloat(values['1. open']),
                    high: parseFloat(values['2. high']),
                    low: parseFloat(values['3. low']),
                    close: parseFloat(values['4. close']),
                    volume: parseInt(values['5. volume'])
                });
            });
            
            return result;
        } catch (error) {
            throw new Error(`Historical data error: ${error.message}`);
        }
    }
}

class YahooFinanceAPI {
    constructor() {
        this.baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
    }

    async getStockData(symbol) {
        const url = `${this.baseUrl}/${symbol}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.chart || !data.chart.result || !data.chart.result[0]) {
                throw new Error('Invalid symbol or no data');
            }
            
            const result = data.chart.result[0];
            const meta = result.meta;
            
            return {
                symbol: meta.symbol,
                price: meta.regularMarketPrice,
                open: meta.regularMarketOpen,
                high: meta.regularMarketDayHigh,
                low: meta.regularMarketDayLow,
                volume: meta.regularMarketVolume,
                change: meta.regularMarketPrice - meta.previousClose,
                changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
                timestamp: new Date().toISOString(),
                source: 'yahoo_finance'
            };
        } catch (error) {
            throw new Error(`Yahoo Finance API error: ${error.message}`);
        }
    }
}

class FinnhubAPI {
    constructor() {
        this.baseUrl = 'https://finnhub.io/api/v1';
        this.apiKey = (typeof CONFIG !== 'undefined' && CONFIG.USE_HARDCODED_CONFIG && CONFIG.STOCK?.finnhubKey)
            ? CONFIG.STOCK.finnhubKey
            : 'demo';
    }

    async getStockData(symbol) {
        const url = `${this.baseUrl}/quote?symbol=${symbol}&token=${this.apiKey}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            return {
                symbol: symbol,
                price: data.c,
                open: data.o,
                high: data.h,
                low: data.l,
                change: data.d,
                changePercent: data.dp,
                timestamp: new Date().toISOString(),
                source: 'finnhub'
            };
        } catch (error) {
            throw new Error(`Finnhub API error: ${error.message}`);
        }
    }
}

class NewsDataClient {
    constructor() {
        this.clients = {
            newsApi: new NewsAPIClient(),
            currentApi: new CurrentNewsAPIClient()
        };
        this.cache = new Map();
        this._lastWarnAt = 0; // throttle noisy warnings
    }

    async getNews(query, options = {}) {
        const cacheKey = `news_${query}_${JSON.stringify(options)}`;
        const cachedData = this.cache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp) < 300000) { // 5-minute cache
            return cachedData.data;
        }

        try {
            const data = await this.clients.newsApi.getNews(query, options);
            // If NewsAPI is rate-limited and returned empty, try Currents as fallback
            if (Array.isArray(data) && data.length === 0 && this.clients.newsApi.isRateLimited()) {
                const alt = await this.clients.currentApi.getNews(query, options).catch(() => []);
                if (Array.isArray(alt) && alt.length) {
                    this.cache.set(cacheKey, { data: alt, timestamp: Date.now() });
                    return alt;
                }
                const rss = await this.getNewsFromGoogleRss(query, options).catch(() => []);
                this.cache.set(cacheKey, { data: rss, timestamp: Date.now() });
                return rss;
            }
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            // Throttle warnings to at most once per 5 minutes
            const now = Date.now();
            if (now - this._lastWarnAt > 5 * 60 * 1000) {
                console.warn('News API failed, will try Currents if possible:', error?.message || error);
                this._lastWarnAt = now;
            }
            const alt = await this.clients.currentApi.getNews(query, options).catch(() => []);
            if (Array.isArray(alt) && alt.length) {
                this.cache.set(cacheKey, { data: alt, timestamp: Date.now() });
                return alt;
            }
            // Final fallback: Google News RSS (no API key)
            const rss = await this.getNewsFromGoogleRss(query, options).catch(() => []);
            this.cache.set(cacheKey, { data: rss, timestamp: Date.now() });
            return rss;
        }
    }

    async searchForStockNews(symbol) {
        const queries = [
            symbol,
            `${symbol} stock`,
            `${symbol} price`,
            `${symbol} market`,
            `${symbol} trading`
        ];
        
        const allResults = [];
        
        for (const query of queries) {
            try {
                const results = await this.getNews(query, { 
                    sortBy: 'publishedAt',
                    pageSize: 10 
                });
                allResults.push(...results);
            } catch (error) {
                console.warn(`News search failed for query "${query}":`, error);
            }
        }
        
        // Remove duplicates and sort by publishedAt
        const uniqueArticles = [];
        const seenTitles = new Set();
        
        allResults
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
            .forEach(article => {
                if (!seenTitles.has(article.title)) {
                    uniqueArticles.push(article);
                    seenTitles.add(article.title);
                }
            });
        
        return uniqueArticles.slice(0, 20); // Limit to 20 most recent
    }

    // Fallback: Google News RSS (via rss2json proxy for CORS)
    async getNewsFromGoogleRss(query, options = {}) {
        const hl = options.hl || 'en-IN';
        const gl = options.gl || 'IN';
        const ceid = options.ceid || 'IN:en';
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;
        const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        try {
            const res = await fetch(api);
            if (!res.ok) return [];
            const data = await res.json();
            const items = Array.isArray(data?.items) ? data.items : [];
            const mapped = items.map(it => ({
                title: it.title || '',
                description: it.description || '',
                url: it.link || it.url || '',
                urlToImage: undefined,
                publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : undefined,
                source: (data?.feed?.title || 'Google News'),
                content: it.content || ''
            })).filter(a => a.title && a.url);
            const pageSize = options.pageSize || 10;
            return mapped.slice(0, pageSize);
        } catch (_) {
            return [];
        }
    }

    _xmlTag(chunk, tag) {
        const r = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, 'i');
        const mm = r.exec(chunk);
        return mm ? this._decodeHtml(mm[1]).trim() : '';
    }

    _decodeHtml(s) {
        if (!s) return '';
        return s
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }
}

class NewsAPIClient {
    constructor() {
        this.baseUrl = 'https://newsapi.org/v2';
        this.apiKey = (typeof CONFIG !== 'undefined' && CONFIG.USE_HARDCODED_CONFIG && CONFIG.NEWS?.newsApiKey)
            ? CONFIG.NEWS.newsApiKey
            : 'demo';
        this._rateLimitedUntil = 0; // timestamp ms
        this._lastWarnAt = 0;
    }

    async getNews(query, options = {}) {
        // Respect cooldown if previously rate-limited
        const now = Date.now();
        if (now < this._rateLimitedUntil) {
            return [];
        }
        const params = new URLSearchParams({
            q: query,
            apiKey: this.apiKey,
            sortBy: options.sortBy || 'publishedAt',
            pageSize: options.pageSize || 10,
            language: options.language || 'en'
        });
        
        const url = `${this.baseUrl}/everything?${params}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status !== 'ok') {
                const msg = (data?.message || '').toString();
                const lower = msg.toLowerCase();
                // If clearly rate-limited, set a cooldown (6 hours) and log once
                if (lower.includes('too many requests') || lower.includes('rate') || lower.includes('limit')) {
                    this._rateLimitedUntil = Date.now() + 6 * 60 * 60 * 1000;
                    if (now - this._lastWarnAt > 5 * 60 * 1000) {
                        console.warn('NewsAPI rate-limited. Cooling down for 6 hours. Message:', msg);
                        this._lastWarnAt = now;
                    }
                    return [];
                }
                // Graceful degrade for other errors
                if (now - this._lastWarnAt > 5 * 60 * 1000) {
                    console.warn('NewsAPI response not ok:', msg || data);
                    this._lastWarnAt = now;
                }
                return [];
            }
            
            return data.articles.map(article => ({
                title: article.title,
                description: article.description,
                url: article.url,
                urlToImage: article.urlToImage,
                publishedAt: article.publishedAt,
                source: article.source?.name || 'Unknown',
                content: article.content
            }));
        } catch (error) {
            if (Date.now() - this._lastWarnAt > 5 * 60 * 1000) {
                console.warn('News API error:', error?.message || error);
                this._lastWarnAt = Date.now();
            }
            return [];
        }
    }

    isRateLimited() {
        return Date.now() < this._rateLimitedUntil;
    }
}

class CurrentNewsAPIClient {
    constructor() {
        this.baseUrl = 'https://api.currentsapi.services/v1';
        this.apiKey = (typeof CONFIG !== 'undefined' && CONFIG.USE_HARDCODED_CONFIG && CONFIG.NEWS?.currentsApiKey)
            ? CONFIG.NEWS.currentsApiKey
            : 'demo';
    }

    async getNews(query, options = {}) {
        const params = new URLSearchParams({
            keywords: query,
            apiKey: this.apiKey,
            language: 'en',
            number: options.pageSize || 10
        });
        
        const url = `${this.baseUrl}/search?${params}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status !== 'ok') {
                // Graceful degrade: log and return empty array
                console.warn('Currents API response not ok:', data?.message || data);
                return [];
            }
            
            return data.news.map(article => ({
                title: article.title,
                description: article.description,
                url: article.url,
                urlToImage: article.image,
                publishedAt: article.published,
                source: article.author || 'Unknown',
                content: article.description
            }));
        } catch (error) {
            console.warn('Currents API error:', error?.message || error);
            return [];
        }
    }
}

// Make classes globally available
if (typeof window !== 'undefined') {
    window.StockDataClient = StockDataClient;
    window.NewsDataClient = NewsDataClient;
} else if (typeof global !== 'undefined') {
    global.StockDataClient = StockDataClient;
    global.NewsDataClient = NewsDataClient;
} else {
    // Service worker environment
    self.StockDataClient = StockDataClient;
    self.NewsDataClient = NewsDataClient;
}

