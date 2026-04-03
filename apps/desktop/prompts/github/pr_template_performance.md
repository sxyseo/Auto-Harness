# Performance Review Checklist Template

<!--
This template provides a structured performance review framework for pull requests.
Complete each section based on the code changes in this PR.
-->

## Performance Review Summary

**PR Title:** <!-- PR title -->
**Reviewer:** <!-- Your name/handle -->
**Review Date:** <!-- YYYY-MM-DD -->
**Review Type:** <!-- Initial / Follow-up / Re-review -->

### Change Classification

- [ ] Bug fix (optimizing existing performance)
- [ ] New feature (new performance-critical code path)
- [ ] Refactor (restructuring for performance)
- [ ] Dependency update (potential performance impact)
- [ ] Configuration change (performance-sensitive setting change)
- [ ] Database change (query, schema, or indexing changes)
- [ ] API change (endpoint behavior modification)

## Performance Focus Areas

### 1. Algorithm Complexity

<!-- Check for algorithmic efficiency and complexity concerns -->

- [ ] No nested loops with unknown iteration counts
- [ ] Database queries use appropriate indexes
- [ ] No O(n²) or worse patterns where O(n) is achievable
- [ ] Sorting/filtering operations use efficient algorithms
- [ ] Hash lookups used instead of linear searches where appropriate
- [ ] Recursive functions have proper termination and memoization

**Notes:**
<!-- Document any algorithmic concerns or confirm efficient implementation -->

### 2. Database Performance

<!-- Check for database query efficiency -->

- [ ] Queries use SELECT only required columns (no SELECT *)
- [ ] WHERE clauses use indexed columns
- [ ] JOINs are necessary and use proper indexes
- [ ] No N+1 query patterns (use batch queries or eager loading)
- [ ] Large result sets are paginated
- [ ] Batch operations used for bulk inserts/updates
- [ ] EXPLAIN plans reviewed for new queries
- [ ] Query timeouts configured for long-running queries

**Notes:**
<!-- Document any database performance concerns -->

### 3. Memory Usage

<!-- Check for memory efficiency and leak prevention -->

- [ ] Large objects not retained in memory unnecessarily
- [ ] Streaming/chunking used for large data processing
- [ ] No memory leaks (event listeners removed, caches bounded)
- [ ] Weak references used for caches where appropriate
- [ ] String concatenation avoided in loops (use StringBuilder/join)
- [ ] No unnecessary object creation in hot paths
- [ ] Resource cleanup (file handles, connections) properly handled

**Notes:**
<!-- Document any memory usage concerns -->

### 4. Network Efficiency

<!-- Check for network request optimization -->

- [ ] Batch API calls instead of individual requests
- [ ] Caching implemented for frequently accessed data
- [ ] Compression enabled for large payloads
- [ ] Request deduplication in place
- [ ] Connection pooling configured
- [ ] Appropriate timeout values set
- [ ] Retry logic with exponential backoff for resilience

**Notes:**
<!-- Document any network efficiency concerns -->

### 5. Caching Strategy

<!-- Check for appropriate caching implementation -->

- [ ] Cache invalidation strategy is correct
- [ ] Cache TTL values are appropriate
- [ ] Hot data is cached, cold data is not
- [ ] Cache stampede prevention in place
- [ ] Distributed cache consistency considered
- [ ] Memory limits configured for local caches

**Notes:**
<!-- Document any caching concerns -->

### 6. Concurrency & Async Performance

<!-- Check for efficient concurrent operations -->

- [ ] Async/await used correctly (no blocking in async code)
- [ ] Parallel operations use Promise.all/await when independent
- [ ] Worker threads/processes for CPU-intensive tasks
- [ ] No race conditions in shared state
- [ ] Connection/session limits respected
- [ ] Thread pool sizes appropriately configured

**Notes:**
<!-- Document any concurrency concerns -->

### 7. Frontend Performance

<!-- Check for frontend-specific optimizations (if applicable) -->

- [ ] Bundle size impact assessed
- [ ] Code splitting implemented for large features
- [ ] Tree shaking working correctly
- [ ] Images optimized (compression, lazy loading)
- [ ] Critical CSS inlined, non-critical deferred
- [ ] Virtual scrolling for long lists
- [ ] Memoization used for expensive computations
- [ ] Debouncing/throttling for frequent events

**Notes:**
<!-- Document any frontend performance concerns -->

### 8. Resource Efficiency

<!-- Check for efficient resource utilization -->

- [ ] File I/O buffered appropriately
- [ ] CSV/JSON parsing uses streaming for large files
- [ ] Image/video processing uses appropriate libraries
- [ ] No blocking operations on main thread
- [ ] GPU acceleration used where beneficial
- [ ] CPU-intensive work offloaded to background tasks

