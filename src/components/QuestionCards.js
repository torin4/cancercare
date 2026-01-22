import React from 'react';

// Utility function to remove questions from text
export function removeQuestionsFromText(text) {
  if (!text) return text;

  // Only process if this is a doctor discussion
  const isDoctorDiscussion = text.toLowerCase().includes('doctor') || 
                            text.toLowerCase().includes('discuss') ||
                            text.toLowerCase().includes('questions should i ask') ||
                            text.toLowerCase().includes('what questions');
  
  if (!isDoctorDiscussion) return text;

  // Split text into lines
  const lines = text.split('\n');
  const cleanedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      // Only add empty line if previous line wasn't empty (to preserve paragraph breaks)
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
      continue;
    }
    
    // Check if this line looks like a question
    let clean = line;
    
    // Remove markdown formatting for checking
    const checkLine = clean.replace(/\*\*/g, '').replace(/\*/g, '');
    const stripped = checkLine.replace(/^[\d\-\*•]\s*\.?\s*/, '').replace(/^[\(\[]\d+[\)\]]\s*/, '');
    
    // Check if it's a question
    const isQuestion = stripped.endsWith('?') && stripped.length > 10 && stripped.length < 300;
    const hasQuestionWords = /(what|how|should|when|where|why|which|can|could|would|will|is|are|do|does|did)\s+/i.test(stripped);
    
    // Skip lines that are clearly questions
    if (isQuestion && hasQuestionWords) {
      continue; // Skip this line
    }
    
    // Also check for common question patterns like "Here are some questions:" followed by questions
    if (i > 0 && /^(here are|these are|some questions|questions to ask|you may want to ask)/i.test(line)) {
      // This might be an intro to questions, keep it but check next lines
      cleanedLines.push(line);
      continue;
    }
    
    // Keep non-question lines
    cleanedLines.push(line);
  }

  // Join lines and clean up extra whitespace
  let cleanedText = cleanedLines.join('\n');
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleanedText;
}

export default function QuestionCards({ text }) {
  if (!text) return null;

  // Only show question cards for messages about discussing with doctor
  const isDoctorDiscussion = text.toLowerCase().includes('doctor') || 
                            text.toLowerCase().includes('discuss') ||
                            text.toLowerCase().includes('questions should i ask') ||
                            text.toLowerCase().includes('what questions');
  
  if (!isDoctorDiscussion) return null;

  // Extract all questions from the text (lines ending with ?)
  const questionMatches = text.match(/[^.!?]*\?/g);
  if (!questionMatches || questionMatches.length === 0) return null;

  const questions = [];
  
  questionMatches.forEach(match => {
    let clean = match.trim();
    
    // Remove markdown formatting
    clean = clean.replace(/\*\*/g, '');
    clean = clean.replace(/\*/g, '');
    clean = clean.replace(/^[\d\-\*•]\s*\.?\s*/, '');
    clean = clean.replace(/^[\(\[]\d+[\)\]]\s*/, '');
    
    // Clean up any leading/trailing punctuation except the ?
    clean = clean.replace(/^[:\-–—]\s*/, '');
    clean = clean.trim();
    
    // Only include if it looks like a real question (has question words or ends with ?)
    if (clean.length > 10 && clean.length < 300) {
      const lower = clean.toLowerCase();
      // Include if it ends with ? and has reasonable length, or contains question words
      if (clean.endsWith('?') || 
          lower.includes('what') || 
          lower.includes('how') || 
          lower.includes('should') ||
          lower.includes('when') ||
          lower.includes('where') ||
          lower.includes('why') ||
          lower.includes('which')) {
        questions.push(clean);
      }
    }
  });

  // Remove duplicates
  const uniqueQuestions = [...new Set(questions)];

  if (uniqueQuestions.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {uniqueQuestions.map((question, idx) => (
        <div 
          key={idx} 
          className="bg-white border border-medical-neutral-200 rounded-lg p-3 text-xs text-medical-neutral-700 hover:border-medical-neutral-300 transition-colors"
        >
          {question}
        </div>
      ))}
    </div>
  );
}
