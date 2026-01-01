# Chat History Storage Strategy

## Current State
- **Storage**: In-memory only (React state)
- **Persistence**: None - messages lost on page refresh
- **Cost**: $0 (no Firestore storage)
- **Service Available**: `messageService` exists but not used

## Storage Analysis

### Per Message Size
- Text content: ~100-300 bytes
- Metadata (type, isAnalysis, timestamps): ~100-200 bytes
- **Total per message**: ~200-500 bytes

### Storage Projections
| Messages | Storage Size | Monthly Cost* | Notes |
|----------|-------------|---------------|-------|
| 100 | ~20-50 KB | $0.0001 | Minimal |
| 1,000 | ~200-500 KB | $0.001 | Still minimal |
| 10,000 | ~2-5 MB | $0.01 | Per user |
| 100,000 | ~20-50 MB | $0.10 | Heavy user |

*Firestore storage: $0.18/GB/month

## Recommended Strategy: **Option 2 - Limited Persistence**

### Implementation
1. **Save last 100 messages** to Firestore
2. **Auto-cleanup**: Delete messages older than 90 days
3. **Load on mount**: Restore recent messages when user opens chat
4. **In-memory for session**: Keep all messages in state during active session

### Benefits
- ✅ Persistence across sessions
- ✅ Minimal storage cost (~$0.001/user/month)
- ✅ Fast performance (limited query)
- ✅ Automatic cleanup prevents bloat

### Storage Limits
- **Per user**: ~50 KB (100 messages × 500 bytes)
- **10,000 users**: ~500 MB total
- **Monthly cost**: ~$0.09 for 10,000 users

## Alternative Options

### Option 1: In-Memory Only (Current)
- **Cost**: $0
- **Persistence**: None
- **Use case**: If history isn't important

### Option 3: Save All Messages
- **Cost**: Scales with usage
- **Persistence**: Full history
- **Use case**: If full audit trail needed

### Option 4: Save Only Messages with Extracted Data
- **Cost**: Very low (~$0.0001/user/month)
- **Persistence**: Only important messages
- **Use case**: If only medical data extraction matters

## Recommendation

**Implement Option 2** with:
- Save last 100 messages
- Auto-delete after 90 days
- Load on chat tab open
- Keep in-memory during session

This provides the best balance of:
- User experience (persistence)
- Cost efficiency
- Performance
- Maintenance simplicity

