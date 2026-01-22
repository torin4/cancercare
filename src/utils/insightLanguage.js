/**
 * Insight Language Utility Module
 * 
 * Converts technical pattern descriptions into friendly, conversational language.
 * Makes insights accessible and understandable for all users.
 */

/**
 * Translate a pattern object to plain language
 * @param {Object} pattern - Pattern object from patternRecognition.js
 * @param {Object} data - Additional data context
 * @returns {Object} - Translated insight object with headline, explanation, etc.
 */
export function translatePattern(pattern, data = {}) {
  const { type, subtype } = pattern;
  
  switch (type) {
    case 'cycle':
      return translateCyclePattern(pattern, data);
    case 'cluster':
      return translateClusterPattern(pattern, data);
    case 'correlation':
      return translateCorrelationPattern(pattern, data);
    case 'temporal':
      return translateTemporalPattern(pattern, data);
    case 'multi-variable':
      return translateMultiVariablePattern(pattern, data);
    case 'trend':
      return translateTrendPattern(pattern, data);
    default:
      return translateGenericPattern(pattern, data);
  }
}

/**
 * Generate headline for an insight
 * @param {Object} insight - Insight object
 * @returns {string} - Plain language headline
 */
export function generateHeadline(insight) {
  if (insight.headline) return insight.headline;
  
  const { type } = insight;
  switch (type) {
    case 'cycle':
      return `Pattern: ${insight.metric || 'This'} tends to happen about every ${insight.intervalWeeks || 'few'} weeks`;
    case 'cluster':
      return `Pattern: These often happen together: ${insight.types?.join(', ') || 'multiple events'}`;
    case 'correlation':
      return `Connection: When ${insight.event1 || 'one thing'} happens, ${insight.event2 || 'another'} often follows`;
    case 'temporal':
      return `Timing: ${insight.description || 'Pattern detected around treatment cycles'}`;
    default:
      return 'Insight detected';
  }
}

/**
 * Generate explanation for an insight
 * @param {Object} insight - Insight object
 * @returns {string} - 2-3 line explanation
 */
export function generateExplanation(insight) {
  if (insight.explanation) return insight.explanation;
  
  const { type } = insight;
  switch (type) {
    case 'cycle':
      return `You've noticed ${insight.metric || 'this'} tends to happen about every ${insight.intervalWeeks || 'few'} weeks (${insight.occurrences || 0} times). ${insight.matchesMedication ? `This matches your ${insight.matchesMedication} treatment schedule.` : ''}`;
    case 'cluster':
      return `${insight.types?.join(', ') || 'These events'} often occur together (${insight.occurrences || 0} times). This pattern may be worth discussing with your doctor.`;
    case 'correlation':
      return `When ${insight.event1 || 'one thing'} happens, ${insight.event2 || 'another'} often follows about ${insight.avgLag || 'a few'} days later (${insight.occurrences || 0} times).`;
    default:
      return 'This pattern has been observed in your data and may be worth discussing with your healthcare team.';
  }
}

/**
 * Suggest actionable next step
 * @param {Object} insight - Insight object
 * @returns {string} - Actionable suggestion
 */
export function suggestAction(insight) {
  const { type } = insight;
  switch (type) {
    case 'cycle':
      return 'Consider tracking this pattern and discussing timing with your doctor.';
    case 'cluster':
      return 'You may want to discuss symptom management strategies with your healthcare team.';
    case 'correlation':
      return 'This connection may be worth sharing with your doctor to help with treatment planning.';
    default:
      return 'Consider discussing this pattern with your healthcare team.';
  }
}

// Helper functions for specific pattern types

function translateCyclePattern(pattern, data) {
  const weeks = Math.round((pattern.avgInterval || 0) / 7);
  return {
    type: 'cycle',
    headline: `Pattern: This tends to happen about every ${weeks} weeks`,
    explanation: `You've noticed this pattern occurs about every ${weeks} weeks (range: ${Math.round((pattern.minInterval || 0) / 7)}-${Math.round((pattern.maxInterval || 0) / 7)} weeks, ${pattern.occurrences || 0} times).${pattern.matchesMedication ? ` This matches your ${pattern.matchesMedication.name || 'treatment'} schedule.` : ''}`,
    actionable: suggestAction({ type: 'cycle' }),
    confidence: `Based on ${pattern.occurrences || 0} occurrences`
  };
}

