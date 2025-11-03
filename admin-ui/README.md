# Monarch Database Admin UI

A modern, web-based graphical interface for managing and monitoring Monarch Database.

## Features

- **Dashboard**: Real-time metrics and performance monitoring
- **Collection Browser**: Explore and manage database collections
- **Query Interface**: Visual query builder with syntax highlighting
- **Schema Explorer**: Analyze data schemas and field statistics
- **Performance Monitor**: Live charts and system metrics
- **Migration Tools**: Built-in Redis and MongoDB migration wizards

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the Admin UI server:**
   ```bash
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3001`

## Requirements

- **Monarch Database HTTP Server**: Running at `http://localhost:3000` (default)
- **Node.js**: Version 16 or higher
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3001)
- `MONARCH_API_URL`: Monarch Database API URL (default: http://localhost:3000)

### Starting with Custom Configuration

```bash
# Custom port
PORT=8080 npm start

# Custom Monarch API URL
MONARCH_API_URL=http://localhost:4000 npm start

# Both
PORT=8080 MONARCH_API_URL=http://monarch.example.com npm start
```

## Usage

### Dashboard
- View real-time database statistics
- Monitor performance metrics
- See recent activity and system health

### Collections
- Browse all collections in your database
- View collection statistics and metadata
- Create new collections

### Query Interface
- Build queries using the visual interface
- Execute MongoDB-style queries
- View results with syntax highlighting
- Save and reuse common queries

### Schema Explorer
- Analyze collection schemas
- View field types and statistics
- Understand data distribution

### Performance Monitor
- Real-time performance charts
- Response time analysis
- Memory usage tracking
- Error rate monitoring

### Migration Tools
- Import data from Redis databases
- Import data from MongoDB collections
- Progress tracking and error reporting
- Data transformation during import

## Development

### Development Mode

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Static File Serving

For production deployment, you can serve the static files directly:

```bash
npm run serve
```

## Architecture

The Admin UI consists of:

- **Frontend**: Vanilla JavaScript with modern CSS
- **Backend**: Express.js server with API proxy
- **Charts**: Chart.js for data visualization
- **Icons**: Font Awesome icon library

## API Integration

The Admin UI communicates with Monarch Database through its HTTP API:

- `/api/health` - Health check
- `/api/stats` - Database statistics
- `/api/collections` - Collection management
- `/api/query` - Query execution
- `/api/migration/*` - Migration operations

## Security

- All API calls are proxied through the Express server
- CORS is enabled for development
- No sensitive data is stored in the browser
- Authentication can be added via Monarch Database middleware

## Troubleshooting

### Connection Issues

If you can't connect to Monarch Database:

1. Ensure Monarch HTTP server is running
2. Check the `MONARCH_API_URL` environment variable
3. Verify CORS settings if accessing from different domain
4. Check browser console for network errors

### Performance Issues

- The UI is optimized for modern browsers
- Large datasets may impact browser performance
- Consider pagination for very large result sets
- Use the CLI for bulk operations

## Contributing

Contributions are welcome! Please see the main project [Contributing Guide](../CONTRIBUTING.md).

## License

MIT License - see [LICENSE](../LICENSE) file for details.
