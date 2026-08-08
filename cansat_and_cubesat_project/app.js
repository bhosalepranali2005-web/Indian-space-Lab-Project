// GCS Mission Operations & Telemetry Script
let telemetryTimer = null;
let isTelemetryRunning = false;
let packetCount = 0;
let flightData = [];

// Base GPS Anchors
let currentLat = 16.6913;
let currentLng = 74.5822;

// DOM Elements
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnSync = document.getElementById('btn-sync');
const btnReset = document.getElementById('btn-reset');
const btnExportCSV = document.getElementById('btn-export-csv');
const btnExportGraph = document.getElementById('btn-export-graph');

// Telemetry Displays
const valPacket = document.getElementById('val-packet');
const valTime = document.getElementById('val-time');
const valCAlt = document.getElementById('val-c-alt');
const valPAlt = document.getElementById('val-p-alt');
const valDescent = document.getElementById('val-descent');
const valTemp = document.getElementById('val-temp');
const valPress = document.getElementById('val-press');
const valBatt = document.getElementById('val-batt');
const valSats = document.getElementById('val-sats');
const valState = document.getElementById('val-state');

// Error Code System Elements
const errD1 = document.getElementById('err-d1');
const errD2 = document.getElementById('err-d2');
const errD3 = document.getElementById('err-d3');
const errD4 = document.getElementById('err-d4');

// Setup Leaflet Map
const map = L.map('map').setView([currentLat, currentLng], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

const marker = L.marker([currentLat, currentLng]).addTo(map);
const pathPolyline = L.polyline([], { color: '#00d2ff' }).addTo(map);

// Setup Chart.js Instances
function createChart(ctxId, label, color) {
    const ctx = document.getElementById(ctxId).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: color + '22',
                borderWidth: 2,
                fill: true,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: { ticks: { color: '#94a3b8', font: { size: 9 } } }
            },
            plugins: {
                legend: { labels: { color: '#e2e8f0', font: { size: 11 } } }
            }
        }
    });
}

const chartAlt = createChart('chart-altitude', 'Altitude (m)', '#00d2ff');
const chartPress = createChart('chart-pressure', 'Pressure (hPa)', '#ffea00');
const chartTemp = createChart('chart-temperature', 'Temperature (°C)', '#ff1744');
const chartDescent = createChart('chart-descent', 'Descent Rate (m/s)', '#00e676');
const chartVolt = createChart('chart-voltage', 'Battery (V)', '#a855f7');

