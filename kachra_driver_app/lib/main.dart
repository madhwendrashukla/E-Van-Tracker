import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EVanDriverApp());
}

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('locations.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, filePath);
    return await openDatabase(path, version: 1, onCreate: _createDB);
  }

  Future _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE location_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id TEXT NOT NULL,
        city_id TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        speed REAL NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL
      )
    ''');
  }

  Future<void> insertLocation(Map<String, dynamic> location) async {
    final db = await instance.database;
    await db.insert('location_queue', location);
  }

  Future<List<Map<String, dynamic>>> getQueuedLocations() async {
    final db = await instance.database;
    return await db.query('location_queue', orderBy: 'id ASC');
  }

  Future<void> deleteLocations(List<int> ids) async {
    final db = await instance.database;
    await db.delete(
      'location_queue',
      where: 'id IN (${List.filled(ids.length, '?').join(',')})',
      whereArgs: ids,
    );
  }
}

class EVanDriverApp extends StatelessWidget {
  const EVanDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'E-Van Tracker Driver',
      theme: ThemeData(
        primarySwatch: Colors.green,
        scaffoldBackgroundColor: Colors.grey[100],
      ),
      home: const DriverLoginScreen(),
    );
  }
}

class DriverLoginScreen extends StatefulWidget {
  const DriverLoginScreen({super.key});

  @override
  State<DriverLoginScreen> createState() => _DriverLoginScreenState();
}

class _DriverLoginScreenState extends State<DriverLoginScreen> {
  final _vehicleCodeController = TextEditingController();
  final _apiUrlController = TextEditingController(text: 'http://10.0.2.2:3001');

  @override
  void initState() {
    super.initState();
    _checkLogin();
  }

  void _checkLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString('vehicle_code');
    final url = prefs.getString('api_url');
    if (url != null) _apiUrlController.text = url;

    if (code != null && code.isNotEmpty) {
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => TrackingScreen(vehicleCode: code, apiUrl: _apiUrlController.text)),
      );
    }
  }

  void _login() async {
    final code = _vehicleCodeController.text.trim().toUpperCase();
    final url = _apiUrlController.text.trim();
    if (code.isEmpty || url.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('vehicle_code', code);
    await prefs.setString('api_url', url);
    
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => TrackingScreen(vehicleCode: code, apiUrl: url)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.local_shipping, size: 80, color: Colors.green),
                const SizedBox(height: 20),
                const Text(
                  'Driver Portal',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.green),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _vehicleCodeController,
                  decoration: InputDecoration(
                    labelText: 'Vehicle Code (e.g. LKO-001)',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.badge),
                  ),
                  textCapitalization: TextCapitalization.characters,
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: _apiUrlController,
                  decoration: InputDecoration(
                    labelText: 'Backend API URL',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.link),
                  ),
                ),
                const SizedBox(height: 30),
                ElevatedButton(
                  onPressed: _login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    minimumSize: const Size.fromHeight(55),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Start Shift', style: TextStyle(fontSize: 18, color: Colors.white)),
                )
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class TrackingScreen extends StatefulWidget {
  final String vehicleCode;
  final String apiUrl;
  
  const TrackingScreen({super.key, required this.vehicleCode, required this.apiUrl});

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  bool _isTracking = false;
  Timer? _timer;
  int _queuedPoints = 0;
  String _statusMessage = "Ready to start";
  Position? _lastSentPosition;

  @override
  void initState() {
    super.initState();
    _updateQueueCount();
  }

  Future<void> _updateQueueCount() async {
    final queued = await DatabaseHelper.instance.getQueuedLocations();
    setState(() {
      _queuedPoints = queued.length;
    });
  }

  Future<void> _syncOfflineData() async {
    final queued = await DatabaseHelper.instance.getQueuedLocations();
    if (queued.isEmpty) return;

    List<int> syncedIds = [];
    final uri = Uri.parse('${widget.apiUrl}/api/location');

    for (var row in queued) {
      try {
        final payload = Map<String, dynamic>.from(row);
        payload.remove('id'); // Remove local SQLite ID
        
        final response = await http.post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(payload),
        );
        
        if (response.statusCode == 200) {
          syncedIds.add(row['id'] as int);
        }
      } catch (e) {
        break; // Stop syncing on first error (likely still offline)
      }
    }

    if (syncedIds.isNotEmpty) {
      await DatabaseHelper.instance.deleteLocations(syncedIds);
      _updateQueueCount();
    }
  }

  Future<void> _startTracking() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        setState(() => _statusMessage = "Permission denied!");
        return;
      }
    }

    setState(() {
      _isTracking = true;
      _statusMessage = "Acquiring GPS...";
    });

    _timer = Timer.periodic(const Duration(seconds: 5), (timer) async {
      try {
        Position position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.bestForNavigation);
            
        // Reject inaccurate GPS locks (e.g. cell tower triangulation instead of actual satellite GPS)
        if (position.accuracy > 30.0) {
          return; // Skip and wait for a stronger GPS signal
        }
        
        // Filter out GPS drift (ignore movements less than 10 meters)
        if (_lastSentPosition != null) {
          double distance = Geolocator.distanceBetween(
            _lastSentPosition!.latitude, _lastSentPosition!.longitude,
            position.latitude, position.longitude
          );
          if (distance < 10.0) {
            return; // Skip sending to avoid spiderweb jitter when parked
          }
        }
        
        _lastSentPosition = position;

        final cityId = widget.vehicleCode.split('-').first;
        
        final payload = {
          "vehicle_id": widget.vehicleCode,
          "city_id": cityId,
          "lat": position.latitude,
          "lng": position.longitude,
          "speed": (position.speed * 3.6), // m/s to km/h
          "timestamp": DateTime.now().toUtc().toIso8601String(),
          "source": "app"
        };

        setState(() {
          _statusMessage = "Tracking: ${position.speed.toStringAsFixed(1)} m/s";
        });

        // Try syncing old data first
        await _syncOfflineData();

        // Send current data
        final url = Uri.parse('${widget.apiUrl}/api/location'); 
        final response = await http.post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(payload),
        );

        if (response.statusCode != 200) {
          throw Exception("Server rejected data");
        }
      } catch (e) {
        // Offline logic
        final cityId = widget.vehicleCode.split('-').first;
        Position? lastPos = await Geolocator.getLastKnownPosition();
        if (lastPos != null) {
           await DatabaseHelper.instance.insertLocation({
             "vehicle_id": widget.vehicleCode,
             "city_id": cityId,
             "lat": lastPos.latitude,
             "lng": lastPos.longitude,
             "speed": (lastPos.speed * 3.6),
             "timestamp": DateTime.now().toUtc().toIso8601String(),
             "source": "app-offline"
           });
           setState(() => _statusMessage = "Offline (Saved locally)");
           _updateQueueCount();
        }
      }
    });
  }

  void _stopTracking() {
    _timer?.cancel();
    setState(() {
      _isTracking = false;
      _statusMessage = "Tracking Stopped";
    });
  }

  void _logout() async {
    _stopTracking();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('vehicle_code');
    
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const DriverLoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.vehicleCode),
        backgroundColor: Colors.green,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.cloud_sync),
            tooltip: "Sync Offline Data",
            onPressed: _syncOfflineData,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          )
        ],
      ),
      body: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.green.shade50, Colors.white],
          )
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(30),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _isTracking ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
              ),
              child: Icon(
                _isTracking ? Icons.satellite_alt : Icons.gps_off,
                size: 100,
                color: _isTracking ? Colors.green : Colors.red,
              ),
            ),
            const SizedBox(height: 30),
            Text(
              _statusMessage,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.black87),
            ),
            const SizedBox(height: 10),
            if (_queuedPoints > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.orange.shade100,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$_queuedPoints points saved offline',
                  style: TextStyle(color: Colors.orange.shade900, fontWeight: FontWeight.bold),
                ),
              ),
            const SizedBox(height: 50),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: ElevatedButton(
                onPressed: _isTracking ? _stopTracking : _startTracking,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isTracking ? Colors.red : Colors.green,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                  minimumSize: const Size.fromHeight(60),
                  elevation: 5,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(_isTracking ? Icons.stop : Icons.play_arrow, color: Colors.white),
                    const SizedBox(width: 10),
                    Text(
                      _isTracking ? 'END SHIFT' : 'START SHIFT',
                      style: const TextStyle(fontSize: 20, color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
