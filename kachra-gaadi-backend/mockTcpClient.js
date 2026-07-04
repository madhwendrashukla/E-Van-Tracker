const net = require('net');

const client = new net.Socket();
const PORT = 5901;
const HOST = '127.0.0.1';

client.connect(PORT, HOST, () => {
    console.log('Connected to TCP Server');
    // Send a mock GT06 login packet (hex)
    const mockPacket = Buffer.from('78780D01012345678901234500018C210D0A', 'hex');
    client.write(mockPacket);
});

client.on('data', (data) => {
    console.log('Received from server: ' + data.toString('hex'));
    client.destroy(); // kill client after server's response
});

client.on('close', () => {
    console.log('Connection closed');
});

setTimeout(() => {
    client.destroy();
}, 2000);
