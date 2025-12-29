# Chat Processing Examples

## Overview

The chat now **automatically extracts and saves** medical data to Firestore when you mention values in conversation.

## Example Conversations

### Example 1: Blood Pressure

**You say:**
```
Her blood pressure was 130/85 today
```

**AI does:**
1. Extracts: BP = 130/85 mmHg
2. Saves to `vitals` collection with type "bp"
3. Adds to vital values history
4. Responds conversationally

**AI responds:**
```
I've logged Mary's blood pressure at 130/85 mmHg. That's slightly elevated from her normal range.
I'll keep tracking this trend.

✅ Logged 1 vital sign(s):
• Blood Pressure: 130/85 mmHg
```

**You see in Health > Vitals:**
- BP chart updates with new value
- New data point appears on graph

---

### Example 2: Lab Results

**You say:**
```
We got her CA-125 results back - it's 72
```

**AI does:**
1. Extracts: CA-125 = 72 U/mL
2. Saves to `labs` collection
3. Adds to lab values history
4. Flags as "high" (normal: 0-35)

**AI responds:**
```
I've recorded Mary's CA-125 at 72 U/mL. This is above the normal range (0-35).
This represents a slight increase from the previous reading. I recommend discussing this trend with her oncologist.

✅ Logged 1 lab value(s):
• CA-125: 72 U/mL (high)
```

---

### Example 3: Multiple Values

**You say:**
```
Just got back from the appointment. CA-125 is 68, WBC is 5.5, and BP was 125/80
```

**AI does:**
1. Extracts all three values
2. Saves CA-125 and WBC to `labs`
3. Saves BP to `vitals`
4. Updates all charts

**AI responds:**
```
Great! I've logged all three values from Mary's appointment:

✅ Logged 2 lab value(s):
• CA-125: 68 U/mL (high)
• WBC: 5.5 K/μL (normal)

✅ Logged 1 vital sign(s):
• Blood Pressure: 125/80 mmHg

The CA-125 is still elevated but stable. WBC and BP look good!
```

---

### Example 4: Symptoms

**You say:**
```
She's been feeling nauseous since yesterday. Pretty moderate, happening mostly after meals.
```

**AI does:**
1. Extracts: Symptom = Nausea, Severity = moderate
2. Saves to `symptoms` collection
3. Records notes about meal timing

**AI responds:**
```
I've noted Mary's nausea. Moderate nausea after meals is common during treatment.
Consider small, frequent meals and staying hydrated. Let me know if it worsens.

✅ Logged 1 symptom(s):
• Nausea (moderate)
```

---

### Example 5: Medications

**You say:**
```
Doctor started her on Zofran 8mg every 8 hours for the nausea
```

**AI does:**
1. Extracts: Medication = Zofran, Dosage = 8mg, Frequency = every 8 hours
2. Saves to `medications` collection
3. Marks as "active"

**AI responds:**
```
I've added Zofran to Mary's medication list. This should help with the nausea.

✅ Updated 1 medication(s):
• Zofran - started
```

---

### Example 6: Natural Conversation

**You say:**
```
How's her CA-125 trend looking?
```

**AI does:**
1. Queries `labs` collection for CA-125 history
2. Analyzes trend
3. No extraction needed (just querying)

**AI responds:**
```
Looking at Mary's CA-125 trend over the past 3 months:
- Nov 15: 55 U/mL
- Dec 28: 62 U/mL
- Dec 29: 68 U/mL

There's a gradual upward trend (+24% over 6 weeks). This is something to monitor closely and discuss with her oncologist at the next visit.
```

---

## What Gets Extracted

### Labs
- CA-125, CEA, PSA (tumor markers)
- WBC, Hemoglobin, Platelets (blood counts)
- Creatinine, BUN (kidney function)
- ALT, AST, Bilirubin (liver function)
- Any other lab value with a number + unit

### Vitals
- Blood Pressure (BP)
- Heart Rate (HR, pulse)
- Temperature (temp)
- Weight
- Oxygen saturation (O2, SpO2)

### Symptoms
- Name of symptom
- Severity (mild, moderate, severe)
- Timing/triggers
- Additional notes

### Medications
- Drug name
- Dosage
- Frequency
- Action (started, stopped, adjusted)

---

## Natural Language Examples

The AI understands many ways of expressing the same thing:

**Blood Pressure:**
- "BP was 130/85"
- "Her blood pressure is 130 over 85"
- "Pressure reading: 130/85"

**CA-125:**
- "CA-125 came back at 68"
- "Her tumor marker is 68"
- "CA125: 68 U/mL"

**Symptoms:**
- "She's nauseated"
- "Feeling sick to her stomach"
- "Bad nausea today"

---

## What Happens Automatically

1. **Extraction** - AI identifies medical data in your message
2. **Validation** - Checks units, ranges, data types
3. **Storage** - Saves to appropriate Firestore collection
4. **Confirmation** - Shows you what was saved
5. **Chart Update** - Health screen updates immediately
6. **Trend Analysis** - AI can analyze trends over time

---

## Privacy & Security

- All data stays in your secure Firestore database
- User isolation via security rules
- Encrypted in transit and at rest
- Only you can see your data
- HIPAA-compliant architecture
