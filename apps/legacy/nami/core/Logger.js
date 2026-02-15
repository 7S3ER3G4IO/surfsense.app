// Logger.js - Structured logging system

import { EventEmitter } from 'events';

// Global Event Emitter for Logs (Singleton pattern for the emitter)
const logEmitter = new EventEmitter();

class Logger {
    constructor(context) {
        this.context = context;
    }

    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            context: this.context,
            message,
            data
        };
        
        // Console output
        console.log(`[${level.toUpperCase()}] [${this.context}] ${message}`);
        
        // Emit global event for UI
        logEmitter.emit('log', logEntry);
    }

    info(message, data) { this.log('info', message, data); }
    warn(message, data) { this.log('warn', message, data); }
    error(message, data) { this.log('error', message, data); }
    debug(message, data) { this.log('debug', message, data); }
    
    static onLog(callback) {
        logEmitter.on('log', callback);
    }
}

export default Logger;
