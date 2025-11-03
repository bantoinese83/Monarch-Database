/**
 * Monarch Database IoT Data Processing Demo
 *
 * This example demonstrates an IoT data processing application with
 * sensor data ingestion, time series analytics, real-time monitoring,
 * and automated alerting using Monarch's advanced features.
 */

import { Monarch } from 'monarch-database-quantum';

interface Sensor {
  id: string;
  deviceId: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light';
  location: string;
  building: string;
  floor: number;
  room: string;
  status: 'active' | 'inactive' | 'maintenance';
  batteryLevel: number;
  lastReading: Date;
  installedAt: Date;
}

interface SensorReading {
  id: string;
  sensorId: string;
  timestamp: Date;
  value: number;
  unit: string;
  quality: 'good' | 'fair' | 'poor';
  metadata: {
    temperature?: number;
    humidity?: number;
    batteryVoltage?: number;
  };
}

interface Alert {
  id: string;
  sensorId: string;
  type: 'threshold' | 'anomaly' | 'offline' | 'maintenance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

class IoTDataProcessor {
  private db: Monarch;
  private sensors: any;
  private readings: any;
  private alerts: any;

  constructor() {
    this.db = new Monarch();
    this.sensors = this.db.addCollection('sensors');
    this.readings = this.db.addCollection('readings');
    this.alerts = this.db.addCollection('alerts');

    // Create indexes for performance
    this.sensors.createIndex('deviceId');
    this.sensors.createIndex('location');
    this.sensors.createIndex('status');
    this.readings.createIndex('sensorId');
    this.readings.createIndex('timestamp');
    this.alerts.createIndex('sensorId');
    this.alerts.createIndex('severity');
    this.alerts.createIndex('acknowledged');
  }

  // Sensor management
  async registerSensor(sensorData: Omit<Sensor, 'id' | 'lastReading' | 'installedAt'>): Promise<Sensor> {
    const sensor: Sensor = {
      id: `sensor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...sensorData,
      lastReading: new Date(),
      installedAt: new Date()
    };

    await this.sensors.insert(sensor);
    console.log(`📡 Sensor registered: ${sensor.deviceId} (${sensor.type}) in ${sensor.location}`);
    return sensor;
  }

  async updateSensorStatus(sensorId: string, status: Sensor['status'], batteryLevel?: number): Promise<void> {
    const update: any = { status };
    if (batteryLevel !== undefined) update.batteryLevel = batteryLevel;

    await this.sensors.update({ id: sensorId }, update);
    console.log(`🔄 Sensor ${sensorId} status: ${status}${batteryLevel ? ` (${batteryLevel}% battery)` : ''}`);
  }

  // Data ingestion
  async ingestReading(readingData: Omit<SensorReading, 'id'>): Promise<SensorReading> {
    const reading: SensorReading = {
      id: `reading_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...readingData
    };

    await this.readings.insert(reading);

    // Update sensor's last reading timestamp
    await this.sensors.update({ id: readingData.sensorId }, { lastReading: readingData.timestamp });

    // Check for alerts
    await this.checkThresholds(reading);

    return reading;
  }

  async ingestBatchReadings(readings: Omit<SensorReading, 'id'>[]): Promise<void> {
    const startTime = Date.now();

    // Process in batches for better performance
    const batchSize = 100;
    for (let i = 0; i < readings.length; i += batchSize) {
      const batch = readings.slice(i, i + batchSize);

      await this.db.transaction(async () => {
        for (const readingData of batch) {
          await this.ingestReading(readingData);
        }
      });
    }

    const duration = Date.now() - startTime;
    console.log(`📊 Ingested ${readings.length} readings in ${duration}ms (${Math.round(readings.length / (duration / 1000))} readings/sec)`);
  }

  // Alert system
  private async checkThresholds(reading: SensorReading): Promise<void> {
    const sensor = await this.sensors.findOne({ id: reading.sensorId });
    if (!sensor) return;

    // Temperature thresholds
    if (reading.unit === '°C') {
      if (reading.value > 30) {
        await this.createAlert(reading.sensorId, 'threshold', 'high',
          `High temperature: ${reading.value}°C`, reading.value, 30);
      } else if (reading.value < 15) {
        await this.createAlert(reading.sensorId, 'threshold', 'medium',
          `Low temperature: ${reading.value}°C`, reading.value, 15);
      }
    }

    // Humidity thresholds
    if (reading.unit === '%') {
      if (reading.value > 80) {
        await this.createAlert(reading.sensorId, 'threshold', 'medium',
          `High humidity: ${reading.value}%`, reading.value, 80);
      }
    }

    // Battery level alerts
    if (reading.metadata?.batteryVoltage && reading.metadata.batteryVoltage < 2.5) {
      await this.createAlert(reading.sensorId, 'maintenance', 'medium',
        `Low battery voltage: ${reading.metadata.batteryVoltage}V`);
    }

    // Offline sensor detection
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (sensor.lastReading < fiveMinutesAgo && sensor.status === 'active') {
      await this.createAlert(reading.sensorId, 'offline', 'high', 'Sensor appears to be offline');
    }
  }

