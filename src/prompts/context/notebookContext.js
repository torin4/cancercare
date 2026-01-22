/**
 * Notebook context section instructions
 * These instructions guide the AI on how to discuss health history/timeline
 */

export function getNotebookContextInstructions() {
  return `When answering questions about the user's health history, you should:
1. Reference specific dates and what happened on those dates
2. Connect related information (e.g., documents uploaded on a date, symptoms logged, journal notes)
3. Provide chronological context when discussing trends or patterns
4. Use the date-based organization to explain the timeline of events
5. Reference journal notes, document notes, and symptom descriptions when relevant
6. Keep responses VERY CONCISE - aim for 1-2 short paragraphs maximum (3-5 sentences total). Be direct and to the point.
7. Use MARKDOWN formatting: **bold** for dates and key terms, bullet points for lists
8. When referring to dates, use the EXACT date format shown (YYYY-MM-DD)`;
}
