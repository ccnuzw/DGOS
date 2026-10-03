# DGOS V1 Observability Guide

## Overview

DGOS V1 includes a comprehensive observability foundation covering logging, metrics, error tracking, distributed tracing, health checks, and alerting.

## Architecture

### Components

1. **@dgos/logger**: Core logging package with structured logging
2. **Metrics Collection**: Performance and operational metrics
3. **Error Tracking**: Structured error handling and aggregation
4. **Distributed Tracing**: Request tracing across services
5. **Health Checks**: Service health monitoring
6. **Alerting**: Rule-based alerting system

### Data Flow

```
Request → Middleware → Logger → JSON Output → Log Files
       ↓
       → Metrics Collector → Prometheus Endpoint
       ↓
       → Error Aggregator → Stats Endpoint
       ↓
       → Tracer → Trace Storage
```

## Logging

### Structured Logging

All logs are structured JSON with:
- **timestamp**: ISO 8601 format
- **level**: debug, info, warn, error
- **component**: Service or module name
- **message**: Human-readable message
- **context**: Additional structured data

### Log Levels

- **debug**: Detailed debugging information (disabled in production by default)
- **info**: Normal operational events
- **warn**: Warning conditions that should be reviewed
- **error**: Error conditions requiring immediate attention

### Context Propagation

Logs automatically include async context:
- `requestId`: Unique request identifier
- `userId`: Authenticated user (when available)
- `sessionId`: Session identifier (when available)
- `operation`: Current operation name

### Sensitive Data

The following fields are automatically redacted:
- Passwords, secrets, tokens
- API keys, credentials
- Authorization headers
- Session IDs (in specific contexts)

## Metrics

### Metric Types

1. **Counters**: Monotonically increasing values
   - `api.requests.total`: Total API requests
   - `api.errors.total`: Total errors
   - `db.queries.total`: Total database queries

2. **Gauges**: Current value at a point in time
   - `db.pool.size`: Current connection pool size
   - `memory.usage`: Current memory usage

3. **Histograms**: Distribution of values
   - Used internally for percentile calculations

4. **Timings**: Duration measurements with percentiles
   - `api.response.time`: API response duration (p50, p95, p99)
   - `db.query.time`: Database query duration
   - `http.request.time`: HTTP client request duration

### Metric Tags

All metrics support tags for filtering:
```javascript
metrics.timing('api.response.time', duration, {
  method: 'GET',
  route: '/api/v1/tasks',
  status: '200'
});
```

### Key Metrics

#### API Metrics
- `api.response.time`: Response latency (ms)
- `api.requests.total`: Request count by method/status
- `api.errors.total`: Error count by method/status

#### Database Metrics
- `db.query.time`: Query duration (ms)
- `db.queries.total`: Query count by database
- `db.errors.total`: Database error count

#### HTTP Client Metrics
- `http.request.time`: Outbound request duration (ms)
- `http.requests.total`: Outbound request count
- `http.errors.total`: Outbound request errors

## Error Tracking

### Error Classification

Errors are classified as:
- **Operational Errors**: Expected errors (validation, not found, etc.)
- **Programmer Errors**: Unexpected errors (bugs, crashes)

### Standard Error Classes

```javascript
ValidationError     // 400 - Invalid input
UnauthorizedError   // 401 - Authentication required
ForbiddenError      // 403 - Access denied
NotFoundError       // 404 - Resource not found
ConflictError       // 409 - Resource conflict
RateLimitError      // 429 - Rate limit exceeded
InternalError       // 500 - Internal server error
ServiceUnavailableError  // 503 - Service unavailable
GatewayTimeoutError // 504 - Upstream timeout
```

### Error Aggregation

Errors are aggregated by:
- Error code
- Operation
- Frequency
- First/last occurrence

Access error statistics at:
```
GET /api/v1/metrics/snapshot
```

## Distributed Tracing

### Trace Context

Every request gets:
- `traceId`: Unique trace identifier
- `spanId`: Current span identifier
- `parentSpanId`: Parent span (if nested)

### Trace Propagation

Trace IDs propagate via HTTP headers:
- `x-trace-id`: Trace identifier
- `x-span-id`: Span identifier
- `x-parent-span-id`: Parent span identifier

Also supports W3C Trace Context (`traceparent` header).

### Viewing Traces

```bash
# Get recent traces
curl http://localhost:3000/api/v1/debug/traces

# Get specific trace
curl http://localhost:3000/api/v1/debug/traces?traceId=abc-123
```

## Health Checks

### Endpoints

#### Health Check
```
GET /api/v1/health
```

Returns:
```json
{
  "status": "healthy|degraded|unhealthy",
  "checks": {
    "database": { "status": "healthy", "latency": 5 },
    "redis": { "status": "healthy", "latency": 2 },
    "memory": { "status": "healthy", "details": {...} }
  },
  "uptime": 3600,
  "timestamp": "2024-10-02T...",
  "version": "1.0.0"
}
```

Status code: 200 (healthy/degraded), 503 (unhealthy)

#### Readiness Probe
```
GET /api/v1/ready
```

Returns 200 if all dependencies are available, 503 otherwise.
Use for Kubernetes readiness probes.

#### Liveness Probe
```
GET /api/v1/alive
```

