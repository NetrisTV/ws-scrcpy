import promClient from 'prom-client';

const labels = ['player_name', 'user_email'];

const playerNames = ['Broadway.js', 'H264 Converter', 'Tiny H264', 'WebCodecs'];

const decodedFramesGauge = new promClient.Gauge({
    name: 'decoded_frames',
    help: 'Number of decoded frames per second',
    labelNames: labels,
});

const droppedFramesGauge = new promClient.Gauge({
    name: 'dropped_frames',
    help: 'Number of dropped frame per second',
    labelNames: labels,
});

const inputFramesGauge = new promClient.Gauge({
    name: 'input_frames',
    help: 'Number of input frames per second',
    labelNames: labels,
});

const inputBytesGauge = new promClient.Gauge({
    name: 'input_bytes',
    help: 'Number of input bytes per second',
    labelNames: labels,
});

const webSocketConnections = new promClient.Gauge({
    name: 'ws_active_connections',
    help: 'Number of active WebSocket connections',
    labelNames: ['user_email'],
});

export { decodedFramesGauge, droppedFramesGauge, inputBytesGauge, inputFramesGauge, webSocketConnections, playerNames };
