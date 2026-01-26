/**
 * Insight Language Utility Module
 *
 * Converts technical pattern descriptions into friendly, conversational language.
 * Makes insights accessible and understandable for all users.
 */

import { getLabDisplayName } from './normalizationUtils';

/**
 * Format a metric name for display (capitalizes lab names like mpv -> MPV)
 * @param {string} metric - Raw metric name
 * @returns {string} - Formatted metric name
 */
function formatMetricName(metric) {
  if (!metric) return 'This';
  // Use the lab display name utility which handles proper capitalization
  const displayName = getLabDisplayName(metric);
  return displayName !== 'Unknown Lab' ? displayName : metric;
}

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
    case 'cycle': {
      const avgDays = insight.avgInterval || 0;
      const metric = formatMetricName(insight.metric || 'This');
      const intervalStr = avgDays < 7 ? `${Math.round(avgDays)} days` : `${Math.round(avgDays / 7)} weeks`;
      return `Pattern: ${metric} tends to happen about every ${intervalStr}`;
    }
    case 'cluster':
      return `Pattern: These often happen together: ${insight.types?.join(', ') || 'multiple events'}`;
    case 'correlation':
      return `Connection: When ${formatMetricName(insight.event1 || 'one thing')} happens, ${formatMetricName(insight.event2 || 'another')} often follows`;
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
    case 'cycle': {
      const avgDays = insight.avgInterval || 0;
      const metric = formatMetricName(insight.metric || 'this');
      const intervalStr = avgDays < 7 ? `${Math.round(avgDays)} days` : `${Math.round(avgDays / 7)} weeks`;
      return `You've noticed ${metric} tends to happen about every ${intervalStr} (${insight.occurrences || 0} times). ${insight.matchesMedication ? `This matches your ${insight.matchesMedication} treatment schedule.` : ''}`;
    }
    case 'cluster':
      return `${insight.types?.join(', ') || 'These events'} often occur together (${insight.occurrences || 0} times). This pattern may be worth discussing with your doctor.`;
    case 'correlation':
      return `When ${formatMetricName(insight.event1 || 'one thing')} happens, ${formatMetricName(insight.event2 || 'another')} often follows about ${insight.avgLag || 'a few'} days later (${insight.occurrences || 0} times).`;
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
  const avgDays = pattern.avgInterval || 0;
  const minDays = pattern.minInterval || 0;
  const maxDays = pattern.maxInterval || 0;
  const rawMetric = pattern.metric || pattern.event || pattern.symptom || pattern.labType || 'This';
  const metric = formatMetricName(rawMetric);

  // Format interval in appropriate units (days if < 7, weeks otherwise)
  let intervalStr, rangeStr;
  if (avgDays < 7) {
    intervalStr = `${Math.round(avgDays)} days`;
    rangeStr = `${Math.round(minDays)}-${Math.round(maxDays)} days`;
  } else {
    const weeks = Math.round(avgDays / 7);
    const minWeeks = Math.round(minDays / 7);
    const maxWeeks = Math.round(maxDays / 7);
    intervalStr = `${weeks} week${weeks !== 1 ? 's' : ''}`;
    rangeStr = `${minWeeks}-${maxWeeks} weeks`;
  }

  // Build meaningful details for "Learn more"
  let details = `This ${metric} pattern was detected ${pattern.occurrences || 0} times over your tracked data. `;
  if (pattern.matchesMedication) {
    details += `This timing aligns with your ${pattern.matchesMedication.name || 'treatment'} schedule, which may explain the regularity. `;
  } else {
    details += `Regular patterns in lab values often reflect treatment cycles, testing schedules, or biological rhythms. `;
  }
  details += `Knowing this pattern can help you and your healthcare team anticipate when to monitor or schedule follow-ups.`;

  return {
    type: 'cycle',
    headline: `Pattern: ${metric} tends to happen about every ${intervalStr}`,
    explanation: `Detected ${pattern.occurrences || 0} times with intervals ranging from ${rangeStr}.${pattern.matchesMedication ? ` Matches your ${pattern.matchesMedication.name || 'treatment'} schedule.` : ''}`,
    details,
    actionable: suggestAction({ type: 'cycle' }),
    confidence: `Based on ${pattern.occurrences || 0} occurrences`
  };
}

