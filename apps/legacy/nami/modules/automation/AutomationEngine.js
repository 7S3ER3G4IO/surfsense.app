// AutomationEngine.js - Handles scheduling, queuing, and cross-posting

import Logger from '../../core/Logger.js';
import EventEmitter from 'events';

class AutomationEngine extends EventEmitter {
    constructor(core) {
        super();
        this.core = core;
        this.logger = new Logger('AutomationEngine');
        this.queue = [];
        this.scheduler = null;
    }

    async init() {
        this.logger.info("Initializing Automation Engine...");
        // Start scheduler loop
        this.scheduler = setInterval(() => this.processQueue(), 60000); // Check every minute
        this.logger.info("Automation Engine scheduler started (60s interval).");
    }

    async schedulePost(postData, time) {
        // Validate with SecuritySystem
        const valid = await this.core.security.validateAction('publish_post', postData.network, postData);
        if (!valid.valid) {
            this.logger.error(`Post validation failed for ${postData.network}`);
            return false;
        }

        const task = {
            id: Date.now().toString(),
            type: 'POST',
            payload: postData,
            scheduledAt: new Date(time),
            status: 'pending'
        };

        this.queue.push(task);
        this.logger.info(`Post scheduled for ${time} on ${postData.network}`, { id: task.id });
        return task.id;
    }

    async processQueue() {
        const now = new Date();
        const pending = this.queue.filter(t => t.status === 'pending' && t.scheduledAt <= now);

        if (pending.length > 0) {
            this.logger.info(`Processing ${pending.length} scheduled tasks...`);
            for (const task of pending) {
                await this.executeTask(task);
            }
        }
    }

    async executeTask(task) {
        this.logger.info(`Executing task ${task.id} (${task.type})`);
        
        try {
            // Check Rate Limit
            if (!this.core.security.checkRateLimit(task.type, task.payload.network)) {
                this.logger.warn(`Rate limit hit for ${task.payload.network}. Re-queueing task ${task.id}`);
                task.scheduledAt = new Date(Date.now() + 300000); // Retry in 5m
                return;
            }

            // Simulate API Call or Delegate to Extension Connector
            // In a real app, this would use the WSServer to send to extension or use direct API
            this.logger.info(`Task ${task.id} executed successfully (Simulated).`);
            
            task.status = 'completed';
            task.completedAt = new Date();
            this.emit('task-completed', task);

        } catch (error) {
            this.logger.error(`Task ${task.id} failed`, { error });

            // Retry Logic (Max 3 retries)
            task.retryCount = (task.retryCount || 0) + 1;
            if (task.retryCount <= 3) {
                const delay = task.retryCount * 60000 * 2; // Exponential-ish: 2m, 4m, 6m
                task.scheduledAt = new Date(Date.now() + delay);
                task.status = 'pending';
                task.error = error.message;
                this.logger.warn(`Re-queueing task ${task.id} (Retry ${task.retryCount}/3) due to error: ${error.message}`);
            } else {
                task.status = 'failed';
                task.error = error.message;
                this.emit('task-failed', task);
            }
        }
    }
}

export default AutomationEngine;
