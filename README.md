# Agnetic Tools - Chrome Extension

A comprehensive research assistant that aggregates stock data, news articles, and provides AI-powered analysis directly in your browser. Built specifically for Indian markets and financial research.

## Features

- **Real-time Stock Analysis**: Get live stock prices and historical data from Alpha Vantage and Yahoo Finance
- **News Aggregation**: Fetch relevant news articles from multiple sources including NewsAPI and Currents API
- **AI-Powered Q&A**: Solve complex mathematical problems with step-by-step solutions including calculus, algebra, and statistics
- **Research Synthesis**: Combine market data with news to generate comprehensive investment insights
- **Batch Processing**: Run multiple queries simultaneously for efficient research workflows
- **Export Functionality**: Download your research logs and results in JSON format

## Installation

1. Clone or download this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The Agnetic Tools icon will appear in your extensions toolbar

## Configuration

Before using the extension, configure your API keys in the `config.js` file:

```javascript
const CONFIG = {
    apiKeys: {
        alphaVantage: 'your-alpha-vantage-key',
        newsapi: 'your-newsapi-key',
        grokApiKey: 'your-grok-api-key',
        telegramBotToken: 'your-telegram-bot-token' // optional
    }
};
```

Required API keys:
- **Alpha Vantage**: For stock data (free tier available)
- **NewsAPI**: For news articles (free tier available)
- **Grok API**: For AI analysis and Q&A
- **Telegram Bot**: Optional for notifications

## Usage

### Research Mode
1. Click the Agnetic Tools icon to open the side panel
2. Enter your research query (e.g., "NIFTY 50 analysis", "Reliance Industries news")
3. Click "Research" to get comprehensive analysis combining stock data and news
4. Results include market trends, sentiment analysis, and key insights

### Q&A Mode
1. Enter mathematical questions or problems
2. The extension automatically detects Q&A queries and provides step-by-step solutions
3. Supports calculus, algebra, statistics, and financial calculations

### Batch Processing
1. Use the "Batch" button to run multiple research tasks simultaneously
2. Ideal for comparing multiple stocks or analyzing market sectors
3. Results are automatically aggregated and summarized

### Export Results
1. Click "Logs" to view your complete research history
2. Download results as JSON files for further analysis
3. Clear logs when needed to maintain privacy

## Sample Queries

**Research Examples:**
- "NIFTY 50 performance this week"
- "Indian IT sector latest developments"
- "Reliance Industries quarterly earnings impact"
- "Banking sector news and trends"

**Q&A Examples:**
- "Calculate the integral of x² from 0 to 5"
- "What is 15% compound annual growth on ₹50,000 over 3 years?"
- "Solve the derivative of sin(x) × cos(x)"
- "Calculate the present value of ₹100,000 in 5 years at 8% discount rate"

## Technical Architecture

- **Framework**: Chrome Extension Manifest V3
- **APIs**: Alpha Vantage, Yahoo Finance, NewsAPI, Currents API, Grok AI
- **Storage**: Chrome local storage for logs and preferences
- **UI**: Side panel interface with responsive design
- **Security**: Local data storage, encrypted API communications

## Troubleshooting

**Common Issues:**
- **No data returned**: Verify API keys are correctly configured in config.js
- **Rate limiting**: Extension includes automatic rate limiting and fallback mechanisms
- **Empty results**: Check internet connection and API service status

**API Limitations:**
- Free API tiers have daily/monthly quotas
- Extension includes graceful degradation when limits are reached
- Results may be cached to optimize API usage

## Privacy & Security

- All data is stored locally in your browser
- API calls are made directly from your browser to respective services
- No personal information is collected or transmitted
- You can clear all stored data at any time through the Logs interface

## Regional Focus

This extension is optimized for Indian markets:
- News queries automatically include "India" context
- Stock symbols default to Indian exchanges (NSE/BSE)
- Currency calculations default to Indian Rupees (₹)
- Market hours and timing considerations for Indian markets

## File Structure

- `background.js` - Core logic and API orchestration
- `sidebar.html` & `sidebar.js` - User interface and interactions
- `api-clients.js` - API client implementations
- `llm-processor.js` - AI integration and processing
- `config.js` - Configuration and API keys
- `manifest.json` - Chrome extension metadata

## Support

For technical issues:
1. Check the browser console for error messages
2. Verify API key configuration
3. Ensure stable internet connection
4. Review API service status pages


## What you can do
- Run Research: type a query like “Research NIFTY 50 latest news and trend in India”.
- Run Q&A: type a question (e.g., “Integrate ∫ (3x^2 - 4x + 5) dx”) and click Run Q&A. The LLM answers in steps.
- Run Batch: run a short flow that includes a small calculation, an OTT check (internal), and a research note. Output is a short summary.
- View Logs: see recent runs and download the JSON.

## Install
1) Open Chrome and go to chrome://extensions/
2) Turn on “Developer mode” (top right)
3) Click “Load unpacked” and choose this folder

## Use
1) Click the extension icon to open the side panel
2) Enter a short query
3) Click “Run Research” or “Run Batch”
4) Open “Logs” to see steps and download the data

## Settings
Keys are read from `config.js`.
- LLM: Grok (OpenAI-compatible)
- Stocks: Alpha Vantage (demo) and Finnhub
- News: NewsAPI and Currents (optional)
- Country is set to India only



