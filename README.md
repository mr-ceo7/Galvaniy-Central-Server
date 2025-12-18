# Galvaniy Central Server

The central relay server for the Gemini Mobile Gateway ecosystem. This server allows external clients to interact with the Gemini automation running on an Android device without needing direct port forwarding or a public IP for the mobile device.

## 🚀 Features

- **Device Registration**: Handles multiple Android devices connecting via WebSockets.
- **WebSocket Relay**: Real-time communication between the server and the Android app.
- **HTTP API**: A simple POST endpoint for clients to send prompts.
- **Persistent Connectivity**: Optimized for long-running connections from foreground services.

## 🛠 Tech Stack

- **Node.js** with **TypeScript**
- **Express**: HTTP API server.
- **Socket.io**: WebSocket relay engine.
- **tsx**: Modern development runner.

## 📋 Prerequisites

- Node.js (v18+)
- npm

## ⚙️ Setup & Installation

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root:
    ```env
    PORT=8081
    NODE_ENV=development
    ```

3.  **Run Development Mode**:
    ```bash
    npm run dev
    ```

4.  **Build for Production**:
    ```bash
    npm run build
    npm start
    ```

## 🐳 Docker Deployment

The project includes a `Dockerfile` for easy deployment to platforms like Render, Railway, or Fly.io.

```bash
docker build -t galvaniy-central-server .
docker run -p 8081:8081 galvaniy-central-server
```

## 📡 API Usage

### Send a Prompt
**Endpoint**: `POST /prompt`

**Body**:
```json
{
  "prompt": "What is the capital of Kenya?",
  "deviceId": "optional_device_id"
}
```

**Response**:
```json
{
  "status": "success",
  "response": "The capital of Kenya is Nairobi..."
}
```

## 📄 License
ISC
