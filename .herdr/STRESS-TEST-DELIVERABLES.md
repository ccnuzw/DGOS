# V1 Stress Test - Deliverables

## All Files Created

### Test Scripts
1. **`scripts/v1-stress-test.mjs`** (610 lines)
   - Main stress test executor
   - 8-stage load profile (warmup → recovery)
   - Realistic workload mix (30% AI tasks, 15% settings, 20% status checks)
   - Resource monitoring (API/worker memory, DB connections)
   - Data integrity validation (no duplicates, consistent state)
   - Automatic cleanup (database, Redis, temp files)

2. **`scripts/v1-stress-failure-scenarios.mjs`** (365 lines)
   - Database connection loss & recovery
   - Redis connection stress testing
   - Provider timeout handling
   - Concurrent write conflict detection
   - Memory pressure simulation
   - Graceful shutdown validation

### Configuration
3. **`.herdr/v1-stress-profile.json`**
   - Load stage definitions
   - Workload mix ratios
   - Performance targets
   - Resource limits

### Documentation
4. **`.herdr/V1-STRESS-TEST-COMPLETE.md`** (16KB, comprehensive)
   - Executive summary
   - Critical paths identified
   - Test design and methodology
   - Execution instructions
   - Metrics explanation
   - Success criteria
   - Comparison to baseline
   - CI/CD integration guide

5. **`.herdr/STRESS-TEST-QUICK-START.md`** (3.2KB, reference)
   - Quick command reference
   - Troubleshooting guide
   - Key metrics queries
   - Common issues

6. **`.herdr/STRESS-TEST-EXECUTION-SUMMARY.txt`**
   - Plain text summary
   - File inventory
   - Test coverage matrix
   - Execution commands
   - Status checklist

## Test Capabilities

### Load Testing
- **Duration:** 900 seconds (15 minutes)
- **Concurrency:** 10 → 100 users (8 stages)
- **Workload:** 500 AI task submissions
- **Operations:** 7 operation types in realistic mix
- **Sampling:** 500ms resource monitoring intervals

### Metrics Collected
- Throughput (req/sec overall and per-stage)
- Latency (min, p50, p95, p99, max, avg per operation)
- Error rates (4xx, 5xx, timeouts, expected rejections)
- Resources (API/worker RSS, DB connections, commits, queue depth)
- Task terminal latency (submission → completion)
- Data integrity (anomaly detection, duplicate checks)

### Failure Scenarios
1. Database connection pool exhaustion
2. Redis rapid operations (50 concurrent)
3. Provider latency (5s timeout simulation)
4. Optimistic locking conflicts (5 concurrent updates)
5. Memory growth tracking (30 rapid submissions)
6. Graceful shutdown with in-flight requests

### Validation
- No duplicate usage events
- No negative usage amounts
- Task state consistency (1 attempt = 1 artifact = 1 usage)
- Upstream calls match submissions
- All tasks reach terminal state
- Error rates within tolerance

## Execution Requirements

### Services
- PostgreSQL 14+ on localhost:5432
- Redis 6+ on localhost:6379
- Database user 'dgos' with superuser privileges
- Separate Redis DB 9 for stress tests

### Environment Variables
```bash
DGOS_STRESS_STARTUP_READY=1
DGOS_STRESS_ADMIN_URL="postgresql://dgos:PASSWORD@127.0.0.1:5432/postgres"
DGOS_STRESS_REDIS_URL="redis://127.0.0.1:6379/9"
DGOS_STRESS_API_PORT=15113
DGOS_STRESS_FIXTURE_PORT=15114
```

### Execution Time
- Full stress test: ~15 minutes
- Failure scenarios: ~5 minutes
- Quick baseline: ~45 seconds

## Output Files

### Generated During Execution
- `.herdr/V1-STRESS-TEST-r1-<timestamp>-manifest.json`
  - Full results with all metrics
  - 1800+ resource samples
  - Per-stage breakdowns
  - Invariant checks
  
- `.herdr/V1-FAILURE-SCENARIOS-<timestamp>-manifest.json`
  - Scenario results
  - Event logs
  - Status outcomes

## Success Criteria

### Must Pass
✓ Exit code 0  
✓ Status: "PASSED"  
✓ Throughput ≥100 req/sec  
✓ Error rate ≤0.1%  
✓ No data integrity anomalies  
✓ All stages complete  

### Should Monitor
- Latency p95 ≤500ms (target)
- Latency p99 ≤2000ms (target)
- API memory growth reasonable
- Worker memory growth reasonable
- DB connection count within limits
- All failure scenarios handled gracefully

## Integration

### CI/CD Pipeline
Add to GitHub Actions, GitLab CI, or similar:
```yaml
- name: V1 Stress Test
  run: node scripts/v1-stress-test.mjs
  env:
    DGOS_STRESS_STARTUP_READY: 1
    DGOS_STRESS_ADMIN_URL: ${{ secrets.TEST_DB_URL }}
    DGOS_STRESS_REDIS_URL: ${{ secrets.TEST_REDIS_URL }}
```

### Regression Tracking
- Archive manifests for trend analysis
- Compare throughput/latency over time
- Alert on performance degradation
- Track resource usage growth

## Comparison to Baseline

| Metric | Existing (r6) | New (Stress) | Improvement |
|--------|---------------|--------------|-------------|
| Duration | 10s | 900s | 90x |
| Concurrency | 8 | 100 | 12.5x |
| Submissions | 16 | 500 | 31x |
| Failure Tests | 0 | 6 | New |
| Realistic Load | No | Yes | Production |

## Next Steps

1. ✓ Infrastructure created
2. ✓ Documentation complete
3. ⚠️ Start PostgreSQL & Redis
4. ⚠️ Execute tests
5. ⚠️ Analyze results
6. ⚠️ Document breaking points
7. ⚠️ Add to CI/CD
8. ⚠️ Set up monitoring

---

**Status:** Infrastructure complete. Ready for execution when database services are available.

**Contact:** See V1-STRESS-TEST-COMPLETE.md for detailed documentation.
