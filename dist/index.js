import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
// Activity Log Buffer
const activityLog = [];
const logActivity = (type, message, data) => {
    const logItem = { timestamp: new Date(), type, message, data };
    activityLog.push(logItem);
    if (activityLog.length > 100)
        activityLog.shift();
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
const devices = new Map(); // deviceId -> socketId
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
app.post('/api/generate', async (req, res) => {
    const { prompt, deviceId, systemPrompt } = req.body;
    // Default system prompt if none provided
    const defaultSystem = "Respond ONLY with pure text even if it is code. Wrap your entire response in <RG> and </RG> tags. Example: prompt:'name the capital of France' Response:  <RG>Paris</RG>";
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
    io.to(targetSocketId).timeout(60000).emit('new_prompt', { prompt, systemPrompt: finalSystem }, (err, response) => {
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
//# sourceMappingURL=index.js.map