// Setup Three.js Artificial Horizon / Orientation Model
const container3D = document.getElementById('orientation-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, container3D.clientWidth / container3D.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container3D.clientWidth, container3D.clientHeight);
container3D.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(2, 0.4, 1);
const materials = [
    new THREE.MeshBasicMaterial({ color: 0xff1744 }),
    new THREE.MeshBasicMaterial({ color: 0x00d2ff }),
    new THREE.MeshBasicMaterial({ color: 0x00e676 }),
    new THREE.MeshBasicMaterial({ color: 0xffea00 }),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    new THREE.MeshBasicMaterial({ color: 0x94a3b8 })
];
const payloadMesh = new THREE.Mesh(geometry, materials);
scene.add(payloadMesh);
camera.position.z = 4;

function render3D() {
    requestAnimationFrame(render3D);
    renderer.render(scene, camera);
}
render3D();

// Telemetry Streaming Engine
function generateTelemetryPacket() {
    packetCount++;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    // Simulated Sensor Readings
    const altitude = Math.max(0, 700 - packetCount * 4.5 + (Math.random() * 2 - 1));
    const descentRate = 8.5 + (Math.random() * 1.5 - 0.75);
    const temp = 28.5 - (altitude / 100) + (Math.random() * 0.4);
    const press = 1013.25 - (altitude / 8.3);
    const voltage = Math.max(3.2, 4.2 - (packetCount * 0.005));
    const roll = Math.sin(packetCount * 0.1) * 15;
    const pitch = Math.cos(packetCount * 0.1) * 10;
    const yaw = (packetCount * 2) % 360;

    // Advance GPS Coordinates
    currentLat += 0.00005 * (Math.random() - 0.2);
    currentLng += 0.00005 * (Math.random() - 0.2);

    // Update UI Readouts
    valPacket.textContent = packetCount;
    valTime.textContent = timeStr;
    valCAlt.textContent = (altitude + 2.5).toFixed(1) + ' m';
    valPAlt.textContent = altitude.toFixed(1) + ' m';
    valDescent.textContent = descentRate.toFixed(1) + ' m/s';
    valTemp.textContent = temp.toFixed(1) + ' °C';
    valPress.textContent = press.toFixed(1) + ' hPa';
    valBatt.textContent = voltage.toFixed(2) + ' V';
    valSats.textContent = '11';
    valState.textContent = altitude > 100 ? 'DESCENT' : 'LANDED';

    // Update Error System (Digit 1: Descent Rate Fault, D2: GPS, D3: Separation, D4: Chute)
    const d1Fault = (descentRate < 7.0 || descentRate > 11.0) ? 1 : 0;
    errD1.textContent = d1Fault;
    errD1.className = 'err-digit' + (d1Fault ? ' active-fault' : '');
    document.getElementById('txt-d1').textContent = d1Fault ? 'Fault' : 'Normal';

    // Update Charts
    function pushData(chart, val) {
        chart.data.labels.push(timeStr);
        chart.data.datasets[0].data.push(val);
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.update();
    }
    pushData(chartAlt, altitude);
    pushData(chartPress, press);
    pushData(chartTemp, temp);
    pushData(chartDescent, descentRate);
    pushData(chartVolt, voltage);

    // Update Map
    const newPos = [currentLat, currentLng];
    marker.setLatLng(newPos);
    map.panTo(newPos);
    pathPolyline.addLatLng(newPos);
    document.getElementById('val-lat').textContent = currentLat.toFixed(4);
    document.getElementById('val-lng').textContent = currentLng.toFixed(4);

    // Update 3D Orientation
    payloadMesh.rotation.x = pitch * (Math.PI / 180);
    payloadMesh.rotation.y = yaw * (Math.PI / 180);
    payloadMesh.rotation.z = roll * (Math.PI / 180);
    document.getElementById('val-roll').textContent = roll.toFixed(1);
    document.getElementById('val-pitch').textContent = pitch.toFixed(1);
    document.getElementById('val-yaw').textContent = yaw.toFixed(1);

    // Record Data Object
    flightData.push({ packetCount, timeStr, altitude, descentRate, temp, press, voltage, lat: currentLat, lng: currentLng });
}

// Button Handlers
btnStart.addEventListener('click', () => {
    isTelemetryRunning = true;
    btnStart.disabled = true;
    btnStop.disabled = false;
    document.getElementById('cmd-status').textContent = 'Telemetry Streaming Active...';
    telemetryTimer = setInterval(generateTelemetryPacket, 1000);
});

btnStop.addEventListener('click', () => {
    isTelemetryRunning = false;
    btnStart.disabled = false;
    btnStop.disabled = true;
    document.getElementById('cmd-status').textContent = 'Telemetry Halted.';
    clearInterval(telemetryTimer);
});

btnReset.addEventListener('click', () => {
    packetCount = 0;
    flightData = [];
    valPacket.textContent = '0';
    document.getElementById('cmd-status').textContent = 'Packet Count Reset.';
});

btnSync.addEventListener('click', () => {
    valTime.textContent = new Date().toTimeString().split(' ')[0];
    document.getElementById('cmd-status').textContent = 'PC Time Synchronized.';
});

// CSV Export
btnExportCSV.addEventListener('click', () => {
    if (flightData.length === 0) {
        alert('No telemetry data recorded to export!');
        return;
    }
    let csv = 'Packet,Time,Altitude(m),DescentRate(m/s),Temp(C),Pressure(hPa),Voltage(V),Latitude,Longitude\n';
    flightData.forEach(row => {
        csv += `${row.packetCount},${row.timeStr},${row.altitude.toFixed(2)},${row.descentRate.toFixed(2)},${row.temp.toFixed(2)},${row.press.toFixed(2)},${row.voltage.toFixed(2)},${row.lat},${row.lng}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CanSat_Telemetry_Log_${Date.now()}.csv`;
    a.click();
});

// Command Action Triggers
document.getElementById('cmd-separation').addEventListener('click', () => {
    errD3.textContent = '0';
    errD3.className = 'err-digit';
    document.getElementById('txt-d3').textContent = 'Separated';
    document.getElementById('cmd-status').textContent = 'COMMAND EXECUTED: Payload Separated!';
});

document.getElementById('cmd-parachute').addEventListener('click', () => {
    errD4.textContent = '1';
    errD4.className = 'err-digit active-fault';
    document.getElementById('txt-d4').textContent = 'Deployed';
    document.getElementById('cmd-status').textContent = 'EMERGENCY: Parachute Deployed!';
});

// Live Video Controls
const videoElem = document.getElementById('webcam-feed');
let mediaStream = null;

document.getElementById('btn-cam-start').addEventListener('click', async () => {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElem.srcObject = mediaStream;
        document.getElementById('cam-status').textContent = 'Camera Streaming Live';
    } catch (err) {
        document.getElementById('cam-status').textContent = 'Camera Error: ' + err.message;
    }
});

document.getElementById('btn-cam-stop').addEventListener('click', () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        videoElem.srcObject = null;
        document.getElementById('cam-status').textContent = 'Camera Offline';
    }
});

// Export All Graphs Handler in app.js
btnExportGraph.addEventListener('click', () => {
    const graphsGrid = document.querySelector('.graphs-grid');
    if (!graphsGrid) {
        alert('Graphs container not found!');
        return;
    }

    // Combine all 5 chart canvases onto a single temporary export canvas
    const canvases = graphsGrid.querySelectorAll('canvas');
    if (canvases.length === 0) return;

    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');

    // Set export canvas size to fit all graphs
    exportCanvas.width = 1200;
    exportCanvas.height = 900;

    // Fill dark background
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Grid positions for 5 charts
    const positions = [
        { x: 20, y: 20, w: 560, h: 260 },   // Altitude
        { x: 610, y: 20, w: 560, h: 260 },  // Pressure
        { x: 20, y: 310, w: 560, h: 260 },  // Temperature
        { x: 610, y: 310, w: 560, h: 260 }, // Descent Rate
        { x: 20, y: 600, w: 560, h: 260 }   // Battery Voltage
    ];

    canvases.forEach((c, idx) => {
        if (positions[idx]) {
            const pos = positions[idx];
            ctx.drawImage(c, pos.x, pos.y, pos.w, pos.h);
        }
    });

    // Trigger image download
    const link = document.createElement('a');
    link.download = `CanSat_All_Telemetry_Graphs_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
});