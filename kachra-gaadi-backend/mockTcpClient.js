const net = require('net');

const client = new net.Socket();
const PORT = 5901;
const HOST = '127.0.0.1';

client.connect(PORT, HOST, () => {
    console.log('Connected to TCP Server');
    // Send a mock GT06 login packet and location packet concatenated
    const loginPacket = Buffer.from('78780D01086938904533031000018C210D0A', 'hex');
    const locationPacket = Buffer.from('78781F120B081D112E0A027AC7EB0C46584900148F01CC00287D001FBA0000000000018C210D0A', 'hex');
    const combinedPacket = Buffer.concat([loginPacket, locationPacket]);
    client.write(combinedPacket);
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
