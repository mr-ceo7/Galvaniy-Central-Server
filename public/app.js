const socket = io();

// UI Elements
const deviceCountEl = document.getElementById('device-count');
const uptimeEl = document.getElementById('uptime');
const deviceGridEl = document.getElementById('device-grid');
const logContainerEl = document.getElementById('log-container');
const chatOutputEl = document.getElementById('chat-output');
const chatForm = document.getElementById('chat-form');
const promptInput = document.getElementById('prompt-input');
const deviceSelector = document.getElementById('device-selector');

// Initial Data Fetch
async function init() {
    try {
        const statusRes = await fetch('/status');
        const status = await statusRes.json();
        updateStats(status);
        updateDeviceList(status.devices);

        const activityRes = await fetch('/api/activity');
        const activity = await activityRes.json();
        activity.forEach(addLogItem);
    } catch (e) {
        console.error("Failed to load initial data", e);
    }
}

function updateStats(status) {
    deviceCountEl.textContent = status.online_devices;
    uptimeEl.textContent = Math.floor(status.uptime) + 's';
}

function updateDeviceList(devices) {
    deviceGridEl.innerHTML = '';
    deviceSelector.innerHTML = '<option value="">Auto Select</option>';

    if (devices.length === 0) {
        deviceGridEl.innerHTML = '<div class="no-devices">No devices connected</div>';
        return;
    }

    devices.forEach(id => {
        // Grid Update
        const div = document.createElement('div');
        div.className = 'device-item';
        div.innerHTML = `
            <div class="icon">📱</div>
            <div class="name">Android Gateway</div>
            <div class="id">${id}</div>
        `;
        deviceGridEl.appendChild(div);

        // Selector Update
        const option = document.createElement('option');
        option.value = id;
        option.textContent = id.substring(0, 8) + '...';
        deviceSelector.appendChild(option);
    });
}

function addLogItem(item) {
    const div = document.createElement('div');
    div.className = `log-item ${item.type}`;
    const time = new Date(item.timestamp).toLocaleTimeString();
    div.innerHTML = `
        <div class="log-meta">
            <span>${item.type}</span>
            <span>${time}</span>
        </div>
        <div class="log-msg">${item.message}</div>
    `;
    logContainerEl.prepend(div);
}

function appendChatMessage(type, text) {
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    div.textContent = `${type === 'user' ? 'Client' : type === 'device' ? 'Gemini' : 'System'}: ${text}`;
    chatOutputEl.appendChild(div);
    chatOutputEl.scrollTop = chatOutputEl.scrollHeight;
}

// Socket Events
socket.on('activity_log', addLogItem);

socket.on('devices_updated', (devices) => {
    updateDeviceList(devices);
    deviceCountEl.textContent = devices.length;
});

// Chat Form
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = promptInput.value.trim();
    const deviceId = deviceSelector.value;

    if (!prompt) return;

    appendChatMessage('user', prompt);
    promptInput.value = '';
    promptInput.disabled = true;

    try {
        const res = await fetch('/prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, deviceId })
        });
        const data = await res.json();

        if (data.status === 'success') {
            appendChatMessage('device', data.response);
        } else {
            appendChatMessage('system', `Error: ${data.message}`);
        }
    } catch (e) {
        appendChatMessage('system', "Connection error");
    } finally {
        promptInput.disabled = false;
        promptInput.focus();
    }
});

// Uptime Counter
setInterval(() => {
    const current = parseInt(uptimeEl.textContent);
    uptimeEl.textContent = (current + 1) + 's';
}, 1000);

init();
