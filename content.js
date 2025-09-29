class AgenticContentScript {
    constructor() {
        this.waitingForResponse = false;
        this.fetchPatched = false;
        this.init();
    }

    init() {
        this.injectTaskParser();
        this.setupApiRequestInterception();
        this.handleContextualMentions();
    }

    injectTaskParser() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    this.scanForTaskOpportunities();
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scanForTaskOpportunities() {
        const stockSymbolRegex = /\b[A-Z]{2,5}\s+(?:stock|share|price|trading)\b|(?:stock|share|price)\s+of\s+\b[A-Z]{2,5}\b|NYSE:\s*([A-Z]{2,5})|NASDAQ:\s*([A-Z]{2,5})/gi;
        const priceMentions = /(?:over|above|below|under|>|>|\s)\s*\$(\d+(?:\.\d+)?)/gi;
        
        const textNodes = this.getTextNodes(document.body);
        const matches = textNodes.reduce((acc, node) => {
            const text = node.textContent;
            const symbolMatches = [...text.matchAll(stockSymbolRegex)];
            const priceMatches = [...text.matchAll(priceMentions)];
            
            symbolMatches.forEach(match => {
                const symbol = match[1] || match[2] || match[0].split(/[:\s]+/).pop();
                acc.symbols.add(symbol);
            });
            
            priceMatches.forEach(match => {
                acc.prices.push(parseFloat(match[1]));
            });
            
            return acc;
        }, { symbols: new Set(), prices: [] });

        if (matches.symbols.size > 0) {
            this.suggestTaskCreation(Array.from(matches.symbols), matches.prices);
        }
    }

    suggestTaskCreation(symbols, prices) {
        if (this.waitingForResponse) return;
        
        this.waitingForResponse = true;
        this.safeSendMessage('SAVE_DETECTED_CONTEXT', {
            pageTitle: document.title,
            url: window.location.href,
            symbols,
            prices,
            timestamp: Date.now()
        }).finally(() => {
            this.waitingForResponse = false;
        });
    }

    setupApiRequestInterception() {
        if (this.fetchPatched || typeof window.fetch !== 'function') return;
        this.fetchPatched = true;
        
        const originalFetch = window.fetch;
        const self = this;

        window.fetch = async function(...args) {
            const response = await originalFetch.apply(this, args);
            try {
                const url = args[0];
                if (typeof url === 'string' && (
                    url.includes('api.alphavantage.co') ||
                    url.includes('query1.finance.yahoo.com') ||
                    url.includes('newsapi.org')
                )) {
                    try {
                        const clonedResponse = response.clone();
                        self.examineApiResponse(url, clonedResponse);
                    } catch (_) { /* noop */ }
                }
            } catch (_) { /* noop */ }
            return response;
        };
    }

    async examineApiResponse(url, response) {
        try {
            const data = await response.json();
            
            await this.safeSendMessage('SAVE_API_DATA', {
                url,
                timestamp: Date.now(),
                responseSummary: this.summarizeApiResponse(data, url)
            });
        } catch (error) {
            // Invalid JSON or other parsing issues
        }
    }

    summarizeApiResponse(data, url) {
        if (url.includes('alphavantage.co')) {
            return {
                source: 'alpha_vantage',
                symbols: Object.keys(data.time_series || {}),
                lastUpdate: Object.keys(data.time_series || {})[0],
                dimension: 'stocks'
            };
        } else if (url.includes('finance.yahoo.com')) {
            return {
                source: 'yahoo_finance',
                symbol: data.chart?.result?.[0]?.meta?.symbol,
                price: data.chart?.result?.[0]?.meta?.regularMarketPrice,
                dimension: 'stocks'
            };
        } else if (url.includes('newsapi.org')) {
            return {
                source: 'news_api',
                articleCount: data.articles?.length || 0,
                keywords: this.extractKeywords(data),
                dimension: 'news'
            };
        }
        
        return { dimension: 'unknown', data };
    }

    extractKeywords(newsData) {
        if (!newsData.articles) return [];
        
        const keywords = new Set();
        newsData.articles.slice(0, 5).forEach(article => {
            const words = (article.title + ' ' + article.description)
                .toLowerCase()
                .match(/\b\w{4,}\b/g) || [];
            words.forEach(word => {
                if (word !== 'stock' && word !== 'price') {
                    keywords.add(word);
                }
            });
        });
        
        return Array.from(keywords).slice(0, 10);
    }

    handleContextualMentions() {
        // Listen for selection events that might indicate the user wants to track something
        document.addEventListener('mouseup', () => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            if (selectedText && selectedText.length > 3 && selectedText.length < 50) {
                this.evaluateSelectionForTracking(selectedText);
            }
        });
    }

    evaluateSelectionForTracking(selectedText) {
        // Simple pattern matching for potentially interesting text
        const stockSymbolPattern = /\b[A-Z]{2,5}\b/;
        const pricePattern = /\$\d+(?:\.\d{2})?/;
        const indexMention = /\b(?:index|sector)\b.*(?:[A-Z]{3,5}|DOW|SP500|NASDAQ)/i;
        
        const hasStockSymbol = stockSymbolPattern.test(selectedText);
        const hasPrice = pricePattern.test(selectedText);
        const hasIndex = indexMention.test(selectedText);
        
        if (hasStockSymbol || hasPrice || hasIndex) {
            this.safeSendMessage('SELECTION_INTEREST_DETECTED', {
                text: selectedText,
                type: hasStockSymbol ? 'stock' : hasPrice ? 'price' : 'index',
                url: window.location.href
            });
        }
    }

    getTextNodes(element) {
        const textNodes = [];
        
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.trim().length > 10) {
                textNodes.push(node);
            }
        }
        
        return textNodes;
    }
}

// Safe messaging helper to avoid uncaught errors when extension context is invalidated
AgenticContentScript.prototype.safeSendMessage = function(type, payload) {
    return new Promise((resolve) => {
        try {
            if (!chrome || !chrome.runtime || !chrome.runtime.id) {
                return resolve(false);
            }
            chrome.runtime.sendMessage({ type, ...(payload !== undefined ? { [type === 'SAVE_DETECTED_CONTEXT' ? 'context' : 'data']: payload } : {}) }, () => {
                // Swallow errors like 'Extension context invalidated' or 'Receiving end does not exist'
                void chrome.runtime?.lastError;
                resolve(true);
            });
        } catch (_) {
            resolve(false);
        }
    });
};

// Initialize content script
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new AgenticContentScript();
    });
} else {
    new AgenticContentScript();
}