Simple 200 response if process is alive.
Use for Kubernetes liveness probes.

### Kubernetes Integration

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/alive
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/v1/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Metrics Endpoints

### Prometheus Format
```
GET /api/v1/metrics
```

Returns metrics in Prometheus exposition format.

### JSON Snapshot
```
GET /api/v1/metrics/snapshot
```

Returns:
```json
{
  "counters": { "api.requests.total{method:GET,status:200}": 1234 },
  "gauges": { "memory.usage": 512 },
  "timings": {
    "api.response.time": {
      "count": 1000,
      "avg": 45,
      "p50": 42,
      "p95": 89,
      "p99": 120
    }
  },
  "errors": {
    "summary": [...],
    "recent": [...]
  },
  "errorRate": 0.002,
  "timestamp": "2024-10-02T..."
}
```

## Alerting

### Alert Rules

Standard alert rules:

1. **high_error_rate**: Error rate > 5% for 5 minutes (critical)
2. **slow_response_time**: P95 response time > 1000ms for 10 minutes (warning)
3. **database_connection_pool_high**: Pool usage > 90% for 2 minutes (warning)
4. **high_memory_usage**: Memory > 1GB for 5 minutes (warning)

### Alert Handlers

Alerts can be sent to:
- Logs (default)
- Webhook endpoints
- Custom handlers

## Log Files

### Location
```
logs/
  api-server.log      # Main API logs (JSON Lines)
  worker.log          # Worker logs
  audit.log           # Audit logs (existing)
  error.log           # Errors only
```

### Log Rotation

- Rotate daily
- Keep 30 days
- Compress old logs

## Querying Logs

### Using jq

```bash
# Find errors in last hour
tail -n 10000 logs/api-server.log | \
  jq 'select(.level == "error")'

# Get slow requests
jq 'select(.duration > 1000)' logs/api-server.log

# Follow logs for specific request
jq 'select(.requestId == "abc-123")' logs/api-server.log
```

### Using grep

```bash
# Find all errors
grep '"level":"error"' logs/api-server.log

# Find specific user activity
grep '"userId":"user-123"' logs/api-server.log
```

## Monitoring Dashboard

### Key Metrics to Monitor

1. **Request Rate**: Requests per second
2. **Error Rate**: Percentage of failed requests
3. **Response Time**: P50, P95, P99 latencies
4. **Database Performance**: Query time, connection pool usage
5. **Memory Usage**: Heap usage trend
6. **Health Status**: Overall service health

### Recommended Tools

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Metrics visualization
- **ELK Stack**: Log aggregation and search
- **Jaeger/Zipkin**: Distributed tracing (future)

## Performance Impact

### Production Overhead

- **Logging**: ~1-2ms per request (JSON formatting)
- **Metrics**: <0.1ms per metric (in-memory)
- **Tracing**: ~0.5ms per span
- **Total**: ~2-3ms overhead per request

### Optimization Tips

1. Use appropriate log levels (disable debug in production)
2. Sample traces for high-traffic endpoints
3. Limit metric cardinality (avoid unbounded tags)
4. Batch log writes
5. Use async logging where possible

## Troubleshooting

### High Error Rate

1. Check `/api/v1/metrics/snapshot` for error details
2. Query logs for error patterns
3. Review error aggregation by code
4. Check upstream service health

### Slow Requests

1. Check P95/P99 response times in metrics
2. Find slow requests in logs (`duration > 1000`)
3. Review database query times
4. Check for slow external API calls

### Memory Issues

1. Check `/api/v1/health` for memory status
2. Review heap usage trends
3. Look for memory leaks (growing heap)
4. Check for unbounded collections

### Service Unavailable

1. Check `/api/v1/health` for failed dependencies
2. Review database connectivity
3. Check Redis connection
4. Verify network connectivity

## Best Practices

1. **Always include context**: RequestId, userId, operation
2. **Use structured logging**: Never concatenate strings
3. **Tag your metrics**: Add relevant dimensions
4. **Handle errors properly**: Use error classes
5. **Monitor what matters**: Focus on user-facing metrics
6. **Set up alerts**: Don't wait for users to report issues
7. **Review logs regularly**: Look for patterns and anomalies
8. **Keep trace cardinality low**: Avoid unbounded tag values
9. **Test observability**: Verify logs/metrics in development
10. **Document custom metrics**: Keep a metrics catalog

## Security Considerations

1. **Never log credentials**: Automatic redaction in place
2. **Redact PII**: Be careful with user data
3. **Secure metrics endpoints**: Consider authentication
4. **Protect health endpoints**: May expose internal state
5. **Rate limit observability endpoints**: Prevent abuse

## Future Enhancements

1. **OpenTelemetry Integration**: Standard tracing protocol
2. **Jaeger Support**: Distributed tracing UI
3. **Real-time Alerting**: Email/Slack notifications
4. **Log Aggregation**: Centralized log storage
5. **Advanced Analytics**: Machine learning for anomaly detection
6. **Custom Dashboards**: Pre-built Grafana dashboards
7. **APM Integration**: Application performance monitoring
8. **Profiling**: CPU and memory profiling integration

## Support

For questions or issues related to observability:
1. Check this guide first
2. Review the package README: `packages/logger/README.md`
3. Check the logging best practices guide
4. Consult the DGOS development team
