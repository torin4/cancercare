/**
 * Task descriptions for different types of queries
 * These determine how the AI should approach the user's message
 */

export function getTaskDescription(message, trialContextSection, healthContextSection, notebookContextSection) {
  // Check if this is a doctor questions query
  const isQuestionQuery = message.toLowerCase().includes('questions should i ask') || 
                          (message.toLowerCase().includes('discuss') && message.toLowerCase().includes('doctor')) ||
                          message.toLowerCase().includes('what questions');
  
  if (isQuestionQuery) {
    return `TASK: The user is asking what questions to ask their doctor. This is a DISCUSSION/SEARCH query - DO NOT extract any medical data. Simply provide a list of 3-5 specific, actionable questions formatted as a numbered or bulleted list. Each question should be on its own line and end with a question mark.

CRITICAL: This is NOT a data extraction task - return empty extractedData. Only provide the conversational response with questions.

Example format:
1. What could be causing this condition?
2. What treatment options are available?
3. What are the next steps?
4. Are there any concerns I should watch for?
5. When should I follow up?`;
  }
  
  // Detect if this is a delete/remove/duplicate removal query
  const isDeleteQuery = /(delete|remove|clean up|remove duplicate|remove duplicates|delete duplicate|delete duplicates|clean|deduplicate|dedupe)/i.test(message);
  
  // Detect if this is a recovery/undo query about deleted/lost data (NOT medical recovery questions)
  // Requires explicit data recovery phrases OR recovery words + context about data/values/deletion
  const isRecoveryQuery = (
    // Explicit recovery phrases about deleted data
    /(restore deleted|undo delete|recover deleted|get my values back|how can i undo|how do i recover|recover my (data|values|labs?)|restore my (data|values|labs?)|undo (the )?deletion|get back my (data|values|labs?)|bring back my (data|values|labs?))/i.test(message) ||
    // Generic recovery words BUT only if also mentioning data/values/deletion
    (/(undo|recover|restore|get back|bring back|revert)\b/i.test(message) && /(data|values?|labs?|delete|deleted|lost|removed|missing|gone)/i.test(message))
  );
  
  // Detect if this is an edit/update query
  const isEditQuery = /(edit|update|change|correct|fix|modify|replace|set to|change (my|the) (.*) (to|from)|update (my|the) (.*) (to|from)|correct (my|the) (.*)|fix (my|the) (.*))/i.test(message);
  
  // Detect if this is a comparison/retrieval query (not data entry)
  const isComparisonQuery = /(compare|comparison|how does|how did|versus|vs|difference|change from|compared to|last (measurement|value|result|test|date|two|three)|previous|before that|one before|earlier|prior|historical|retrieve|show me|tell me about|what (was|were)|the (last|previous|earlier))/i.test(message);
  const isConfirmationQuery = /^(yes|yep|yeah|yup|sure|ok|okay|please|show|tell|give|provide|retrieve|get|find|look up)/i.test(message.trim());
  
  let taskDescription = `TASK: Analyze the user's message and extract any medical values they mentioned.`;
  
  if (isRecoveryQuery) {
    taskDescription = `TASK: The user is asking to RECOVER or RESTORE deleted values. This is a RECOVERY query - DO NOT extract new medical data. Instead, provide helpful instructions on how to recover deleted values by:
1. Re-uploading or rescanning documents that contained the values
2. Manually re-entering the values
3. Explaining that Firestore doesn't have built-in undo, but values can be restored from source documents
4. Be helpful and empathetic about the situation`;
  } else if (isDeleteQuery) {
    taskDescription = `TASK: The user is asking to DELETE or REMOVE health data values, including duplicate values. This is a DELETION query. You need to:
1. Identify which values to delete (by lab/vital type, date, and value if specified)
2. If they mention "duplicates" or "duplicate values", find values with the same lab/vital type, same date, and same value, and keep only one
3. Set "action": "delete" in the extractedData for labs/vitals
4. Include the lab/vital type, date, and value to identify which entries to remove
5. For duplicate removal, specify that duplicates should be removed (keep one)`;
  } else if (isEditQuery) {
    taskDescription = `TASK: The user is asking to EDIT or UPDATE an existing health data value. This is an UPDATE query - you need to:
1. Identify which existing value to update (by lab/vital type and date)
2. Extract the NEW value they want to set
3. Set "action": "update" in the extractedData for labs/vitals
4. Include the date of the existing value to update (or "last" if they said "last measurement")
5. If they mention a specific date, use that date to find the matching value
6. If they say "last" or "most recent", find the most recent value for that lab/vital type`;
  } else if (isComparisonQuery || isConfirmationQuery) {
    taskDescription = `TASK: The user is asking to COMPARE or RETRIEVE historical health data. This is a DATA RETRIEVAL query - DO NOT extract new medical data. Instead, look up the requested data from the health context provided below and answer the question directly. If health context is provided, you have all the data needed - use it to compare values, list historical measurements, or answer the question.`;
  } else if (trialContextSection) {
    taskDescription += ' The user is asking about a specific clinical trial - provide detailed information about the trial, its drugs, phase, and eligibility.';
  } else if (healthContextSection) {
    taskDescription += ' The user is asking about their health data - analyze their labs, vitals, and symptoms to provide insights and answer questions. Use the health context data to answer questions directly - do not ask for data that is already provided.';
  } else if (notebookContextSection) {
    taskDescription += ' The user is asking about their health history/timeline - reference the journal entries, documents, notes, and symptoms organized by date.';
  }
  
  return taskDescription;
}
