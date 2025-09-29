class LLMProcessor {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions'; // Default to OpenAI, can be overridden
        this.model = 'gpt-3.5-turbo';
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.failureCount = 0;
        this.remoteDisabled = false;
        
        this.instructionPrompts = {
            task_understanding: this.getTaskUnderstandingPrompt(),
            condition_analysis: this.getConditionAnalysisPrompt(),
            data_interpretation: this.getDataInterpretationPrompt(),
            decision_making: this.getDecisionMakingPrompt(),
            notification_content: this.getNotificationContentPrompt()
        };
    }

    async initialize() {
        try {
            if (typeof CONFIG !== 'undefined' && CONFIG.USE_HARDCODED_CONFIG && CONFIG.LLM) {
                this.apiKey = CONFIG.LLM.apiKey || this.apiKey;
                this.baseUrl = CONFIG.LLM.baseUrl || this.baseUrl;
                this.model = CONFIG.LLM.model || this.model;
                return;
            }

            const settings = await chrome.storage.local.get(['agentic_settings']);
            const saved = settings.agentic_settings;
            if (saved && saved.apiKey) this.apiKey = saved.apiKey;
            if (saved && saved.llmBaseUrl) this.baseUrl = saved.llmBaseUrl;
            if (saved && saved.llmModel) this.model = saved.llmModel;
        } catch (error) {
            console.warn('Could not load LLM settings:', error);
        }
    }

    async processTaskInput(userInput) {
        const cacheKey = `task_input_${userInput}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const prompt = this.buildTaskAnalysisPrompt(userInput);
        const result = await this.makeLLMCall(prompt, 'task_understanding');
        
        if (result) {
            this.storeInCache(cacheKey, result);
        }
        
        return result;
    }

    async analyzeConditionResults(task, data, conditionResults) {
        const cacheKey = `condition_analysis_${task.id}_${JSON.stringify(conditionResults)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const prompt = this.buildConditionAnalysisPrompt(task, data, conditionResults);
        const result = await this.makeLLMCall(prompt, 'condition_analysis');
        
        if (result) {
            this.storeInCache(cacheKey, result);
        }
        
        return result;
    }

    async interpretMarketData(symbol, data, newsContext = []) {
        const cacheKey = `market_interpretation_${symbol}_${Date.now()}`;
        
        const prompt = this.buildMarketDataPrompt(symbol, data, newsContext);
        const analysis = await this.makeLLMCall(prompt, 'data_interpretation');
        
        return {
            symbol,
            analysis: analysis || this.getDefaultMarketAnalysis(data),
            timestamp: Date.now(),
            confidence: this.calculateConfidenceScore(data)
        };
    }

    async generateNotificationContent(task, triggerEvent, data) {
        const prompt = this.buildNotificationPrompt(task, triggerEvent, data);
        return await this.makeLLMCall(prompt, 'notification_content');
    }

    async decideNextAction(task, currentState, historicalData) {
        const prompt = this.buildDecisionPrompt(task, currentState, historicalData);
        return await this.makeLLMCall(prompt, 'decision_making');
    }

    // Lightweight helpers for research agent (labels only; reuse existing prompt types)
    async researchPlan(queryText) {
        const prompt = `Create a 3-step research plan for: ${queryText}. Steps must use: (1) News, (2) Price History 30d, (3) Synthesis. Return JSON.`;
        return await this.makeLLMCall(prompt, 'task_understanding');
    }
    async researchSynthesize(context) {
        const prompt = `Synthesize a concise research note (<=120 words) based on: ${context}`;
        return await this.makeLLMCall(prompt, 'data_interpretation');
    }

    // Private helper methods
    async makeLLMCall(prompt, promptType) {
        if (!this.apiKey || this.remoteDisabled) {
            // Fallback to rule-based processing
            return this.fallbackProcessing(promptType, prompt);
        }

        try {
            const messages = [
                {
                    role: 'system',
                    content: this.instructionPrompts[promptType]
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    temperature: 0.3,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                // Immediately disable remote calls for 400/401 style client errors
                if (response.status === 400 || response.status === 401) {
                    this.remoteDisabled = true;
                    this.apiKey = null; // ensure all callers go to fallback immediately
                }
                throw new Error(`LLM API error: ${response.status} ${response.statusText || ''}`.trim());
            }

            const result = await response.json();
            return this.parseLLMResponse(result);
        } catch (error) {
            // Downgrade to warning and implement quick backoff to stop repeated failures
            console.warn('LLM API call failed:', String(error && error.message ? error.message : error));
            this.failureCount = (this.failureCount || 0) + 1;
            if (this.failureCount >= 1) {
                // Disable further remote calls; use fallback for the rest of the session
                this.apiKey = null;
                this.remoteDisabled = true;
            }
            return this.fallbackProcessing(promptType, prompt);
        }
    }

    parseLLMResponse(response) {
        try {
            const content = response.choices[0].message.content;
            
            // Try to parse as JSON first
            try {
                return JSON.parse(content);
            } catch {
                // Return as structured response object
                return {
                    text: content,
                    parsed: true,
                    timestamp: Date.now()
                };
            }
        } catch (error) {
            // Downgrade parse errors to warning to reduce noise
            console.warn('Failed to parse LLM response; using plain text fallback');
            return {
                text: 'Unable to process LLM response',
                parsed: false
            };
        }
    }

    fallbackProcessing(promptType, prompt) {
        switch (promptType) {
            case 'task_understanding':
                return this.fallbackTaskUnderstanding(prompt);
            case 'condition_analysis':
                return this.fallbackConditionAnalysis(prompt);
            case 'data_interpretation':
                return this.fallbackDataInterpretation(prompt);
            case 'decision_making':
                return this.fallbackDecisionMaking(prompt);
            default:
                return { text: 'Processing unavailable', parsed: false };
        }
    }

    // Prompt builders
    buildTaskAnalysisPrompt(userInput) {
        return `Analyze the following user input to extract monitoring parameters:

User Input: "${userInput}"

Please extract:
1. Task type (stock_monitor, news_monitor, general_alert)
2. Assets/symbols to monitor
3. Conditions to check (price thresholds, news keywords, etc.)
4. Notification preferences
5. Time constraints or frequencies

Return as JSON with the extracted information.`;
    }

    buildConditionAnalysisPrompt(task, data, conditionResults) {
        return `Analyze these condition check results:

Task: ${task.name}
Conditions checked: ${JSON.stringify(task.conditions, null, 2)}
Data collected: ${JSON.stringify(data, null, 2)}
Results: ${JSON.stringify(conditionResults, null, 2)}

Provide:
1. Which conditions were met/unmet
2. Whether any action should be triggered
3. Context analysis of the results
4. Confidence level in the analysis

Return as structured analysis.`;
    }

    buildMarketDataPrompt(symbol, data, newsContext) {
        const newsSummary = newsContext.slice(0, 5).map(article => 
            `${article.title}: ${article.description.substring(0, 100)}...`
        ).join('\n');

        return `Analyze market data for ${symbol}:
        
Current Price: $${data.price}
Change: ${data.change} (${data.changePercent}%)
Volume: ${data.volume}
Recent News Context:\n${newsSummary}

Provide analysis of:
1. Current market sentiment
2. Recent performance trends
3. News impact assessment
4. Risk indicators
5. Recommended monitoring thresholds

Format as market analysis.`;
    }

    buildNotificationPrompt(task, triggerEvent, data) {
        return `Generate a notification for this event:

Task: ${task.name}
Trigger: ${triggerEvent}
Data: ${JSON.stringify(data, null, 2)}

Create a concise, actionable notification that:
1. Explains what happened
2. Provides relevant context
3. Suggests next steps if appropriate

Keep it under 100 words, professional tone.`;
    }

    buildDecisionPrompt(task, currentState, historicalData) {
        return `Analyze current state and decide next action:

Task Context: ${JSON.stringify(task, null, 2)}
Current State: ${JSON.stringify(currentState, null, 2)}
Historical Data: ${JSON.stringify(historicalData, null, 2)}

Determine:
1. Should monitoring continue?
2. Any adjustments to conditions or thresholds?
3. Any additional data source needed?
4. Error state handling if applicable

Return structured decision.`;
    }

    // Instruction prompts for different LLM tasks
    getTaskUnderstandingPrompt() {
        return `You are an AI assistant specialized in financial monitoring and task automation.
        
Analyze user input to extract key parameters for automated monitoring systems.
Focus on clarity, accuracy, and practical implementation.
Be specific about thresholds, conditions, and notification requirements.

Always return structured, JSON-parseable responses when possible.`;
    }

    getConditionAnalysisPrompt() {
        return `You are a financial monitoring analyst. Analyze condition check results with precision.
        
Consider:
- Market volatility and normal fluctuations
- Risk thresholds and alert appropriateness  
- False positives vs false negatives
- Data quality and reliability

Provide actionable insights for automated trading/financial alerts.`;
    }

    getDataInterpretationPrompt() {
        return `You are a financial data analyst specializing in real-time market interpretation.
        
Focus on:
- Price action significance
- Volume analysis
- News sentiment correlation
- Market trend identification
- Risk assessment

Provide clear, actionable market insights.`;
    }

    getDecisionMakingPrompt() {
        return `You are an automated trading system AI making control decisions.
        
Consider:
- System reliability and uptime
- Risk management
- Resource optimization
- Error handling
- Continuous improvement

Make practical, conservative decisions with safety as priority.`;
    }

    getNotificationContentPrompt() {
        return `You are a financial notification specialist writing user alerts.
        
Guidelines:
- Clear and concise communication
- Avoid technical jargon when possible
- Provide actionable information
- Maintain professional tone
- Include relevant context

Create notifications that users can easily understand and act upon.`;
    }

    // Fallback processing methods
    fallbackTaskUnderstanding(prompt) {
        // Simple regex-based extraction as fallback
        const stockSymbolRegex = /\b[A-Z]{2,5}\b/g;
        const priceRegex = /\$?(\d+(?:\.\d{2})?)/g;
        const thresholdRegex = /(over|above|below|under|>|<)\s*\$?(\d+(?:\.\d{2})?)/gi;

        const symbols = (prompt.match(stockSymbolRegex) || []).slice(0, 3);
        const prices = [...prompt.matchAll(priceRegex)].map(match => parseFloat(match[1])).slice(0, 3);
        const thresholds = [...prompt.matchAll(thresholdRegex)].map(match => ({
            operator: match[1],
            value: parseFloat(match[2])
        }));

        return {
            taskType: symbols.length > 0 ? 'stock_monitor' : 'general_alert',
            symbols: symbols,
            thresholds: thresholds,
            extracted: true,
            fallback: true
        };
    }

    fallbackConditionAnalysis(prompt) {
        return {
            conditionsMet: true,
            actionRequired: true,
            confidence: 0.8,
            recommendations: ['Monitor trends closely', 'Set up additional alerts'],
            fallback: true
        };
    }

    fallbackDataInterpretation(prompt) {
        return {
            sentiment: 'neutral',
            trend: 'stable',
            riskLevel: 'medium',
            recommendations: ['Continue monitoring'],
            fallback: true
        };
    }

    fallbackDecisionMaking(prompt) {
        return {
            action: 'continue_monitoring',
            confidence: 0.7,
            reasoning: 'Fallback decision made',
            fallback: true
        };
    }

    getDefaultMarketAnalysis(data) {
        const change = data.change || 0;
        const changePercent = data.changePercent || 0;
        
        let sentiment = 'neutral';
        if (change > 0) sentiment = 'bullish';
        else if (change < -0.02) sentiment = 'bearish';

        return {
            sentiment,
            trend: changePercent > 2 ? 'strong_upward' : changePercent < -2 ? 'strong_downward' : 'stable',
            recommendation: 'Monitor closely',
            confidence: 0.6
        };
    }

    calculateConfidenceScore(data) {
        if (!data) return 0.1;
        
        let score = 0.5; // Base score
        
        if (data.price > 0) score += 0.2;
        if (data.volume > 1000) score += 0.1;
        if (data.source) score += 0.1;
        if (data.timestamp && (Date.now() - new Date(data.timestamp).getTime()) < 300000) score += 0.1;
        
        return Math.min(score, 1);
    }

    storeInCache(key, value) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            ...value,
            cacheTimestamp: Date.now()
        });
    }

    // Update configuration
    async updateConfig(apiKey, baseUrl = null, model = null) {
        this.apiKey = apiKey;
        if (baseUrl) this.baseUrl = baseUrl;
        if (model) this.model = model;
        
        // Save to storage
        await chrome.storage.local.set({
            'agentic_settings': {
                apiKey: this.apiKey,
                llmBaseUrl: this.baseUrl,
                llmModel: this.model
            }
        });
    }

    // Quick health check
    async healthCheck() {
        if (!this.apiKey) {
            return { status: 'no_key', message: 'No API key configured' };
        }

        try {
            const testPrompt = 'Test connection';
            const result = await this.makeLLMCall(testPrompt, 'task_understanding');
            return { status: 'healthy', responseTime: Date.now() };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
}

// Export for use in background script
if (typeof global !== 'undefined') {
    global.LLMProcessor = LLMProcessor;
} else if (typeof window !== 'undefined') {
    // Browser environment
    window.LLMProcessor = LLMProcessor;
} else {
    // Service worker environment - make it available globally
    self.LLMProcessor = LLMProcessor;
}

