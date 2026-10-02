# V1 Stress Test - Quick Start Guide

## Prerequisites Check

```bash
# Check PostgreSQL
pg_isready -h 127.0.0.1 -p 5432

# Check Redis
redis-cli -h 127.0.0.1 -p 6379 ping

# Verify dgos user
psql -U dgos -h 127.0.0.1 -d postgres -c "SELECT current_user"
```

## Execute Full Stress Test (15 minutes)

```bash
# Set environment
export DGOS_STRESS_STARTUP_READY=1
export DGOS_STRESS_ADMIN_URL="postgresql://dgos:PASSWORD@127.0.0.1:5432/postgres"
export DGOS_STRESS_REDIS_URL="redis://127.0.0.1:6379/9"
export DGOS_STRESS_API_PORT=15113
export DGOS_STRESS_FIXTURE_PORT=15114

# Run stress test
node scripts/v1-stress-test.mjs

# Check results
cat .herdr/V1-STRESS-TEST-r1-*-manifest.json | jq '.status, .metrics.throughput, .metrics.errors'
```

## Execute Failure Scenarios (5 minutes)

```bash
# Same environment variables
node scripts/v1-stress-failure-scenarios.mjs

# Check results
cat .herdr/V1-FAILURE-SCENARIOS-*-manifest.json | jq '.scenarios[] | {name, status}'
```

## Execute Quick Baseline Test (45 seconds)

```bash
# Set environment
export DGOS_PERF_STARTUP_READY=1
export DGOS_PERF_ADMIN_URL="postgresql://dgos:PASSWORD@127.0.0.1:5432/postgres"
export DGOS_PERF_REDIS_URL="redis://127.0.0.1:6379/8"

# Run baseline
node scripts/v1-performance.mjs

# Check results
cat .herdr/V1-PERFORMANCE-r6-*-manifest.json | jq '.exit_code, .stages[].throughput_rps'
```

## Key Metrics to Check

```bash
# Overall status
jq '.status, .exit_code, .duration_seconds' .herdr/V1-STRESS-TEST-r1-*-manifest.json

# Throughput
jq '.metrics.throughput' .herdr/V1-STRESS-TEST-r1-*-manifest.json

# Error rate
jq '.metrics.errors' .herdr/V1-STRESS-TEST-r1-*-manifest.json

# Resource usage
jq '.metrics.resources' .herdr/V1-STRESS-TEST-r1-*-manifest.json

# Data integrity
jq '.invariants' .herdr/V1-STRESS-TEST-r1-*-manifest.json

# Per-stage performance
jq '.stages[] | {name, throughput_rps, error_rate_percent}' .herdr/V1-STRESS-TEST-r1-*-manifest.json
```

## Troubleshooting

### Error: "PostgreSQL not ready"
```bash
# Start PostgreSQL
brew services start postgresql@14
# or
sudo systemctl start postgresql
```

### Error: "Redis not ready"
```bash
# Start Redis
brew services start redis
# or
sudo systemctl start redis
```

### Error: "permission denied for database"
```bash
# Grant superuser to dgos
psql -U postgres -c "ALTER USER dgos WITH SUPERUSER"
```

### Port conflicts
```bash
# Check if ports are in use
lsof -i :15113
lsof -i :15114

# Change ports if needed
export DGOS_STRESS_API_PORT=15115
export DGOS_STRESS_FIXTURE_PORT=15116
```

## Success Criteria

- ✓ Exit code: 0
- ✓ Status: "PASSED"
- ✓ Throughput: ≥100 req/sec
- ✓ Error rate: ≤0.1%
- ✓ No anomalies in invariants
- ✓ All stages completed
- ✓ Memory growth: reasonable
- ✓ DB connections: within limits

## Files Created

- `scripts/v1-stress-test.mjs` - Main stress test
- `scripts/v1-stress-failure-scenarios.mjs` - Failure scenarios
- `.herdr/v1-stress-profile.json` - Test configuration
- `.herdr/V1-STRESS-TEST-COMPLETE.md` - Full documentation

## Next Steps After Successful Execution

1. Archive results for regression tracking
2. Add to CI/CD pipeline
3. Set up monitoring for production metrics
4. Document breaking points discovered
5. Create runbook for common failure modes