  private async createAlert(
    sensorId: string,
    type: Alert['type'],
    severity: Alert['severity'],
    message: string,
    value?: number,
    threshold?: number
  ): Promise<void> {
    // Check if similar alert exists recently (avoid spam)
    const recentAlert = await this.alerts.findOne({
      sensorId,
      type,
      acknowledged: false,
      timestamp: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // Last 10 minutes
    });

    if (recentAlert) return; // Don't create duplicate alerts

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sensorId,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      acknowledged: false
    };

    await this.alerts.insert(alert);
    console.log(`🚨 Alert [${severity.toUpperCase()}]: ${message} (Sensor: ${sensorId})`);
  }

  // Analytics and reporting
  async getSensorAnalytics(sensorId: string, hours = 24): Promise<{
    average: number;
    min: number;
    max: number;
    readings: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const readings = await this.readings.find(
      { sensorId, timestamp: { $gte: startTime } },
      {},
      { sort: { timestamp: 1 } }
    );

    if (readings.length === 0) {
      return { average: 0, min: 0, max: 0, readings: 0, trend: 'stable' };
    }

    const values = readings.map((r: SensorReading) => r.value);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate trend
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (secondAvg > firstAvg + 0.1) trend = 'increasing';
    else if (secondAvg < firstAvg - 0.1) trend = 'decreasing';

    return { average, min, max, readings: readings.length, trend };
  }

  async getBuildingSummary(building: string, hours = 24): Promise<{
    sensors: number;
    activeSensors: number;
    totalReadings: number;
    alerts: number;
    averageTemperature: number;
    averageHumidity: number;
  }> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const sensors = await this.sensors.find({ building });
    const activeSensors = sensors.filter((s: Sensor) => s.status === 'active');

    const readings = await this.readings.find({
      sensorId: { $in: sensors.map((s: Sensor) => s.id) },
      timestamp: { $gte: startTime }
    });

    const alerts = await this.alerts.find({
      sensorId: { $in: sensors.map((s: Sensor) => s.id) },
      timestamp: { $gte: startTime }
    });

    const temperatureReadings = readings.filter((r: SensorReading) => r.unit === '°C');
    const humidityReadings = readings.filter((r: SensorReading) => r.unit === '%');

    const averageTemperature = temperatureReadings.length > 0
      ? temperatureReadings.reduce((sum: number, r: SensorReading) => sum + r.value, 0) / temperatureReadings.length
      : 0;

    const averageHumidity = humidityReadings.length > 0
      ? humidityReadings.reduce((sum: number, r: SensorReading) => sum + r.value, 0) / humidityReadings.length
      : 0;

    return {
      sensors: sensors.length,
      activeSensors: activeSensors.length,
      totalReadings: readings.length,
      alerts: alerts.length,
      averageTemperature,
      averageHumidity
    };
  }

  // Real-time monitoring
  setupRealTimeMonitoring(): void {
    // Monitor new readings
    this.readings.watch().on('insert', (change) => {
      const reading = change.doc as SensorReading;
      console.log(`📊 Reading: Sensor ${reading.sensorId} = ${reading.value}${reading.unit}`);
    });

    // Monitor alerts
    this.alerts.watch().on('insert', (change) => {
      const alert = change.doc as Alert;
      const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : 'ℹ️';
      console.log(`${emoji} Alert: ${alert.message}`);
    });

    // Monitor sensor status changes
    this.sensors.watch().on('update', (change) => {
      const sensor = change.doc as Sensor;
      if (sensor.status !== 'active') {
        console.log(`🔧 Sensor ${sensor.deviceId} status: ${sensor.status}`);
      }
    });
  }

  // Maintenance and cleanup
  async cleanupOldData(daysOld = 30): Promise<{ readingsRemoved: number; alertsRemoved: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const readingsRemoved = await this.readings.remove({
      timestamp: { $lt: cutoffDate }
    });

    const alertsRemoved = await this.alerts.remove({
      timestamp: { $lt: cutoffDate },
      acknowledged: true
    });

    console.log(`🧹 Cleaned up ${readingsRemoved} old readings and ${alertsRemoved} old alerts`);
    return { readingsRemoved, alertsRemoved };
  }
}

