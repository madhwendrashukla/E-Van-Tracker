import 'dart:async';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:permission_handler/permission_handler.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await initializeService();
  runApp(const EVanDriverApp());
}

Future<void> initializeService() async {
  final service = FlutterBackgroundService();

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: false, // Start only when driver hits 'Start Shift'
      isForegroundMode: true,
      initialNotificationTitle: 'E-Van Tracker',
      initialNotificationContent: 'Driver shift ready',
      foregroundServiceTypes: [AndroidForegroundType.location],
    ),
    iosConfiguration: IosConfiguration(
      autoStart: false,
      onForeground: onStart,
      onBackground: onIosBackground,
    ),
  );
}

@pragma('vm:entry-point')
bool onIosBackground(ServiceInstance service) {
  WidgetsFlutterBinding.ensureInitialized();
  return true;
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });

    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }

  service.on('stopService').listen((event) {
    service.stopSelf();
  });

  // Load configured shift credentials
  final prefs = await SharedPreferences.getInstance();
  final vehicleCode = prefs.getString('vehicle_code') ?? '';
  final apiUrl = prefs.getString('api_url') ?? '';
  final apiKey = prefs.getString('api_key') ?? 'default-secret-driver-key';

  if (vehicleCode.isEmpty || apiUrl.isEmpty) {
    service.stopSelf();
    return;
  }

  // Run initial background sync
  _syncOfflineDataInBackground(apiUrl, vehicleCode, apiKey);

  StreamSubscription<Position>? positionStream;

  DateTime? lastSent;

  // Listen to continuous high-precision GPS stream
  positionStream = Geolocator.getPositionStream(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.bestForNavigation,
    ),
  ).listen((Position position) async {
    // Filter out inaccurate cellular/wifi triangulation jumps
    if (position.accuracy > 30.0) {
      return; 
    }

    final now = DateTime.now();
    if (lastSent != null && now.difference(lastSent!).inSeconds < 10) {
      // Throttle to max 1 update per 10 seconds to prevent spam
      return;
    }
    lastSent = now;

    final speedKmh = position.speed * 3.6; // Convert m/s to km/h
    final timestamp = DateTime.now().toUtc().toIso8601String();
    
    final payload = {
      "vehicle_id": vehicleCode,
      "lat": position.latitude,
      "lng": position.longitude,
      "speed": speedKmh,
      "timestamp": timestamp,
      "source": "app"
    };

    try {
      final response = await http.post(
        Uri.parse('$apiUrl/api/location'),
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 3));

      if (response.statusCode == 200) {
        if (service is AndroidServiceInstance) {
          service.setForegroundNotificationInfo(
            title: "Tracking Active - $vehicleCode",
            content: "Speed: ${speedKmh.toStringAsFixed(1)} km/h | Status: Online",
          );
        }

        // Notify UI isolate
        service.invoke('location_update', {
          'lat': position.latitude,
          'lng': position.longitude,
          'speed': speedKmh,
          'status': 'Online',
          'timestamp': timestamp,
          'queued_count': 0
        });

        // Try syncing any previously buffered offline data
        await _syncOfflineDataInBackground(apiUrl, vehicleCode, apiKey);
      } else {
        throw Exception("Server rejected packet");
      }
    } catch (e) {
      // Offline fallback: Buffer data locally in SQLite
      await DatabaseHelper.instance.insertLocation({
        "vehicle_id": vehicleCode,
        "lat": position.latitude,
        "lng": position.longitude,
        "speed": speedKmh,
        "timestamp": timestamp,
        "source": "app-offline"
      });

      final queued = await DatabaseHelper.instance.getQueuedLocations();

      if (service is AndroidServiceInstance) {
        service.setForegroundNotificationInfo(
          title: "Tracking Offline - $vehicleCode",
          content: "Buffered ${queued.length} points locally",
        );
      }

      // Notify UI isolate
      service.invoke('location_update', {
        'lat': position.latitude,
        'lng': position.longitude,
        'speed': speedKmh,
        'status': 'Offline (Buffered)',
        'timestamp': timestamp,
        'queued_count': queued.length
      });
    }
  });

  // Cleanup logic
  service.on('stopService').listen((event) {
    positionStream?.cancel();
  });
}