**Notes:**
<!-- Document any resource efficiency concerns -->

### 9. Scalability Considerations

<!-- Check for scalability concerns -->

- [ ] Horizontal scaling not blocked by local state
- [ ] Stateless design for API services
- [ ] Database connections pooled
- [ ] Rate limiting implemented for resource protection
- [ ] Load testing performed for new endpoints
- [ ] No hardcoded limits that would constrain scaling

**Notes:**
<!-- Document any scalability concerns -->

### 10. Benchmarking & Profiling

<!-- Check for performance measurement -->

- [ ] Performance-critical code has benchmarks
- [ ] New queries profiled against realistic data volumes
- [ ] Load testing results documented
- [ ] Performance regression tests in place
- [ ] Critical path monitoring configured

**Notes:**
<!-- Document any benchmarking/profiling concerns -->

## Performance Review Findings

### Critical Issues (Blocks Merge)
<!-- Document any critical performance issues that must be fixed -->

| Issue | File | Line | Impact | Suggested Fix |
|-------|------|------|--------|---------------|
|      |      |      |        |               |

### High Severity Issues (Blocks Merge)
<!-- Document any high-severity performance issues that should be fixed -->

| Issue | File | Line | Impact | Suggested Fix |
|-------|------|------|--------|---------------|
|      |      |      |        |               |

### Medium Severity Issues (Recommended)
<!-- Document any medium-severity performance improvements -->

| Issue | File | Line | Impact | Suggested Fix |
|-------|------|------|--------|---------------|
|      |      |      |        |               |

### Low Severity Suggestions (Optional)
<!-- Document any low-severity performance suggestions -->

| Issue | File | Line | Impact | Suggested Fix |
|-------|------|------|--------|---------------|
|      |      |      |        |               |

## Performance Metrics

### Before vs After (if benchmarks available)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Response Time (p50) | <!-- ms --> | <!-- ms --> | <!-- % --> |
| Response Time (p99) | <!-- ms --> | <!-- ms --> | <!-- % --> |
| Throughput (req/s) | <!-- --> | <!-- --> | <!-- % --> |
| Memory Usage | <!-- MB --> | <!-- MB --> | <!-- % --> |
| CPU Usage | <!-- % --> | <!-- % --> | <!-- % --> |

### Target Thresholds

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| API Response Time (p99) | <!-- ms --> | <!-- ms --> | [ ] Met [ ] Not Met |
| Batch Job Duration | <!-- ms --> | <!-- ms --> | [ ] Met [ ] Not Met |
| Memory Footprint | <!-- MB --> | <!-- MB --> | [ ] Met [ ] Not Met |
| Bundle Size | <!-- KB --> | <!-- KB --> | [ ] Met [ ] Not Met |

## Performance Review Sign-Off

### Approvals

| Role | Reviewer | Date | Status |
|------|----------|------|--------|
| Performance Review | <!-- Name --> | <!-- Date --> | [ ] Approved [ ] Changes Requested |
| Code Owner | <!-- Name --> | <!-- Date --> | [ ] Approved [ ] Changes Requested |

### Conditions for Approval

- [ ] No critical performance issues found
- [ ] No high-severity performance issues found
- [ ] Performance impact assessed and documented
- [ ] Benchmarks meet established thresholds
- [ ] Performance review checklist is complete

### Performance Budget

<!-- Document acceptable performance budgets for this PR -->

| Resource | Budget | Actual | Buffer |
|----------|--------|--------|--------|
| Bundle Size (JS) | <!-- KB --> | <!-- KB --> | <!-- % --> |
| API Latency (p99) | <!-- ms --> | <!-- ms --> | <!-- % --> |
| Memory Delta | <!-- MB --> | <!-- MB --> | <!-- % --> |
| Query Time | <!-- ms --> | <!-- ms --> | <!-- % --> |

---

## Performance Best Practices Reminder

When conducting performance reviews, ensure:

1. **Measure, don't guess** - Profile actual code paths, don't assume performance issues
2. **Consider scale** - What works for 100 users may fail at 100,000
3. **Hot paths matter most** - Focus optimization on frequently executed code
4. **Trade-offs are intentional** - Performance vs readability should be documented
5. **Caching appropriately** - Cache intelligently with proper invalidation
6. **Database efficiency** - Queries are often the biggest performance bottleneck
7. **Async when possible** - Non-blocking operations improve throughput

## References

- [Google Web Vitals](https://web.dev/vitals/)
- [Lighthouse Performance Scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)
- [Database Performance Tuning](https://use-the-index-luke.com/)
- [Node.js Performance Best Practices](https://nodejs.org/en/guides/performance-prof/)
- [Python Performance Tips](https://wiki.python.org/moin/PythonSpeed/PerformanceTips)

---

*This template should be used for all performance-sensitive code changes.*