// Demo usage
async function runIoTDemo(): Promise<void> {
  console.log('📡 Monarch Database - IoT Data Processing Demo\n');

  const iotProcessor = new IoTDataProcessor();
  iotProcessor.setupRealTimeMonitoring();

  try {
    // Register sensors
    console.log('📡 Registering sensors...');
    const tempSensor1 = await iotProcessor.registerSensor({
      deviceId: 'TEMP-001',
      type: 'temperature',
      location: 'Office A',
      building: 'HQ',
      floor: 1,
      room: 'Conference Room',
      status: 'active',
      batteryLevel: 85
    });

    const tempSensor2 = await iotProcessor.registerSensor({
      deviceId: 'TEMP-002',
      type: 'temperature',
      location: 'Office B',
      building: 'HQ',
      floor: 2,
      room: 'Development Area',
      status: 'active',
      batteryLevel: 92
    });

    const humiditySensor = await iotProcessor.registerSensor({
      deviceId: 'HUMID-001',
      type: 'humidity',
      location: 'Office A',
      building: 'HQ',
      floor: 1,
      room: 'Conference Room',
      status: 'active',
      batteryLevel: 78
    });

    // Simulate data ingestion
    console.log('\n📊 Ingesting sensor data...');
    const readings = [];

    // Generate temperature readings (simulate 1 hour of data, every 5 minutes)
    for (let i = 0; i < 12; i++) {
      const timestamp = new Date(Date.now() - (11 - i) * 5 * 60 * 1000);

      readings.push({
        sensorId: tempSensor1.id,
        timestamp,
        value: 22 + Math.sin(i / 2) * 3 + Math.random() * 2, // 19-27°C with variation
        unit: '°C',
        quality: 'good',
        metadata: { batteryVoltage: 3.7 - Math.random() * 0.5 }
      });

      readings.push({
        sensorId: tempSensor2.id,
        timestamp,
        value: 24 + Math.cos(i / 3) * 2 + Math.random() * 1.5, // 21-27°C with variation
        unit: '°C',
        quality: 'good',
        metadata: { batteryVoltage: 3.8 - Math.random() * 0.3 }
      });

      readings.push({
        sensorId: humiditySensor.id,
        timestamp,
        value: 45 + Math.sin(i / 4) * 10 + Math.random() * 5, // 35-65% with variation
        unit: '%',
        quality: 'good',
        metadata: { temperature: 23 + Math.random() * 4 }
      });
    }

    await iotProcessor.ingestBatchReadings(readings);

    // Generate some alerts (simulate high temperature)
    console.log('\n🚨 Generating test alerts...');
    await iotProcessor.ingestReading({
      sensorId: tempSensor1.id,
      timestamp: new Date(),
      value: 35, // High temperature alert
      unit: '°C',
      quality: 'good',
      metadata: {}
    });

    // Analytics
    console.log('\n📊 Analytics:');
    const analytics1 = await iotProcessor.getSensorAnalytics(tempSensor1.id);
    console.log(`Sensor ${tempSensor1.deviceId}: ${analytics1.readings} readings, avg: ${analytics1.average.toFixed(1)}°C, trend: ${analytics1.trend}`);

    const buildingSummary = await iotProcessor.getBuildingSummary('HQ');
    console.log(`Building HQ: ${buildingSummary.activeSensors}/${buildingSummary.sensors} sensors active, ${buildingSummary.totalReadings} readings`);

    // Simulate sensor going offline
    setTimeout(async () => {
      await iotProcessor.updateSensorStatus(tempSensor2.id, 'inactive');
    }, 1000);

    // Cleanup
    const cleanup = await iotProcessor.cleanupOldData(0); // Clean all for demo
    console.log(`\n🧹 Cleaned up ${cleanup.readingsRemoved} readings and ${cleanup.alertsRemoved} alerts`);

    // Health check
    console.log('\n🏥 Database Health Check:');
    const health = await iotProcessor.db.healthCheck();
    console.log(`Status: ${health.status} | Collections: ${health.collections} | Memory: ${(health.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n🎉 IoT data processing demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo
runIoTDemo().catch(console.error);
