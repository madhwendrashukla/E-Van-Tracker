function getCrc16(buffer) {
  let crc = 0xFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= (buffer[i] << 8) & 0xFFFF;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

function parseGT06(buffer) {
  // A minimum GT06 packet is at least 10 bytes:
  // Start(2) + Length(1) + Protocol(1) + Serial(2) + CRC(2) + Stop(2)
  if (buffer.length < 10) return null;

  // Check start bits (0x78 0x78 or 0x79 0x79)
  if (buffer[0] !== 0x78 || buffer[1] !== 0x78) {
    return null; // For now, only handling 0x78 0x78
  }

  const packetLength = buffer[2];
  const protocolNumber = buffer[3];
  
  // Extract Information Serial Number (located before CRC)
  // Packet structure: Start(2) + Length(1) + Protocol(1) + Content(...) + Serial(2) + CRC(2) + Stop(2)
  // Stop is at buffer.length - 2
  // CRC is at buffer.length - 4
  // Serial is at buffer.length - 6
  // But packetLength gives us the length of (Protocol + Content + Serial + CRC)
  // So total packet length = 2 (Start) + 1 (Length) + packetLength + 2 (Stop) = packetLength + 5
  if (buffer.length !== packetLength + 5) {
    return null; // Malformed packet or incomplete
  }

  const serialNumber = buffer.readUInt16BE(packetLength + 5 - 6);

  let parsedData = {
    protocol: protocolNumber,
    serialNumber: serialNumber,
    raw: buffer
  };

  switch (protocolNumber) {
    case 0x01: // Login Message
      const terminalIdBuffer = buffer.slice(4, 12);
      // Terminal ID is represented as 8 bytes, converting hex string to numbers
      parsedData.imei = terminalIdBuffer.toString('hex');
      break;
    case 0x12: // Location Data
      if (buffer.length >= 31) {
        // Date/Time
        const datetime = {
          year: buffer[4],
          month: buffer[5],
          day: buffer[6],
          hour: buffer[7],
          minute: buffer[8],
          second: buffer[9]
        };
        
        // Lat/Lon
        // Formula: Value = Degrees * 30000 * 60 = Degrees * 1800000
        let lat = buffer.readUInt32BE(11) / 1800000;
        let lon = buffer.readUInt32BE(15) / 1800000;
        
        const speed = buffer[19];
        
        const courseStatus = buffer.readUInt16BE(20);
        const isWest = (courseStatus & 0x2000) > 0;
        const isNorth = (courseStatus & 0x1000) > 0;
        
        if (isWest) lon = -lon;
        if (!isNorth) lat = -lat;

        parsedData.location = {
          lat,
          lon,
          speed,
          timestamp: new Date(Date.UTC(2000 + datetime.year, datetime.month - 1, datetime.day, datetime.hour, datetime.minute, datetime.second)).toISOString()
        };
      }
      break;
    case 0x13: // Status information / Heartbeat
      break;
    case 0x16: // Alarm Data
      break;
  }

  return parsedData;
}

function createAck(protocolNumber, serialNumber) {
  // ACK packet structure:
  // Start (78 78) + Length (05) + Protocol (matches request) + Serial (2 bytes) + CRC (2 bytes) + Stop (0D 0A)
  const length = 0x05;
  const buf = Buffer.alloc(10);
  buf[0] = 0x78;
  buf[1] = 0x78;
  buf[2] = length;
  buf[3] = protocolNumber;
  buf.writeUInt16BE(serialNumber, 4);

  // CRC is calculated over Length, Protocol, and Serial (bytes 2 to 5 inclusive)
  const crcData = buf.slice(2, 6);
  const crc = getCrc16(crcData);
  
  buf.writeUInt16BE(crc, 6);
  buf[8] = 0x0D;
  buf[9] = 0x0A;

  return buf;
}

module.exports = {
  parseGT06,
  createAck
};