Future<void> _syncOfflineDataInBackground(String apiUrl, String vehicleCode, String apiKey) async {
  final queued = await DatabaseHelper.instance.getQueuedLocations();
  if (queued.isEmpty) return;

  List<int> syncedIds = [];
  final uri = Uri.parse('$apiUrl/api/location');

  for (var row in queued) {
    try {
      final payload = Map<String, dynamic>.from(row);
      payload.remove('id'); // Remove local SQLite ID
      
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 3));
      
      if (response.statusCode == 200) {
        syncedIds.add(row['id'] as int);
      } else {
        break; // Stop syncing on first network failure
      }
    } catch (e) {
      break; // Network unreachable
    }
  }

  if (syncedIds.isNotEmpty) {
    await DatabaseHelper.instance.deleteLocations(syncedIds);
  }
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
      debugShowCheckedModeBanner: false,
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
  final _apiUrlController = TextEditingController(text: 'https://backend.mybuildspace.in');
  final _apiKeyController = TextEditingController(text: 'default-secret-driver-key');

  @override
  void initState() {
    super.initState();
    _checkLogin();
  }

  void _checkLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString('vehicle_code');
    final url = prefs.getString('api_url');
    final key = prefs.getString('api_key');
    if (url != null) _apiUrlController.text = url;
    if (key != null) _apiKeyController.text = key;

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
    final key = _apiKeyController.text.trim();
    if (code.isEmpty || url.isEmpty || key.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('vehicle_code', code);
    await prefs.setString('api_url', url);
    await prefs.setString('api_key', key);
    
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
                    labelText: 'Vehicle ID (Code or IMEI)',
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
                const SizedBox(height: 20),
                TextField(
                  controller: _apiKeyController,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'API Key',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.key),
                    helperText: 'Get this from your fleet administrator',
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
  int _queuedPoints = 0;
  String _statusMessage = "Ready to start";
  StreamSubscription? _serviceSubscription;

  @override
  void initState() {
    super.initState();
    _checkServiceStatus();
  }

  @override
  void dispose() {
    _serviceSubscription?.cancel();
    super.dispose();
  }

  Future<void> _checkServiceStatus() async {
    final isRunning = await FlutterBackgroundService().isRunning();
    setState(() {
      _isTracking = isRunning;
      if (isRunning) {
        _statusMessage = "Tracking active in background";
        _subscribeToServiceUpdates();
      }
    });
    _updateQueueCount();
  }

  void _subscribeToServiceUpdates() {
    _serviceSubscription?.cancel();
    _serviceSubscription = FlutterBackgroundService().on('location_update').listen((event) {
      if (event != null && mounted) {
        setState(() {
          final speed = event['speed'] as double? ?? 0.0;
          final status = event['status'] as String? ?? 'Online';
          final queued = event['queued_count'] as int? ?? 0;
          
          _statusMessage = "Tracking: ${speed.toStringAsFixed(1)} km/h ($status)";
          _queuedPoints = queued;
        });
      }
    });
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

    setState(() {
      _statusMessage = "Syncing buffered data...";
    });

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
        ).timeout(const Duration(seconds: 3));
        
        if (response.statusCode == 200) {
          syncedIds.add(row['id'] as int);
        }
      } catch (e) {
        break; // Stop syncing on first error
      }
    }

    if (syncedIds.isNotEmpty) {
      await DatabaseHelper.instance.deleteLocations(syncedIds);
      await _updateQueueCount();
    }
    
    final isRunning = await FlutterBackgroundService().isRunning();
    setState(() {
      _statusMessage = isRunning ? "Tracking active in background" : "Ready to start";
    });
  }

  Future<void> _startTracking() async {
    // Android 13+ requires explicit notification permission
    if (await Permission.notification.isDenied) {
      await Permission.notification.request();
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        setState(() => _statusMessage = "Permission denied!");
        return;
      }
    }
    
    if (permission == LocationPermission.deniedForever) {
      setState(() => _statusMessage = "Location permissions permanently denied!");
      return;
    }

    // Save configuration before starting background service
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('vehicle_code', widget.vehicleCode);
    await prefs.setString('api_url', widget.apiUrl);

    final service = FlutterBackgroundService();
    final isRunning = await service.isRunning();
    if (!isRunning) {
      setState(() {
        _statusMessage = "Starting service...";
      });
      await service.startService();
    }

    setState(() {
      _isTracking = true;
      _statusMessage = "Tracking started";
    });
    _subscribeToServiceUpdates();
  }

  void _stopTracking() async {
    final service = FlutterBackgroundService();
    service.invoke("stopService");
    _serviceSubscription?.cancel();
    setState(() {
      _isTracking = false;
      _statusMessage = "Tracking stopped";
    });
    await _updateQueueCount();
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
        foregroundColor: Colors.white,
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