function translateClusterPattern(pattern, data) {
  return {
    type: 'cluster',
    headline: `Pattern: These often happen together: ${pattern.types?.join(', ') || 'multiple events'}`,
    explanation: `${pattern.types?.join(', ') || 'These events'} often occur together (${pattern.occurrences || 0} times). This pattern may be worth discussing with your doctor.`,
    actionable: suggestAction({ type: 'cluster' }),
    confidence: `Based on ${pattern.occurrences || 0} occurrences`
  };
}

function translateCorrelationPattern(pattern, data) {
  const direction = pattern.direction === 'forward' ? 'follows' : 'precedes';
  return {
    type: 'correlation',
    headline: `Connection: When one thing happens, another often ${direction}`,
    explanation: `This pattern has been observed ${pattern.occurrences || 0} times, with an average delay of about ${pattern.avgLag || 'a few'} days (range: ${pattern.lagRange?.min || 0}-${pattern.lagRange?.max || 0} days).`,
    actionable: suggestAction({ type: 'correlation' }),
    confidence: `Based on ${pattern.occurrences || 0} occurrences`
  };
}

function translateTemporalPattern(pattern, data) {
  if (pattern.subtype === 'treatment-relative') {
    return {
      type: 'temporal',
      headline: `Timing: Pattern detected around treatment cycles`,
      explanation: `This tends to occur about ${pattern.avgDaysAfterTreatment || 0} days after ${pattern.medication || 'treatment'} cycles (range: ${pattern.minDays || 0}-${pattern.maxDays || 0} days, ${pattern.occurrences || 0} times).`,
      actionable: suggestAction({ type: 'temporal' }),
      confidence: `Based on ${pattern.occurrences || 0} occurrences`
    };
  }
  return translateGenericPattern(pattern, data);
}

function translateMultiVariablePattern(pattern, data) {
  return {
    type: 'multi-variable',
    headline: `Pattern: Multiple factors occur together`,
    explanation: `This pattern involves ${pattern.dataTypes?.join(' and ') || 'multiple data types'} occurring together (${pattern.events?.length || 0} times).`,
    actionable: suggestAction({ type: 'multi-variable' }),
    confidence: `Based on ${pattern.events?.length || 0} occurrences`
  };
}

function translateTrendPattern(pattern, data) {
  return {
    type: 'trend',
    headline: `Trend: ${pattern.direction || 'Change'} detected`,
    explanation: pattern.description || 'A trend has been observed in your data.',
    actionable: suggestAction({ type: 'trend' }),
    confidence: 'Based on recent data'
  };
}

function translateGenericPattern(pattern, data) {
  // Make generic insights more specific based on pattern data
  let headline = 'Insight detected';
  let explanation = 'A pattern has been observed in your data that may be worth discussing with your healthcare team.';
  
  if (pattern.description) {
    headline = pattern.description;
    // Only use description as explanation if it's different, otherwise provide a generic explanation
    explanation = pattern.description.length > 100 
      ? pattern.description 
      : `${pattern.description} This pattern may be worth discussing with your healthcare team.`;
  } else if (pattern.summary) {
    headline = pattern.summary;
    // Only use summary as explanation if it's different, otherwise provide a generic explanation
    explanation = pattern.summary.length > 100 
      ? pattern.summary 
      : `${pattern.summary} This pattern may be worth discussing with your healthcare team.`;
  }
  
  // If headline and explanation ended up being the same, make explanation more descriptive
  if (headline === explanation || headline.trim().toLowerCase() === explanation.trim().toLowerCase()) {
    explanation = `${headline} This pattern may be worth discussing with your healthcare team.`;
  }
  
  return {
    type: pattern.type || 'general',
    headline,
    explanation,
    actionable: suggestAction({ type: 'general' }),
    confidence: 'Based on your data'
  };
}
