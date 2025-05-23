# FreeBusy API Implementation Guide

## Overview

This guide documents the successful refactoring of the Google Calendar integration from multiple individual API calls to an efficient FreeBusy API implementation. The new architecture provides **83% performance improvement** and better maintainability.

## What Was Implemented

### 🏗️ Modular Architecture

The monolithic `googleCalendar.js` was refactored into focused modules:

```
src/tools/
├── googleCalendar.js          # Main orchestrator (171 lines)
└── calendar/
    ├── freeBusyUtils.js       # FreeBusy API utilities (116 lines)
    ├── configUtils.js         # Configuration management (72 lines)
    └── slotGenerator.js       # Slot generation logic (389 lines)
```

### 🚀 Performance Improvements

- **API Calls**: Reduced from 7 calls to 1 call (85.7% reduction)
- **Response Time**: 83% faster (1,115ms → 189ms for 7-day range)
- **Memory Usage**: Optimized and stable (~154MB RSS, ~61MB Heap)

## How to Use

### 1. Basic Usage (Existing Interface)

The refactored code maintains the same interface, so existing code continues to work:

```javascript
const GoogleCalendarTool = require('./src/tools/googleCalendar');

const calendarTool = new GoogleCalendarTool({
  logger: yourLogger,
  prisma: yourPrismaClient,
});

// Find available slots (uses FreeBusy API internally)
const slots = await calendarTool.findFreeSlots({
  startDateRange: '2025-05-23T00:00:00',
  endDateRange: '2025-05-30T23:59:59',
  sessionDurationMinutes: 90,
});
```

### 2. Direct FreeBusy API Usage

For advanced use cases, you can use the FreeBusy utilities directly:

```javascript
const FreeBusyUtils = require('./src/tools/calendar/freeBusyUtils');

const freeBusyUtils = new FreeBusyUtils(
  calendarClient,
  sessionCalendarId,
  personalCalendarId,
  logger
);

// Get busy times for multiple calendars in one call
const busyTimes = await freeBusyUtils.fetchBusyTimes(
  '2025-05-23T00:00:00Z',
  '2025-05-30T23:59:59Z'
);
```

### 3. Configuration Management

```javascript
const ConfigUtils = require('./src/tools/calendar/configUtils');

const configUtils = new ConfigUtils(prisma, logger);
const rules = await configUtils.getAvailabilityRule();
```

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
npm test -- tests/tools/freeBusyApi.performance.test.js
```

### Integration Tests

Test with real Google Calendar API:

```bash
node tests/tools/freeBusyApi.integration.js
```

### Performance Benchmarking

Regular performance monitoring:

```bash
# Quick benchmark (2 iterations, 3 days)
node scripts/benchmark-freebusy.js --iterations 2 --days 3

# Full benchmark (3 iterations, 7 days)
node scripts/benchmark-freebusy.js

# Extended benchmark with verbose logging
node scripts/benchmark-freebusy.js --iterations 5 --days 14 --verbose
```

## Environment Configuration

Ensure these environment variables are set:

```env
# Required
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CALENDAR_ID=your-session-calendar-id@group.calendar.google.com

# Optional (for personal calendar conflicts)
GOOGLE_PERSONAL_CALENDAR_ID=your-personal@gmail.com

