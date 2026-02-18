# Pattern Insight Cards Display Logic

## Current Behavior

### When Insights Are Generated:
1. **Always generated** when `healthContext` is provided to `processChatMessage()`
2. Generated in `buildHealthContextSection()` regardless of the user's question
3. Cached based on health data state (labs, vitals, symptoms, medications)
4. Only regenerated when health data changes

### When Insights Are Shown:
1. **Only for AI responses** (`msg.type === 'ai'`)
2. **Only if insights exist** (`msg.insights || msg.insight`)
3. **NOT shown for doctor discussion queries** (questions containing "questions should i ask", "discuss...doctor", "what questions")
4. **Only if insights array is not empty** after filtering

### Filtering Process:
1. **Pattern Detection** (`detectAllPatterns`):
   - Detects cycles, clusters, correlations, temporal patterns
   - Requires minimum data (5+ entries for most patterns)
   - Filters by time window (18 months default)

2. **Translation** (`translatePattern`):
   - Converts technical patterns to plain language
   - Generates headlines, explanations, details

3. **Clinical Validation** (`validateAndEnhanceInsights`):
   - **Only shows research-backed correlations** (e.g., low hemoglobin → fatigue)
   - Filters out meaningless correlations
   - Adds actionable discussion points

4. **Deduplication**:
   - Removes duplicate insights by headline/explanation
   - Removes insights where headline === explanation

5. **Limiting**:
   - Sorted by priority (lower = higher priority)
   - Limited to **top 3 insights** for display

### Issues with Current Logic:
- Insights are generated for **every health-related question**, even when not relevant
- No check if the question is asking about patterns/trends
- Could show insights for simple questions like "what is my hemoglobin?"
- Insights are always included in the response, even if the question doesn't need them

### Potential Improvements:
1. Only generate insights when question asks about:
   - Patterns, trends, correlations
   - "What patterns do you see?"
   - "Are there any connections?"
   - "What should I watch for?"

2. Or only show insights when:
   - Question is about health analysis
   - Question asks about relationships between data
   - User hasn't seen these insights recently

3. Make insights optional/contextual:
   - Only show if relevant to the specific question
   - Allow user to dismiss/hide insights
   - Show insights in a separate section, not always with every response
