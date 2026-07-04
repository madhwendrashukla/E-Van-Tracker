const net = require('net');
const { parseGT06, createAck } = require('./utils/gt06Parser');

function startTcpServer(port, processHardwareLocation) {
  const server = net.createServer((socket) => {
    console.log(`[TCP Server] Client connected: ${socket.remoteAddress}:${socket.remotePort}`);
    socket.dataBuffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      socket.dataBuffer = Buffer.concat([socket.dataBuffer, data]);
      
      while (socket.dataBuffer.length >= 10) {
        // Find start bits 0x78 0x78
        let startIndex = -1;
        for (let i = 0; i < socket.dataBuffer.length - 1; i++) {
          if (socket.dataBuffer[i] === 0x78 && socket.dataBuffer[i+1] === 0x78) {
            startIndex = i;
            break;
          }
        }
        
        if (startIndex === -1) {
          // No start bits found, discard buffer
          socket.dataBuffer = Buffer.alloc(0);
          break;
        }
        
        // Remove garbage before start bits
        if (startIndex > 0) {
          socket.dataBuffer = socket.dataBuffer.slice(startIndex);
        }
        
        if (socket.dataBuffer.length < 5) break; // Need at least up to packet length byte
        
        const packetLength = socket.dataBuffer[2];
        const totalLength = packetLength + 5;
        
        if (socket.dataBuffer.length < totalLength) {
          break; // Incomplete packet, wait for more data
        }
        
        const packetData = socket.dataBuffer.slice(0, totalLength);
        socket.dataBuffer = socket.dataBuffer.slice(totalLength);
        
        const hexData = packetData.toString('hex').toUpperCase();
        console.log(`[TCP Server] Extracted packet from ${socket.remoteAddress}: ${hexData}`);
        
        try {
          const parsedData = parseGT06(packetData);
          if (parsedData) {
            console.log(`[TCP Server] Parsed GT06 Protocol: 0x${parsedData.protocol.toString(16).padStart(2, '0').toUpperCase()}`);
            
            if (parsedData.imei) {
              // Strip leading zero if it's 16 chars (e.g. 0869... -> 869...) to match 15-digit IMEI in DB
              let imei = parsedData.imei;
              if (imei.length === 16 && imei.startsWith('0')) {
                imei = imei.substring(1);
              }
              console.log(`[TCP Server] IMEI: ${imei}`);
              // Associate this socket with the IMEI for future location logs
              socket.imei = imei;
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
