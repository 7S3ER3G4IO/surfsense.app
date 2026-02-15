// AIEngine.js - Moteur IA pour génération, adaptation et optimisation

import Logger from '../../core/Logger.js';
import { Prompts } from './Prompts.js';
import fetch from 'node-fetch'; // Ensure node-fetch is available

class AIEngine {
    constructor(core) {
        this.core = core;
        this.logger = new Logger('AIEngine');
    }

    async init() {
        this.logger.info("Initializing AI Engine...");
        // Check for API Key
        if (this.core.config && this.core.config.openai_key) {
            this.logger.info("AI Engine ready (Provider: OpenAI).");
        } else {
            this.logger.warn("AI Engine ready (Provider: Mock - No API Key found).");
        }
    }

    // --- Core Functions ---

    async generateHooks(topic) {
        const prompt = Prompts.hook_viral(topic);
        return this._callAI(prompt);
    }

    async generateScript(topic, hook) {
        const prompt = Prompts.script_short(topic, hook);
        return this._callAI(prompt);
    }

    async optimizeDescription(topic, network) {
        const prompt = Prompts.seo_description(topic, network);
        return this._callAI(prompt);
    }

    async adaptContent(content, fromNetwork, toNetwork) {
        const prompt = Prompts.cross_post_adapt(content, fromNetwork, toNetwork);
        return this._callAI(prompt);
    }

    async analyzePerformance(metrics) {
        // Mock analysis
        return {
            verdict: "Strong engagement but low retention.",
            tip: "Try a more visual hook in the first 3 seconds.",
            score: 75
        };
    }

    // --- Internal ---

    async _callAI(prompt) {
        this.logger.info("Calling AI Engine with prompt...", { promptLength: prompt.length });
        
        // Use OpenAI if Key is available
        if (this.core.config && this.core.config.openai_key) {
            try {
                this.logger.info("Sending request to OpenAI...");
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.core.config.openai_key}`
                    },
                    body: JSON.stringify({
                        model: "gpt-3.5-turbo",
                        messages: [{ role: "user", content: prompt }],
                        max_tokens: 500
                    })
                });

                const data = await response.json();
                
                if (data.error) {
                    this.logger.error("OpenAI API Error:", data.error);
                    throw new Error(data.error.message);
                }

                if (data.choices && data.choices.length > 0) {
                    return {
                        text: data.choices[0].message.content,
                        tokens: data.usage.total_tokens,
                        provider: 'openai'
                    };
                }
            } catch (error) {
                this.logger.error("Failed to call OpenAI API", error);
                // Fallback to mock on error? Or just throw? Let's fallback for robustness but log error.
            }
        }

        // Mock Response (Fallback)
        this.logger.warn("Using Mock AI Response (No API Key or API Error)");
        return new Promise(resolve => setTimeout(() => {
            resolve({
                text: `[MOCK AI] (Set 'openai_key' in config to use real AI)\n\nResponse to: "${prompt.substring(0, 50)}..."`,
                tokens: 0,
                provider: 'mock'
            });
        }, 1000));
    }
}

export default AIEngine;
