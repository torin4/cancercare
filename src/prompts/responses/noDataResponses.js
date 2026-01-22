/**
 * Response messages when data is not available
 */

export function buildNoTrialDataResponse() {
  return `I'd be happy to help you with your saved clinical trials! However, I don't see any saved trials in your profile yet.

To get started, you can:
- **Search for clinical trials** on the Clinical Trials tab
- **Save trials** that match your profile by clicking the bookmark icon
- **Ask about specific trials** after you've saved them

Once you have saved trials, I can help you:
- Understand what each trial involves
- Explain the drugs and treatments being tested
- Discuss eligibility criteria
- Answer questions about trial phases, side effects, and locations

Would you like to search for clinical trials now?`;
}

export function buildNoHealthDataResponse() {
  return `I'd be happy to help you understand your health data! However, I don't see any health data tracked yet in your profile.

To get started, you can:
- **Upload lab reports** or **add lab values** via chat (e.g., "My CA-125 was 68 on December 15")
- **Log vital signs** like blood pressure, heart rate, or weight
- **Track symptoms** you're experiencing
- **Add medications** you're taking

Once you have data, I can help you:
- Understand what your values mean
- Analyze trends over time
- Explain how your treatment is progressing
- Identify patterns in your health data

Would you like to start by adding some health data?`;
}

export function buildNoLabDataResponse() {
  return `I'd be happy to explain your lab results! However, I don't see any lab values tracked in your profile yet.

You can add lab values by:
- **Uploading lab reports** through the Files tab
- **Telling me in chat** (e.g., "My CA-125 was 68 on December 15")
- **Using the Health tab** to manually enter values

Once you have lab data, I can help explain what the values mean and track trends over time.`;
}

export function buildNoVitalDataResponse() {
  return `I'd be happy to help with your vital signs! However, I don't see any vital signs tracked in your profile yet.

You can add vital signs by:
- **Telling me in chat** (e.g., "My blood pressure was 125/80 this morning")
- **Using the Health tab** to manually enter values

Once you have vital sign data, I can help you understand what the values mean and track changes over time.`;
}

export function buildNoSymptomDataResponse() {
  return `I'd be happy to help with your symptoms! However, I don't see any symptoms tracked in your profile yet.

You can log symptoms by:
- **Telling me in chat** (e.g., "I had mild nausea yesterday")
- **Using the Health tab** to manually log symptoms
- **Using the quick log** feature on the dashboard

Once you have symptom data, I can help identify patterns and correlations with your other health data.`;
}

export function buildInsufficientTrendDataResponse() {
  return `I'd be happy to analyze trends in your health data! However, I need more data points to identify meaningful trends and patterns.

To analyze trends effectively, I typically need:
- **At least 2-3 measurements over time** for labs or vitals
- **Multiple symptom entries** to identify patterns

You can add more data by:
- **Uploading additional lab reports** through the Files tab
- **Telling me in chat** (e.g., "My CA-125 was 68 on December 15, and 72 on January 1")
- **Using the Health tab** to manually enter values over time

Once you have more data points, I can help you see trends, identify patterns, and understand how your values are changing over time.`;
}
