// Monarch Database Admin UI
/* global Chart */

class MonarchAdmin {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3000/api'; // Default Monarch HTTP API port
    this.currentPage = 'dashboard';
    this.connectionStatus = false;
    this.charts = {};
    this.performanceData = {
      responseTime: [],
      throughput: [],
      memoryUsage: [],
      errorRate: []
    };
    this.maxPerformanceDataPoints = 100; // Limit to prevent memory leaks
    this.performanceDataCleanupInterval = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkConnection();
    this.loadDashboard();
    this.startPerformanceMonitoring();
    this.startPerformanceDataCleanup();
  }

  setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.menu-item').forEach(item => {
      if (!item) return;
      item.addEventListener('click', () => this.switchPage(item.dataset.page));
    });

    // Menu toggle for mobile
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('active');
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshCurrentPage());
    }

    // Collection modal
    const createCollectionBtn = document.getElementById('createCollectionBtn');
    if (createCollectionBtn) {
      createCollectionBtn.addEventListener('click', () => this.showCollectionModal());
    }

    const closeCollectionModal = document.getElementById('closeCollectionModal');
    if (closeCollectionModal) {
      closeCollectionModal.addEventListener('click', () => this.hideCollectionModal());
    }

    const cancelCollectionBtn = document.getElementById('cancelCollectionBtn');
    if (cancelCollectionBtn) {
      cancelCollectionBtn.addEventListener('click', () => this.hideCollectionModal());
    }

    const createCollectionConfirmBtn = document.getElementById('createCollectionConfirmBtn');
    if (createCollectionConfirmBtn) {
      createCollectionConfirmBtn.addEventListener('click', () => this.createCollection());
    }

    // Query interface
    document.querySelectorAll('.query-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchQueryTab(tab.dataset.tab));
    });
    document.getElementById('executeQueryBtn').addEventListener('click', () => this.executeQuery());
    document.getElementById('clearQueryBtn').addEventListener('click', () => this.clearQuery());

    // Schema
    document.getElementById('refreshSchemaBtn').addEventListener('click', () => this.loadSchema());

    // Performance
    document.getElementById('refreshPerformanceBtn').addEventListener('click', () => this.loadPerformance());

    // Migration
    document.getElementById('startRedisMigration').addEventListener('click', () => this.startRedisMigration());
    document.getElementById('startMongoMigration').addEventListener('click', () => this.startMongoMigration());

    // Click outside modal to close
    document.getElementById('collectionModal').addEventListener('click', (e) => {
      if (e.target.id === 'collectionModal') this.hideCollectionModal();
    });
  }

  async checkConnection() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`);
      this.connectionStatus = response.ok;
      this.updateConnectionStatus();
    } catch (error) {
      this.connectionStatus = false;
      this.updateConnectionStatus();
      // eslint-disable-next-line no-console
      console.error('Connection check failed:', error);
    }
  }

  updateConnectionStatus() {
    const indicator = document.getElementById('connectionStatus');
    const text = document.getElementById('connectionText');

    if (this.connectionStatus) {
      indicator.classList.add('connected');
      text.textContent = 'Connected';
    } else {
      indicator.classList.remove('connected');
      text.textContent = 'Disconnected';
    }
  }

  switchPage(page) {
    // Hide current page
    document.querySelector(`#${this.currentPage}-page`).classList.remove('active');
    document.querySelector(`[data-page="${this.currentPage}"]`).classList.remove('active');

    // Show new page
    this.currentPage = page;
    document.querySelector(`#${page}-page`).classList.add('active');
    document.querySelector(`[data-page="${page}"]`).classList.add('active');

    // Update page title
    document.getElementById('pageTitle').textContent = page.charAt(0).toUpperCase() + page.slice(1);

    // Load page data
    this.loadPageData(page);

    // Close mobile sidebar
    document.querySelector('.sidebar').classList.remove('active');
  }

  loadPageData(page) {
    switch (page) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'collections':
        this.loadCollections();
        break;
      case 'schema':
        this.loadSchema();
        break;
      case 'performance':
        this.loadPerformance();
        break;
    }
  }

  refreshCurrentPage() {
    this.loadPageData(this.currentPage);
  }

  async loadDashboard() {
    if (!this.connectionStatus) return;

    try {
      // Load stats
      const statsResponse = await fetch(`${this.apiBaseUrl}/stats`);
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        this.updateDashboardStats(stats);
      }

      // Load recent activity (mock data for now)
      this.updateRecentActivity();

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load dashboard:', error);
    }
  }

  updateDashboardStats(stats) {
    document.getElementById('totalCollections').textContent = stats.collections || 0;
    document.getElementById('totalDocuments').textContent = stats.documents || 0;
    document.getElementById('dbSize').textContent = this.formatBytes(stats.size || 0);
    document.getElementById('avgResponseTime').textContent = `${stats.avgResponseTime || 0}ms`;
  }

  updateRecentActivity() {
    const activityList = document.getElementById('activityList');
    const activities = [
      { icon: 'play', message: 'Monarch Database started', time: '2 minutes ago' },
      { icon: 'plus', message: 'Collection "users" created', time: '5 minutes ago' },
      { icon: 'search', message: 'Query executed on "products"', time: '10 minutes ago' },
      { icon: 'save', message: 'Database backup completed', time: '15 minutes ago' }
    ];

    activityList.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="fas fa-${activity.icon}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-message">${activity.message}</div>
          <div class="activity-time">${activity.time}</div>
        </div>
      </div>
    `).join('');
  }

  async loadCollections() {
    if (!this.connectionStatus) return;

    try {
      const response = await fetch(`${this.apiBaseUrl}/collections`);
      if (response.ok) {
        const collections = await response.json();
        this.renderCollections(collections);
        this.updateQueryCollections(collections);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load collections:', error);
    }
  }

  renderCollections(collections) {
    const grid = document.getElementById('collectionsGrid');
    grid.innerHTML = collections.map(collection => `
      <div class="collection-card" onclick="admin.selectCollection('${collection.name}')">
        <div class="collection-name">${collection.name}</div>
        <div class="collection-stats">
          <div class="collection-stat">
            <i class="fas fa-file-alt"></i>
            ${collection.documentCount || 0} docs
          </div>
          <div class="collection-stat">
            <i class="fas fa-database"></i>
            ${this.formatBytes(collection.size || 0)}
          </div>
        </div>
      </div>
    `).join('');
  }

  updateQueryCollections(collections) {
    const select = document.getElementById('queryCollection');
    select.innerHTML = '<option value="">Select collection...</option>' +
      collections.map(collection => `<option value="${collection.name}">${collection.name}</option>`).join('');
  }

  selectCollection(name) {
    this.switchPage('query');
    document.getElementById('queryCollection').value = name;
  }

  showCollectionModal() {
    document.getElementById('collectionModal').classList.add('active');
    document.getElementById('collectionName').focus();
  }

  hideCollectionModal() {
    document.getElementById('collectionModal').classList.remove('active');
    document.getElementById('collectionName').value = '';
    document.getElementById('collectionSchema').value = '';
  }

  async createCollection() {
    const name = document.getElementById('collectionName').value.trim();
    const schema = document.getElementById('collectionSchema').value.trim();

    if (!name) {
      alert('Collection name is required');
      return;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          schema: schema ? JSON.parse(schema) : null
        })
      });

      if (response.ok) {
        this.hideCollectionModal();
        this.loadCollections();
        this.addActivityLog('plus', `Collection "${name}" created`);
      } else {
        throw new Error('Failed to create collection');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create collection:', error);
      alert('Failed to create collection: ' + error.message);
    }
  }

  switchQueryTab(tab) {
    document.querySelectorAll('.query-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.query-input-group').forEach(group => group.style.display = 'none');
    document.getElementById(`${tab}QueryGroup`).style.display = 'flex';
  }

  async executeQuery() {
    const collection = document.getElementById('queryCollection').value;
    if (!collection) {
      alert('Please select a collection');
      return;
    }

    const activeTab = document.querySelector('.query-tab.active').dataset.tab;
    let queryData = {};

    try {
      switch (activeTab) {
        case 'find':
          queryData = {
            collection,
            operation: 'find',
            query: JSON.parse(document.getElementById('findQuery').value || '{}')
          };
          break;
        case 'insert':
          queryData = {
            collection,
            operation: 'insert',
            document: JSON.parse(document.getElementById('insertDocument').value || '{}')
          };
          break;
        case 'update':
          queryData = {
            collection,
            operation: 'update',
            filter: JSON.parse(document.getElementById('updateFilter').value || '{}'),
            update: JSON.parse(document.getElementById('updateDocument').value || '{}')
          };
          break;
        case 'delete':
          queryData = {
            collection,
            operation: 'delete',
            filter: JSON.parse(document.getElementById('deleteFilter').value || '{}')
          };
          break;
      }

      const startTime = Date.now();
      const response = await fetch(`${this.apiBaseUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryData)
      });
      const endTime = Date.now();

      const results = await response.json();
      this.displayQueryResults(results, endTime - startTime);

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Query execution failed:', error);
      this.displayQueryResults({ error: error.message }, 0);
    }
  }

  displayQueryResults(results, executionTime) {
    const resultsDiv = document.getElementById('queryResults');
    const countDiv = document.getElementById('resultsCount');
    const timeDiv = document.getElementById('executionTime');

    if (results.error) {
      // Sanitize error messages to prevent XSS
      const sanitizedError = this.sanitizeText(results.error);
      resultsDiv.textContent = `Error: ${sanitizedError}`;
      resultsDiv.classList.add('error');
    } else {
      // Sanitize JSON output to prevent XSS attacks through data
      const jsonString = JSON.stringify(results, null, 2);
      const sanitizedJson = this.sanitizeText(jsonString);
      resultsDiv.textContent = sanitizedJson;
      resultsDiv.classList.remove('error');

      const count = Array.isArray(results) ? results.length : (results.insertedCount || results.modifiedCount || results.deletedCount || 1);
      countDiv.textContent = `${count} result${count !== 1 ? 's' : ''}`;
    }

    timeDiv.textContent = `${executionTime}ms`;
  }

  // Sanitize text to prevent XSS attacks
  sanitizeText(text) {
    if (typeof text !== 'string') return text;

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  clearQuery() {
    document.getElementById('findQuery').value = '{}';
    document.getElementById('insertDocument').value = '{}';
    document.getElementById('updateFilter').value = '{}';
    document.getElementById('updateDocument').value = '{$set: {}}';
    document.getElementById('deleteFilter').value = '{}';
    document.getElementById('queryResults').textContent = 'Execute a query to see results...';
    document.getElementById('resultsCount').textContent = '0 documents';
    document.getElementById('executionTime').textContent = '0ms';
  }

  async loadSchema() {
    if (!this.connectionStatus) return;

    try {
      const response = await fetch(`${this.apiBaseUrl}/schema`);
      if (response.ok) {
        const schema = await response.json();
        this.renderSchema(schema);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load schema:', error);
    }
  }

  renderSchema(schema) {
    const treeDiv = document.getElementById('schemaTree');
    const detailsDiv = document.getElementById('schemaDetails');

    treeDiv.innerHTML = Object.keys(schema).map(collection => `
      <div class="schema-tree-item" onclick="admin.selectSchema(event, '${collection}')">
        <i class="fas fa-folder"></i> ${collection}
      </div>
    `).join('');

    detailsDiv.innerHTML = `
      <div class="schema-placeholder">
        <i class="fas fa-sitemap"></i>
        <p>Select a collection to view its schema</p>
      </div>
    `;
  }

  selectSchema(event) {
    document.querySelectorAll('.schema-tree-item').forEach(item => item.classList.remove('selected'));
    event.target.closest('.schema-tree-item').classList.add('selected');

    // Mock schema details (replace with actual API call)
    const mockSchema = {
      _id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      email: { type: 'string', required: true },
      age: { type: 'number', required: false },
      createdAt: { type: 'date', required: true }
    };

    const detailsDiv = document.getElementById('schemaDetails');
    detailsDiv.innerHTML = Object.entries(mockSchema).map(([field, info]) => `
      <div class="schema-field">
        <div class="schema-field-name">${field}</div>
        <div class="schema-field-type">${info.type}</div>
        <div class="schema-field-stats">
          Required: ${info.required ? 'Yes' : 'No'}
        </div>
      </div>
    `).join('');
  }

  async loadPerformance() {
    if (!this.connectionStatus) return;

    try {
      const response = await fetch(`${this.apiBaseUrl}/performance`);
      if (response.ok) {
        const performance = await response.json();
        this.updatePerformanceMetrics(performance);
        this.updatePerformanceCharts(performance);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load performance:', error);
    }
  }

  updatePerformanceMetrics(performance) {
    document.getElementById('avgResponseTimeMetric').textContent = `${performance.avgResponseTime || 0}ms`;
    document.getElementById('throughputMetric').textContent = `${performance.throughput || 0} ops/sec`;
    document.getElementById('memoryUsageMetric').textContent = this.formatBytes(performance.memoryUsage || 0);
    document.getElementById('errorRateMetric').textContent = `${performance.errorRate || 0}%`;
  }

  updatePerformanceCharts(performance) {
    // Update chart data (simplified implementation)
    const timeRange = document.getElementById('timeRange').value;
    const dataPoints = timeRange === '1h' ? 60 : timeRange === '15m' ? 15 : timeRange === '5m' ? 5 : 1;

    // Mock data updates - replace with real data
    this.updateChart('responseTimeChart', this.generateTimeSeries(dataPoints, performance.avgResponseTime || 0));
    this.updateChart('throughputChart', this.generateTimeSeries(dataPoints, performance.throughput || 0));
    this.updateChart('memoryUsageChart', this.generateTimeSeries(dataPoints, performance.memoryUsage || 0));
    this.updateChart('errorRateChart', this.generateTimeSeries(dataPoints, performance.errorRate || 0));
  }

  generateTimeSeries(points, baseValue) {
    const data = [];
    for (let i = 0; i < points; i++) {
      data.push({
        x: new Date(Date.now() - (points - i) * 60000),
        y: baseValue + (Math.random() - 0.5) * baseValue * 0.2
      });
    }
    return data;
  }

  updateChart(chartId, data) {
    if (!this.charts[chartId]) {
      const ctx = document.getElementById(chartId).getContext('2d');
      this.charts[chartId] = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [{
            data,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              type: 'time',
              time: { unit: 'minute' },
              display: false
            },
            y: { display: false }
          },
          elements: {
            point: { radius: 0 }
          }
        }
      });
    } else {
      this.charts[chartId].data.datasets[0].data = data;
      this.charts[chartId].update();
    }
  }

  startPerformanceMonitoring() {
    setInterval(() => {
      if (this.connectionStatus && this.currentPage === 'performance') {
        this.loadPerformance();
      }
    }, 5000); // Update every 5 seconds
  }

  async startRedisMigration() {
    const config = {
      host: document.getElementById('redisHost').value,
      port: parseInt(document.getElementById('redisPort').value),
      password: document.getElementById('redisPassword').value || null,
      migrateStrings: document.getElementById('migrateStrings').checked,
      migrateHashes: document.getElementById('migrateHashes').checked,
      migrateLists: document.getElementById('migrateLists').checked,
      migrateSets: document.getElementById('migrateSets').checked,
      migrateZsets: document.getElementById('migrateZsets').checked
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/migration/redis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        this.showMigrationProgress('redis');
        this.monitorMigration('redis');
      } else {
        throw new Error('Failed to start Redis migration');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Redis migration failed:', error);
      alert('Failed to start Redis migration: ' + error.message);
    }
  }

  async startMongoMigration() {
    const config = {
      uri: document.getElementById('mongoUri').value,
      database: document.getElementById('mongoDatabase').value,
      collections: document.getElementById('mongoCollections').value.split('\n').filter(c => c.trim()),
      batchSize: parseInt(document.getElementById('mongoBatchSize').value)
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/migration/mongodb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        this.showMigrationProgress('mongodb');
        this.monitorMigration('mongodb');
      } else {
        throw new Error('Failed to start MongoDB migration');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('MongoDB migration failed:', error);
      alert('Failed to start MongoDB migration: ' + error.message);
    }
  }

  showMigrationProgress() {
    document.getElementById('migrationProgress').style.display = 'block';
    document.getElementById('migrationStatus').textContent = 'Initializing...';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('processedCount').textContent = '0';
    document.getElementById('totalCount').textContent = '0';
    document.getElementById('errorCount').textContent = '0';
    document.getElementById('elapsedTime').textContent = '0s';
    document.getElementById('migrationLog').innerHTML = '';
  }

  async monitorMigration(type) {
    const startTime = Date.now();

    const monitor = async () => {
      try {
        const response = await fetch(`${this.apiBaseUrl}/migration/status/${type}`);
        if (response.ok) {
          const status = await response.json();
          this.updateMigrationProgress(status, Date.now() - startTime);

          if (status.status === 'completed' || status.status === 'failed') {
            return; // Stop monitoring
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Migration monitoring failed:', error);
      }

      setTimeout(monitor, 1000); // Check every second
    };

    monitor();
  }

  updateMigrationProgress(status, elapsed) {
    document.getElementById('migrationStatus').textContent = status.status;
    document.getElementById('progressFill').style.width = `${status.progress || 0}%`;
    document.getElementById('processedCount').textContent = status.processed || 0;
    document.getElementById('totalCount').textContent = status.total || 0;
    document.getElementById('errorCount').textContent = status.errors || 0;
    document.getElementById('elapsedTime').textContent = `${Math.floor(elapsed / 1000)}s`;

    const logDiv = document.getElementById('migrationLog');
    if (status.logs && status.logs.length > 0) {
      logDiv.innerHTML = status.logs.map(log => `
        <div class="log-entry ${log.level}">
          [${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}
        </div>
      `).join('');
      logDiv.scrollTop = logDiv.scrollHeight;
    }
  }

  addActivityLog(icon, message) {
    const activityList = document.getElementById('activityList');
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `
      <div class="activity-icon">
        <i class="fas fa-${icon}"></i>
      </div>
      <div class="activity-content">
        <div class="activity-message">${message}</div>
        <div class="activity-time">Just now</div>
      </div>
    `;

    activityList.insertBefore(activityItem, activityList.firstChild);

    // Keep only last 10 activities
    while (activityList.children.length > 10) {
      activityList.removeChild(activityList.lastChild);
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Performance data cleanup to prevent memory leaks
  startPerformanceDataCleanup() {
    this.performanceDataCleanupInterval = setInterval(() => {
      this.cleanupPerformanceData();
    }, 60000); // Clean up every minute
  }

  cleanupPerformanceData() {
    // Keep only the most recent data points
    Object.keys(this.performanceData).forEach(key => {
      if (this.performanceData[key].length > this.maxPerformanceDataPoints) {
        // Remove oldest 20% of data points
        const removeCount = Math.floor(this.performanceData[key].length * 0.2);
        this.performanceData[key] = this.performanceData[key].slice(-this.maxPerformanceDataPoints + removeCount);
      }
    });
  }

  // Cleanup on page unload
  destroy() {
    if (this.performanceDataCleanupInterval) {
      clearInterval(this.performanceDataCleanupInterval);
      this.performanceDataCleanupInterval = null;
    }

    // Clear charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts = {};
  }
}

// Initialize the admin interface
const admin = new MonarchAdmin();

// Make admin globally available for onclick handlers
window.admin = admin;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  admin.destroy();
});
