import React from 'react';

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
