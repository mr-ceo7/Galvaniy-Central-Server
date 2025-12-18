import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(express.json());

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
        devices: Array.from(devices.keys())
    });
});

app.post('/prompt', async (req, res) => {
    const { prompt, deviceId } = req.body;

    if (!prompt) {
        return res.status(400).json({ status: "error", message: "Prompt is required" });
    }

    // If deviceId is provided, target it; otherwise, use the first available device
    let targetSocketId = deviceId ? devices.get(deviceId) : Array.from(devices.values())[0];

    if (!targetSocketId) {
        return res.status(503).json({ status: "error", message: "No devices connected" });
    }

    console.log(`Relaying prompt to device: ${prompt}`);

    // Emit prompt to device and wait for response
    io.to(targetSocketId).timeout(60000).emit('new_prompt', { prompt }, (err: any, response: any) => {
        if (err) {
            console.error("Relay timeout or error:", err);
            return res.status(504).json({ status: "error", message: "Device timed out" });
        }
        res.json(response[0]); // Socket.io ack responses come as an array
    });
});

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    socket.on('register', (data) => {
        const { deviceId } = data;
        if (deviceId) {
            devices.set(deviceId, socket.id);
            console.log(`Device registered: ${deviceId} (${socket.id})`);
            socket.emit('registered', { status: 'success' });
        }
    });

    socket.on('disconnect', () => {
        // Find and remove the device
        for (const [deviceId, socketId] of devices.entries()) {
            if (socketId === socket.id) {
                devices.delete(deviceId);
                console.log(`Device disconnected: ${deviceId}`);
                break;
            }
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Galvaniy Central Server running on port ${PORT}`);
});
