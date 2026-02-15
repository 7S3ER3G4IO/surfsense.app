// App.js - Core Engine / Orchestrator

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import Logger from './Logger.js';

// Import Modules
import AIEngine from '../modules/ai/AIEngine.js';
import AutomationEngine from '../modules/automation/AutomationEngine.js';
import AnalyticsEngine from '../modules/analytics/AnalyticsEngine.js';
import TrendRadar from '../modules/trends/TrendRadar.js';
import AccountManager from '../modules/accounts/AccountManager.js';
import SecuritySystem from '../modules/security/SecuritySystem.js';

class CoreEngine extends EventEmitter {
    constructor() {
        super();
        this.logger = new Logger('CoreEngine');
        this.config = {};
        
        // Initialize Modules
        this.ai = new AIEngine(this);
        this.automation = new AutomationEngine(this);
        this.analytics = new AnalyticsEngine(this);
        this.trends = new TrendRadar(this);
        this.accounts = new AccountManager(this);
        this.security = new SecuritySystem(this);
    }

    async init() {
        this.logger.info("Initializing Nami Core Engine...");
        
        try {
            await this.loadConfig();
            await this.security.init();
            await this.accounts.init();
            await this.automation.init();
            await this.ai.init();
            await this.trends.init();
            await this.analytics.init();
            
            this.logger.info("Nami Core Engine initialized successfully.");
            this.emit('ready');
        } catch (error) {
            this.logger.error("Failed to initialize Core Engine", { error });
            throw error;
        }
    }

    async loadConfig() {
        try {
            const configPath = path.resolve(process.cwd(), 'nami_config.json');
            this.logger.info(`Loading config from ${configPath}`);
            const data = await fs.readFile(configPath, 'utf8');
            this.config = JSON.parse(data);
            this.logger.info("Configuration loaded successfully", { keys: Object.keys(this.config) });
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.warn("No config file found, using defaults.");
                this.config = {};
            } else {
                this.logger.error("Failed to load config", error);
            }
        }
    }

    // Centralized Event Bus
    dispatch(event, payload) {
        this.logger.debug(`Dispatching event: ${event}`, payload);
        this.emit(event, payload);
    }
}

export default new CoreEngine();
