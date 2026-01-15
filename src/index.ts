import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS middleware
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://exam-timetables-uonbi.vercel.app',
        'http://localhost:3000'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin as string)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Activity Log Buffer
const activityLog: any[] = [];
const logActivity = (type: string, message: string, data?: any) => {
    const logItem = { timestamp: new Date(), type, message, data };
    activityLog.push(logItem);
    if (activityLog.length > 100) activityLog.shift();
    io.emit('activity_log', logItem);
    console.log(`[${type}] ${message}`);
};

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 8081;

// Store connected devices
const devices = new Map<string, string>(); // deviceId -> socketId

app.get('/status', (req, res) => {
    res.json({
        online_devices: devices.size,
        devices: Array.from(devices.keys()),
        uptime: process.uptime()
    });
});

app.get('/api/activity', (req, res) => {
    res.json(activityLog);
});

app.post('/api/upload', (req, res) => {
    res.json({ status: "ok" });
});

app.post('/api/generate', async (req, res) => {
    const { prompt, deviceId, systemPrompt } = req.body;

    // Default system prompt if none provided
    const defaultSystem = "Respond ONLY with pure text even if it is code.";
    const finalSystem = systemPrompt || defaultSystem;

    if (!prompt) {
        return res.status(400).json({ status: "error", message: "Prompt is required" });
    }

    // If deviceId is provided, target it; otherwise, use the first available device
    let targetSocketId = deviceId ? devices.get(deviceId) : Array.from(devices.values())[0];

    if (!targetSocketId) {
        return res.status(503).json({ status: "error", message: "No devices connected" });
    }

    logActivity('PROMPT', `Relaying prompt to device: ${prompt}`, { deviceId, hasSystem: !!systemPrompt });

    // Emit prompt to device and wait for response
    io.to(targetSocketId).timeout(60000).emit('new_prompt', { prompt, systemPrompt: finalSystem }, (err: any, response: any) => {
        if (err) {
            logActivity('ERROR', "Relay timeout or error", { err });
            return res.status(504).json({ status: "error", message: "Device timed out" });
        }
        const result = response[0];
        logActivity('RESPONSE', 'Received response from device', { status: result.status });
        res.json(result); // Socket.io ack responses come as an array
    });
});

io.on('connection', (socket) => {
    logActivity('SYSTEM', `New connection: ${socket.id}`);

    socket.on('register', (data) => {
        const { deviceId } = data;
        if (deviceId) {
            devices.set(deviceId, socket.id);
            logActivity('DEVICE', `Device registered: ${deviceId}`, { socketId: socket.id });
            socket.emit('registered', { status: 'success' });
            io.emit('devices_updated', Array.from(devices.keys()));
        }
    });

    socket.on('disconnect', () => {
        // Find and remove the device
        for (const [deviceId, socketId] of devices.entries()) {
            if (socketId === socket.id) {
                devices.delete(deviceId);
                logActivity('DEVICE', `Device disconnected: ${deviceId}`);
                io.emit('devices_updated', Array.from(devices.keys()));
                break;
            }
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Galvaniy Central Server running on port ${PORT}`);
});
