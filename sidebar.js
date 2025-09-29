class SidebarController {
    constructor() {
        this.settings = {};
        this.init();
    }

    async init() {
        this.bindEvents();
        this.setupTabs();
        await this.loadSettings();
        this.setupMessageListeners();
        try { await this.renderLogs(); } catch {}
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                document.getElementById(targetTab)?.classList.add('active');
                if (targetTab === 'logs') this.renderLogs().catch(()=>{});
            });
        });
    }

    bindEvents() {
        const dlAll = document.getElementById('btnLogsDownloadAll');
        const clearLogs = document.getElementById('btnLogsClear');
        dlAll?.addEventListener('click', async () => this.downloadAllLogs());
        clearLogs?.addEventListener('click', async () => this.clearAllLogs());
        document.querySelectorAll('.example-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-example') || '';
                const box = document.getElementById('taskInput');
                if (box) box.value = text;
            });
        });

        // Q&A example button: pick a random advanced question
        const qaBtn = document.getElementById('btnExampleQA');
        qaBtn?.addEventListener('click', () => {
            const questions = [
                'Integrate ∫ (3x^2 - 4x + 5) dx',
                'Integrate the definite integral ∫_0^1 (2x + 1) dx',
                'Differentiate d/dx (5x^3 - 2x^2 + 7x - 4)',
                'Solve for x: 3x/5 + 4 = 19',
                'A price increases by 12% and then decreases by 10%. What is the net change in percent?',
                'Convert 72 km/h to m/s',
                'Simple interest: Principal 10,000 at 8% per annum for 2 years',
                'Compound interest: 5,000 at 6% compounded annually for 3 years',
                'A mixes at 2:3 ratio with B; total 25 liters. How many liters of A?',
                'Average speed: 60 km at 40 km/h and 60 km at 60 km/h. What is the average speed?'
            ];
            const pick = questions[Math.floor(Math.random() * questions.length)];
            const box = document.getElementById('taskInput');
            if (box) box.value = `QA: ${pick}`;
        });
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((_request, _sender, _sendResponse) => {
            // No monitoring messages handled
        });
    }

    async loadSettings() {
        try {
            const response = await chrome.storage.local.get(['agentic_settings']);
            this.settings = response.agentic_settings || {};
            this.populateSettingsForm();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    populateSettingsForm() {}

    showNotification(message, type = 'info') {
        const container = document.getElementById('logsList');
        if (container) {
            const div = document.createElement('div');
            div.className = 'log-item';
            div.textContent = `${new Date().toLocaleTimeString()} • ${type.toUpperCase()} • ${message}`;
            container.prepend(div);
        }
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Logs tab helpers
    async loadLogs() {
        const { agentic_logs } = await chrome.storage.local.get(['agentic_logs']);
        return Array.isArray(agentic_logs) ? agentic_logs : [];
    }

    async renderLogs() {
        const container = document.getElementById('logsList');
        if (!container) return;
        const logs = await this.loadLogs();
        if (!logs.length) { container.classList.add('empty-state'); container.textContent = 'No logs yet.'; return; }
        container.classList.remove('empty-state');
        container.innerHTML = '';
        for (const item of logs.slice(0, 25)) {
            const div = document.createElement('div');
            div.className = 'log-item';
            const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
            div.innerHTML = `
                <div class="log-header">${item.query || '(no query)'} ${item.symbol ? '• ' + item.symbol : ''}</div>
                <div class="log-meta">${created} • ${Array.isArray(item.logs) ? item.logs.length : 0} steps</div>
                <details><summary>View JSON</summary><pre style="white-space:pre-wrap;">${JSON.stringify(item, null, 2)}</pre></details>
            `;
            container.appendChild(div);
        }
    }

    async downloadAllLogs() {
        const logs = await this.loadLogs();
        const dataStr = logs && logs.length ? JSON.stringify(logs, null, 2) : 'No logs';
        const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        if (chrome?.downloads?.download) {
            chrome.downloads.download({ url: dataUrl, filename: 'agentic_logs.json', saveAs: true });
        } else {
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'agentic_logs.json';
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        }
    }

    async clearAllLogs() {
        await chrome.storage.local.set({ agentic_logs: [] });
        this.renderLogs();
        this.showNotification('Logs cleared', 'info');
    }
}

// Initialize the sidebar when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.sidebarController = new SidebarController();
});