function translateClusterPattern(pattern, data) {
  const types = pattern.types?.join(', ') || 'multiple events';
  const details = `When ${types} occur together repeatedly, it may indicate a shared underlying cause or trigger. This pattern was observed ${pattern.occurrences || 0} times in your data. Your healthcare team can help determine if these events are related and suggest management strategies.`;

  return {
    type: 'cluster',
    headline: `Pattern: These often happen together: ${types}`,
    explanation: `Observed together ${pattern.occurrences || 0} times. This clustering may indicate a connection worth exploring.`,
    details,
    actionable: suggestAction({ type: 'cluster' }),
    confidence: `Based on ${pattern.occurrences || 0} occurrences`
  };
}

function translateCorrelationPattern(pattern, data) {
  const direction = pattern.direction === 'forward' ? 'follows' : 'precedes';
  const rawEvent1 = pattern.event1 || pattern.trigger || pattern.cause || pattern.source || 'one event';
  const rawEvent2 = pattern.event2 || pattern.result || pattern.effect || pattern.target || 'another';
  const event1 = formatMetricName(rawEvent1);
  const event2 = formatMetricName(rawEvent2);
  const lagDays = pattern.avgLag || 'a few';
  const lagMin = pattern.lagRange?.min || 0;
  const lagMax = pattern.lagRange?.max || 0;

  const details = `This correlation was detected ${pattern.occurrences || 0} times: ${event2} typically ${direction} ${event1} by about ${lagDays} days (ranging from ${lagMin} to ${lagMax} days). While correlation doesn't prove causation, consistent timing patterns can help you and your healthcare team understand how different aspects of your health may be connected.`;

  return {
    type: 'correlation',
    headline: `Connection: When ${event1} happens, ${event2} often ${direction}`,
    explanation: `Observed ${pattern.occurrences || 0} times with ~${lagDays} day delay (range: ${lagMin}-${lagMax} days).`,
    details,
    actionable: suggestAction({ type: 'correlation' }),
    confidence: `Based on ${pattern.occurrences || 0} occurrences`
  };
}

function translateTemporalPattern(pattern, data) {
  if (pattern.subtype === 'treatment-relative') {
    const avgDays = pattern.avgDaysAfterTreatment || 0;
    const medication = pattern.medication || 'treatment';
    const minDays = pattern.minDays || 0;
    const maxDays = pattern.maxDays || 0;
    const occurrences = pattern.occurrences || 0;

    const details = `This timing pattern was observed ${occurrences} times after ${medication} cycles. Knowing when to expect certain changes (typically ${avgDays} days post-treatment, ranging from ${minDays} to ${maxDays} days) can help you prepare and plan ahead. Your healthcare team can use this information to optimize supportive care timing.`;

    return {
      type: 'temporal',
      headline: `Timing: Pattern detected around treatment cycles`,
      explanation: `Occurs ~${avgDays} days after ${medication} (range: ${minDays}-${maxDays} days). Observed ${occurrences} times.`,
      details,
      actionable: suggestAction({ type: 'temporal' }),
      confidence: `Based on ${occurrences} occurrences`
    };
  }
  return translateGenericPattern(pattern, data);
}

function translateMultiVariablePattern(pattern, data) {
  const dataTypes = pattern.dataTypes?.join(' and ') || 'multiple data types';
  const occurrences = pattern.events?.length || 0;

  const details = `This multi-factor pattern involving ${dataTypes} was detected ${occurrences} times. When multiple health indicators change together, it can provide a more complete picture of what's happening. Your healthcare team can help interpret how these factors might be related.`;

  return {
    type: 'multi-variable',
    headline: `Pattern: Multiple factors occur together`,
    explanation: `Involves ${dataTypes} occurring together. Detected ${occurrences} times.`,
    details,
    actionable: suggestAction({ type: 'multi-variable' }),
    confidence: `Based on ${occurrences} occurrences`
  };
}

function translateTrendPattern(pattern, data) {
  const direction = pattern.direction || 'Change';
  const description = pattern.description || 'A trend has been observed in your data.';

  const details = `Trends show how values are changing over time. A ${direction.toLowerCase()} trend may be significant depending on what's being measured and your treatment context. Your healthcare team can help determine if this trend requires attention or is expected given your treatment plan.`;

  return {
    type: 'trend',
    headline: `Trend: ${direction} detected`,
    explanation: description,
    details,
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
    explanation = 'This pattern was detected in your health data and may provide useful context for your care.';
  }

  const details = 'Patterns in health data can reveal important information about how your body responds to treatment, lifestyle factors, or natural cycles. Your healthcare team can help interpret this pattern and determine if any action is needed.';

  return {
    type: pattern.type || 'general',
    headline,
    explanation,
    details,
    actionable: suggestAction({ type: 'general' }),
    confidence: 'Based on your data'
  };
}