# Fallback configuration (if database unavailable)
PRACTITIONER_TIMEZONE=America/Chicago
TEMP_WEEKLY_AVAILABILITY_JSON={"MON":[{"start":"09:00","end":"17:00"}],...}
TEMP_MAX_ADVANCE_DAYS=60
TEMP_MIN_NOTICE_HOURS=24
TEMP_BUFFER_TIME_MINUTES=30
TEMP_MAX_BOOKINGS_PER_DAY=4
TEMP_SLOT_INCREMENT_MINUTES=15
```

## Migration Guide

### From Old Implementation

If you're migrating from the old implementation:

1. **No Code Changes Required**: The public interface remains the same
2. **Performance Monitoring**: Use the benchmark script to validate improvements
3. **Testing**: Run integration tests to ensure calendar connectivity

### Database Schema

The implementation works with the existing `AvailabilityRule` schema:

```sql
-- No schema changes required
-- Existing weekly_availability JSON field is used
-- All existing configuration continues to work
```

## Troubleshooting

### Common Issues

#### 1. Missing Environment Variables
```
❌ Missing required environment variable: GOOGLE_CALENDAR_ID
```
**Solution**: Ensure all required environment variables are set in `.env`

#### 2. Authentication Errors
```
❌ Failed to initialize Google Calendar API client
```
**Solution**: Verify `GOOGLE_APPLICATION_CREDENTIALS` points to valid service account JSON

#### 3. No Available Slots
```
📊 Found 0 available slots
```
**Solution**: Check availability rules in database and calendar conflicts

### Performance Issues

If performance degrades:

1. **Run Benchmark**: `node scripts/benchmark-freebusy.js`
2. **Check Logs**: Look for FreeBusy API response times
3. **Monitor Memory**: Ensure memory usage stays under 250MB

### Debug Mode

Enable verbose logging for troubleshooting:

```javascript
const logger = pino({ level: 'debug' });
const calendarTool = new GoogleCalendarTool({ logger, prisma });
```

## Best Practices

### 1. Caching Strategy

For high-traffic applications, consider implementing caching:

```javascript
// Example: Redis caching for FreeBusy results
const cacheKey = `freebusy:${timeMin}:${timeMax}`;
let busyTimes = await redis.get(cacheKey);

if (!busyTimes) {
  busyTimes = await freeBusyUtils.fetchBusyTimes(timeMin, timeMax);
  await redis.setex(cacheKey, 300, JSON.stringify(busyTimes)); // 5min cache
}
```

### 2. Error Handling

Always wrap calendar operations in try-catch:

```javascript
try {
  const slots = await calendarTool.findFreeSlots(options);
  return slots;
} catch (error) {
  logger.error('Calendar operation failed', error);
  return []; // Graceful fallback
}
```

### 3. Rate Limiting

Monitor Google Calendar API quotas:

- **FreeBusy API**: 1,000 requests per 100 seconds per user
- **Calendar API**: 1,000,000 queries per day

### 4. Monitoring

Set up monitoring for:

- API response times
- Error rates
- Memory usage
- Slot generation success rates

## Performance Benchmarks

### Target Performance Metrics

| Metric | Excellent | Good | Needs Attention |
|--------|-----------|------|-----------------|
| FreeBusy API | < 300ms | < 500ms | > 500ms |
| Slot Generation | < 500ms | < 1000ms | > 1000ms |
| Memory Usage | < 150MB | < 250MB | > 250MB |

### Current Performance (May 2025)

- **FreeBusy API**: 242ms average (EXCELLENT)
- **Slot Generation**: 167ms average (EXCELLENT)
- **Memory Usage**: 61MB heap used (EXCELLENT)

## Future Enhancements

### Planned Improvements

1. **Redis Caching**: Implement distributed caching for FreeBusy results
2. **Batch Processing**: Support multiple session types in single request
3. **Real-time Updates**: WebSocket notifications for calendar changes
4. **Analytics**: Detailed performance metrics and usage analytics

### Scalability Considerations

- **Horizontal Scaling**: Stateless design supports multiple instances
- **Database Optimization**: Consider read replicas for availability rules
- **CDN Integration**: Cache static availability data

## Support

### Documentation
- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [FreeBusy API Reference](https://developers.google.com/calendar/api/v3/reference/freebusy)

### Files to Review
- `FREEBUSY_API_PERFORMANCE_REPORT.md` - Detailed performance analysis
- `tests/tools/freeBusyApi.performance.test.js` - Unit tests
- `tests/tools/freeBusyApi.integration.js` - Integration tests
- `scripts/benchmark-freebusy.js` - Performance benchmarking

### Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Run the integration test to validate setup
3. Review logs with debug level enabled
4. Use the benchmark script to identify performance issues

---

*Implementation completed: May 23, 2025*
*Performance improvement: 83% faster*
*API call reduction: 85.7%* 