import { WebSocketServer, WebSocket } from 'ws';
import EventEmitter from 'events';

class WSServer extends EventEmitter {
    constructor(port = 4546) {
        super();
        this.port = port;
        this.wss = null;
        this.activeClient = null;
        this.pingInterval = null;
        this.messageQueue = []; // Queue for messages when offline
    }

    start() {
        try {
            this.wss = new WebSocketServer({ port: this.port, host: '127.0.0.1' });
        } catch (err) {
            if (err && err.code === 'EADDRINUSE') {
                console.log(`[WSServer] Port ${this.port} already in use. Reusing existing server, skipping start.`);
                this.emit('server:already-running');
                return;
            }
            console.error('[WSServer] Failed to start:', err);
            return;
        }
        
        console.log(`[WSServer] Starting on port ${this.port}...`);

        this.wss.on('connection', (ws) => {
            console.log('[WSServer] Client connected');
            
            // If we already have a client, we might want to replace it or allow multiple
            // For now, simple 1-1 mapping
            this.activeClient = ws;
            this.emit('client:connected');

            // Send Hello
            this.send({ type: 'AUTH:WELCOME', payload: { serverTime: Date.now() } });

            // Flush queue
            this.flushQueue();

            ws.on('message', (message) => {
                try {
                    const parsed = JSON.parse(message);
                    this.handleMessage(parsed);
                } catch (e) {
                    console.error('[WSServer] Invalid JSON:', e);
                }
            });

            ws.on('close', () => {
                console.log('[WSServer] Client disconnected');
                if (this.activeClient === ws) {
                    this.activeClient = null;
                    this.emit('client:disconnected');
                }
            });

            ws.on('error', (err) => {
                console.error('[WSServer] Client error:', err);
            });
            
            // Setup Ping
            this.startPing(ws);
        });
        
        this.wss.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE') {
                console.log(`[WSServer] Port ${this.port} in use. Ignoring duplicate start.`);
                this.emit('server:already-running');
                return;
            }
            console.error('[WSServer] Server error:', err);
        });
    }

    handleMessage(msg) {
        // Heartbeat response
        if (msg.type === 'SYS:PONG') {
            // Update last seen
            return;
        }

        // Standard events
        this.emit('message', msg);

        // Specific routing
        if (msg.type === 'LOG:ENTRY') {
            this.emit('log', msg.payload);
        }
        
        if (msg.type === 'TASK:RESULT') {
            this.emit('task:result', msg.payload);
        }
    }

    send(msg) {
        const payload = JSON.stringify(msg);
        if (this.activeClient && this.activeClient.readyState === WebSocket.OPEN) {
            this.activeClient.send(payload);
            return true;
        } else {
            // Queue if critical
            if (msg.type.startsWith('TASK:')) {
                console.log('[WSServer] Client offline, queueing message:', msg.type);
                this.messageQueue.push(payload);
            }
            return false;
        }
    }

    flushQueue() {
        while (this.messageQueue.length > 0 && this.activeClient) {
            const payload = this.messageQueue.shift();
            this.activeClient.send(payload);
        }
    }

    startPing(ws) {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'SYS:PING', payload: { ts: Date.now() } }));
            } else {
                clearInterval(this.pingInterval);
            }
        }, 30000); // 30s heartbeat
    }
}

export default WSServer;
