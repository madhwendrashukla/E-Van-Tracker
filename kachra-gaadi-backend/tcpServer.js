const net = require('net');
const { parseGT06, createAck } = require('./utils/gt06Parser');

function startTcpServer(port, processHardwareLocation) {
  const server = net.createServer((socket) => {
    console.log(`[TCP Server] Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (data) => {
      // Hardware GPS trackers typically send binary/hex data, not ASCII strings.
      const hexData = data.toString('hex').toUpperCase();
      console.log(`[TCP Server] Received from ${socket.remoteAddress}: ${hexData}`);
      
      try {
        const parsedData = parseGT06(data);
        if (parsedData) {
          console.log(`[TCP Server] Parsed GT06 Protocol: 0x${parsedData.protocol.toString(16).padStart(2, '0').toUpperCase()}`);
          
          if (parsedData.imei) {
            console.log(`[TCP Server] IMEI: ${parsedData.imei}`);
            // Associate this socket with the IMEI for future location logs
            socket.imei = parsedData.imei;
          }

          if (parsedData.protocol === 0x12 && parsedData.location && socket.imei) {
            console.log(`[TCP Server] Location Update from ${socket.imei}: Lat ${parsedData.location.lat}, Lng ${parsedData.location.lon}`);
            if (typeof processHardwareLocation === 'function') {
              processHardwareLocation({
                vehicle_id: socket.imei,
                lat: parsedData.location.lat,
                lng: parsedData.location.lon,
                speed: parsedData.location.speed,
                timestamp: parsedData.location.timestamp,
                source: 'hardware'
              }).catch(err => console.error('[TCP Server] processHardwareLocation error:', err));
            }
          }
          
          // Some trackers expect an ACK (acknowledgment) for their heartbeat or login packets.
          const ackBuffer = createAck(parsedData.protocol, parsedData.serialNumber);
          socket.write(ackBuffer);
          console.log(`[TCP Server] Sent ACK: ${ackBuffer.toString('hex').toUpperCase()}`);
        } else {
          console.log('[TCP Server] Unrecognized or malformed packet.');
        }
      } catch (err) {
        console.error(`[TCP Server] Error parsing packet: ${err.message}`);
      }
    });

    socket.on('end', () => {
      console.log(`[TCP Server] Client disconnected: ${socket.remoteAddress}`);
    });

    socket.on('error', (err) => {
      console.error(`[TCP Server] Socket Error: ${err.message}`);
    });
  });

  server.on('error', (err) => {
    console.error(`[TCP Server] Server Error: ${err.message}`);
  });

  server.listen(port, () => {
    console.log(`[TCP Server] TCP server listening for GPS tracker connections on port ${port}`);
  });

  return server;
}

module.exports = { startTcpServer };