// Research flow UI
(function setupResearchUI(){
    const btn = document.getElementById('btnRunResearch');
    const modalEl = document.getElementById('researchModal');
    const closeBtn = document.getElementById('rsClose');
    const titleEl = document.getElementById('rsTitle');
    const summaryEl = document.getElementById('rsSummary');
    const articlesEl = document.getElementById('rsArticles');
        const copyBtn = document.getElementById('btnCopyLogs');
    const dlBtn = document.getElementById('btnDownloadLogs');
        const sendBtn = document.getElementById('btnSendResearchNotif');
        // Calculator and OTT quick actions removed per request
    if (!btn || !modalEl || !closeBtn) return;

    const open = () => modalEl.classList.remove('hidden');
    const close = () => modalEl.classList.add('hidden');
    closeBtn.addEventListener('click', close);

    const renderArticles = (articles=[], suppressEmpty=false) => {
        articlesEl.innerHTML = '';
        if (!articles.length) {
            if (!suppressEmpty) articlesEl.innerHTML = '<small>No recent articles found.</small>';
            return;
        }
        for (const a of articles) {
            const div = document.createElement('div');
            div.className = 'article-item';
            const when = a.publishedAt ? new Date(a.publishedAt).toLocaleString() : '';
            div.innerHTML = `
                <div class="article-title">${a.title || '(No title)'} </div>
                <div class="article-meta">${a.source || ''} • ${when}</div>
                <div class="article-desc">${a.description || ''}</div>
                ${a.url ? `<div><a href="${a.url}" target="_blank" rel="noopener">Open</a></div>` : ''}
            `;
            articlesEl.appendChild(div);
        }
    };

    let latestLogs = null;

    btn.addEventListener('click', async () => {
        const text = document.getElementById('taskInput')?.value?.trim() || '';
        if (!text) { alert('Enter a brief query, e.g., "Research NIFTY 50 latest news" or a question like "Integrate ∫ (3x^2 - 4x + 5) dx"'); return; }
        open();
        // Detect if this is a Q&A question (math/integration/etc.)
        const isQA = /^qa:/i.test(text) || /(integrate|differentiate|derivative|solve\s+for|percent|interest|km\/h|m\/s|average\s+speed|compound|simple\s+interest|ratio)/i.test(text);
        if (isQA) {
            if (titleEl) titleEl.textContent = 'Q&A Result';
            summaryEl.textContent = 'Solving your question step by step…';
            renderArticles([], true);
            try {
                const question = text.replace(/^qa:\s*/i, '');
                const resp = await chrome.runtime.sendMessage({ type: 'RUN_QA', payload: { question } });
                if (!resp?.ok) { summaryEl.textContent = 'Q&A failed: ' + (resp?.error || 'Unknown error'); return; }
                const { answer, logs } = resp.data || {};
                summaryEl.textContent = answer || 'No answer available';
                latestLogs = logs || null;
                try { window.__agenticLatestLogs = latestLogs || resp.data || null; } catch {}
            } catch (e) {
                summaryEl.textContent = 'Q&A error: ' + e.message;
            }
            return;
        }

        // Default: Research flow
        if (titleEl) titleEl.textContent = 'Research Result';
        summaryEl.textContent = 'Running multi-step research…';
        renderArticles([]);
        try {
            const resp = await chrome.runtime.sendMessage({ type: 'RUN_RESEARCH', payload: { query: text } });
            if (!resp?.ok) { summaryEl.textContent = 'Research failed: ' + (resp?.error || 'Unknown error'); return; }
            const { summary, articles, logs } = resp.data || {};
            summaryEl.textContent = summary || 'No summary available';
            renderArticles(articles || []);
            latestLogs = logs || null;
            try { window.__agenticLatestLogs = latestLogs || resp.data || null; } catch {}
        } catch (e) {
            summaryEl.textContent = 'Research error: ' + e.message;
        }
    });

    copyBtn?.addEventListener('click', async () => {
        try {
            let logsData = latestLogs || (window.__agenticLatestLogs || null);
            if (!logsData) {
                const { agentic_logs } = await chrome.storage.local.get(['agentic_logs']);
                const latestEntry = Array.isArray(agentic_logs) && agentic_logs.length ? agentic_logs[0] : null;
                logsData = latestEntry?.logs || latestEntry || [];
            }
            const j = logsData ? JSON.stringify(logsData, null, 2) : 'No logs';
            await navigator.clipboard.writeText(j);
            summaryEl.textContent = 'Logs copied to clipboard.';
        } catch (e) {
            summaryEl.textContent = 'Copy failed: ' + e.message;
        }
    });

    dlBtn?.addEventListener('click', async () => {
        try {
            let logsData = latestLogs || (window.__agenticLatestLogs || null);
            if (!logsData) {
                const { agentic_logs } = await chrome.storage.local.get(['agentic_logs']);
                const latestEntry = Array.isArray(agentic_logs) && agentic_logs.length ? agentic_logs[0] : null;
                logsData = latestEntry?.logs || latestEntry || [];
            }
            const dataStr = logsData ? JSON.stringify(logsData, null, 2) : 'No logs';
            const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            if (chrome?.downloads?.download) {
                chrome.downloads.download({ url: dataUrl, filename: 'agentic_research_logs.json', saveAs: true });
            } else {
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'agentic_research_logs.json';
                document.body.appendChild(a); a.click(); a.remove();
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            summaryEl.textContent = 'Download failed: ' + e.message;
        }
    });

        // Send research to notifications (browser only)
        sendBtn?.addEventListener('click', async () => {
            try {
                const message = summaryEl?.textContent || 'Research summary';
                await chrome.runtime.sendMessage({ type: 'SEND_RESEARCH_NOTIFICATION', payload: { title: 'Research Summary', message } });
                summaryEl.textContent = 'Sent to notifications.';
            } catch(e) {
                summaryEl.textContent = 'Failed to send notification: ' + e.message;
            }
        });

            // Calculator quick action removed
})();

// Q&A UI removed

// Agentic Batch button handler
(function setupBatch(){
    const btn = document.getElementById('btnRunBatch');
    const modalEl = document.getElementById('researchModal');
    const closeBtn = document.getElementById('rsClose');
    const summaryEl = document.getElementById('rsSummary');
    const articlesEl = document.getElementById('rsArticles');
    if (!btn || !modalEl || !summaryEl || !articlesEl || !closeBtn) return;
    const open = () => modalEl.classList.remove('hidden');
    const close = () => modalEl.classList.add('hidden');
    closeBtn.addEventListener('click', close);
    btn.addEventListener('click', async () => {
        open();
        summaryEl.textContent = 'Running agentic batch…';
        articlesEl.innerHTML = '';
        try {
            const text = document.getElementById('taskInput')?.value?.trim() || '';
            const resp = await chrome.runtime.sendMessage({ type: 'RUN_AGENTIC_BATCH', payload: { calcK: 6, ottSend: true, researchQuery: text || 'Ola stock news last month' } });
            if (!resp?.ok) { summaryEl.textContent = 'Batch failed: ' + (resp?.error || 'Unknown error'); return; }
            const { final, calcResult, ottResult, researchResult } = resp.data || {};
            summaryEl.textContent = final || 'Completed.';
            try { window.__agenticLatestLogs = resp.data || null; } catch {}
            // Render research articles if any
            if (Array.isArray(researchResult?.articles)) {
                for (const a of researchResult.articles) {
                    const div = document.createElement('div');
                    div.className = 'article-item';
                    div.innerHTML = `<div class="article-title">${a.title || ''}</div>`;
                    articlesEl.appendChild(div);
                }
            }
        } catch (e) {
            summaryEl.textContent = 'Batch error: ' + e.message;
        }
    });
})();

