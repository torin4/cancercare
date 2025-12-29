# Health Screen Integration with Firestore

## Overview

The Health screen now displays **real-time data from Firestore** instead of hardcoded dummy data. When you upload documents or chat with the AI, extracted values automatically appear in the Health screen.

## How It Works

### Data Flow

```
┌─────────────────────────────────────────────┐
│   USER ADDS DATA                             │
│   - Upload document                          │
│   - Chat: "CA-125 is 68"                    │
└──────────────┬──────────────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  AI EXTRACTS  │
        │  - Labs       │
        │  - Vitals     │
        └──────┬────────┘
               │
               ▼
     ┌─────────────────────┐
     │  SAVES TO FIRESTORE  │
     │  - labs/{id}         │
     │  - vitals/{id}       │
     └──────┬──────────────┘
               │
               ▼
    ┌──────────────────────┐
    │  RELOADS DATA         │
    │  - transformLabsData()│
    │  - transformVitalsData│
    └──────┬───────────────┘
               │
               ▼
   ┌───────────────────────┐
   │  UPDATES UI            │
   │  - allLabData          │
   │  - allVitalsData       │
   │  - Charts refresh      │
   └───────────────────────┘
```

### State Management

**State Variables:**
```javascript
const [labsData, setLabsData] = useState({});      // Real data from Firestore
const [vitalsData, setVitalsData] = useState({});  // Real data from Firestore
```

**Data Merge:**
```javascript
// Firestore data takes priority over default/demo data
const allLabData = { ...defaultLabData, ...labsData };
const allVitalsData = { ...defaultVitalsData, ...vitalsData };
```

## Data Transformation

### Firestore Format
```javascript
// What's stored in Firestore
{
  id: "abc123",
  patientId: "user456",
  labType: "ca125",
  label: "CA-125",
  currentValue: 68,
  unit: "U/mL",
  normalRange: "0-35",
  status: "high",
  createdAt: Timestamp
}
```

### UI Format
```javascript
// What the Health screen expects
{
  ca125: {
    name: "CA-125",
    unit: "U/mL",
    current: 68,
    status: "high",
    trend: "stable",
    normalRange: "0-35",
    data: [
      { date: "Dec 29", value: 68 }
    ]
  }
}
```

### Transformation Function

```javascript
const transformLabsData = (labs) => {
  const grouped = {};

  labs.forEach(lab => {
    const labType = lab.labType || 'unknown';

    if (!grouped[labType]) {
      grouped[labType] = {
        name: lab.label,
        unit: lab.unit,
        current: lab.currentValue,
        status: lab.status || 'normal',
        trend: 'stable',
        normalRange: lab.normalRange,
        data: []
      };
    }

    grouped[labType].data.push({
      date: new Date(lab.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: lab.currentValue
    });
  });

  return grouped;
};
```

## Real-Time Updates

### When Data Reloads

Health data automatically reloads in these scenarios:

1. **User logs in**
   ```javascript
   useEffect(() => {
     if (user) {
       loadHealthData();  // Loads all labs and vitals
     }
   }, [user]);
   ```

2. **After chat extraction**
   ```javascript
   if (result.extractedData) {
     await reloadHealthData();  // Refresh to show new values
   }
   ```

3. **After document upload**
   ```javascript
   await reloadHealthData();  // Refresh after processing
   ```

### Manual Reload Function

```javascript
const reloadHealthData = async () => {
  if (user) {
    const labs = await labService.getLabs(user.uid);
    const transformedLabs = transformLabsData(labs);
    setLabsData(transformedLabs);

    const vitals = await vitalService.getVitals(user.uid);
    const transformedVitals = transformVitalsData(vitals);
    setVitalsData(transformedVitals);
  }
};
```

## User Experience

### Example: Adding CA-125 via Chat

**User types:**
```
CA-125 came back at 72 today
```

**What happens:**
1. AI extracts: `{ labType: "ca125", value: 72, unit: "U/mL" }`
2. Saves to `labs/xyz123` in Firestore
3. Calls `reloadHealthData()`
4. Transforms Firestore data
5. Updates `labsData` state
6. Merges with `allLabData`
7. Health screen shows CA-125: 72

**User sees:**
- Chat: "✅ Logged 1 lab value(s): • CA-125: 72 U/mL (high)"
- Health > Labs: CA-125 card shows 72
- Chart updates with new data point

### Example: Uploading Lab Report

**User uploads:** `lab-results-12-29.pdf`

**What happens:**
1. AI analyzes PDF
2. Extracts: CA-125: 68, WBC: 5.5, Hemoglobin: 11.2
3. Saves all three to Firestore
4. Calls `reloadHealthData()`
5. Health screen updates with all values

**User sees:**
- Chat: "✅ Document processed... Extracted 3 lab values"
- Health > Labs: All three values appear
- Charts update with new data points
- File appears in Documents list

## Supported Data Types

### Labs
Lab types that get displayed in Health screen:
- `ca125` - CA-125 tumor marker
- `wbc` - White Blood Cells
- `anc` - Absolute Neutrophil Count
- `hemoglobin` - Hemoglobin
- `platelets` - Platelets
- `creatinine` - Creatinine
- `egfr` - eGFR
- `alt` - ALT (liver)
- `ast` - AST (liver)

### Vitals
Vital types that get displayed:
- `bp` - Blood Pressure
- `hr` - Heart Rate
- `temp` - Temperature
- `weight` - Weight
- `oxygen` - Oxygen Saturation

## Fallback Behavior

If no Firestore data exists for a lab type:
- Shows default/demo data
- User can still see the UI layout
- New values will replace default data

```javascript
// Priority: Firestore > Default
const allLabData = { ...defaultLabData, ...labsData };

// Result:
// - If labsData.ca125 exists → use it
// - If labsData.ca125 is undefined → use defaultLabData.ca125
```

## Chart Integration

Charts automatically update because:

1. **Data Source:**
   ```javascript
   const currentLab = allLabData[selectedLab];
   // Uses merged data (Firestore + defaults)
   ```

2. **Chart Renders:**
   ```javascript
   <LineChart data={currentLab.data}>
   // data = [{ date: "Dec 29", value: 72 }, ...]
   ```

3. **State Changes:**
   - When `labsData` updates
   - `allLabData` recalculates
   - React re-renders chart
   - New data points appear

## Testing

### Test Health Screen Integration

1. **Login to app**
2. **Go to Chat**
3. **Type:** "CA-125 is 85"
4. **Check Health > Labs:**
   - CA-125 should show 85
   - Chart should have new data point
   - Status should show "high"

5. **Upload a lab report PDF**
6. **Check Health > Labs:**
   - All extracted values appear
   - Charts update with trends

7. **Switch between lab types:**
   - Each lab shows correct data
   - Real data takes priority
   - Fallback data fills gaps

## Files Modified

- `src/App.js`
  - Added `labsData` and `vitalsData` state
  - Added `transformLabsData()` and `transformVitalsData()`
  - Added `reloadHealthData()` function
  - Merged Firestore data with defaults
  - Integrated reload calls after data extraction

## Next Enhancements

- [ ] Load full value history (not just latest)
- [ ] Show loading states while fetching
- [ ] Add pull-to-refresh on Health screen
- [ ] Cache data for offline viewing
- [ ] Add trend indicators (up/down/stable)
