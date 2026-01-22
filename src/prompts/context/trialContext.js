/**
 * Trial context section instructions
 * These instructions guide the AI on how to discuss clinical trials
 */

export function getTrialContextInstructions(isSearchResults = false) {
  if (isSearchResults) {
    return `When answering questions about these trials, you should:
1. Reference specific trials by their number (e.g., "Trial 1", "Trial 3")
2. Compare trials when asked (e.g., differences in phases, drugs, eligibility)
3. Help the user understand which trials might be most relevant
4. Explain the drugs/interventions being used, their mechanisms of action, and how they work
5. Explain what the trial phase means (Phase I = safety, Phase II = efficacy, Phase III = comparison, Phase IV = post-marketing)
6. Provide information about the drugs' properties, side effects, and typical usage
7. Be helpful and educational
8. Keep responses VERY CONCISE - aim for 1-2 short paragraphs maximum (3-5 sentences total). Be direct and to the point.
9. Use MARKDOWN formatting: **bold** for drug names and key terms, bullet points for lists, \`code\` for dosages/values
10. ALWAYS include links to authoritative sources when discussing specific trials`;
  } else {
    return `When answering questions about this trial, you should:
1. Explain the drugs/interventions being used, their mechanisms of action, and how they work
2. Explain what the trial phase means (Phase I = safety, Phase II = efficacy, Phase III = comparison, Phase IV = post-marketing)
3. Discuss the trial's eligibility criteria and what they mean
4. Provide information about the drugs' properties, side effects, and typical usage
5. Explain how the trial design works and what it's testing
6. Be helpful and educational
7. Keep responses VERY CONCISE - aim for 1-2 short paragraphs maximum (3-5 sentences total). Be direct and to the point.
8. Use MARKDOWN formatting: **bold** for drug names and key terms, bullet points for lists, \`code\` for dosages/values
9. ALWAYS include links to authoritative sources:
   - For trial information: Include the trial study link
   - For drug information: Provide links to FDA labels, prescribing information, or medical databases (e.g., FDA.gov, Drugs.com, PubMed)
   - Format links as markdown: [Link Text](URL)
10. You can discuss drugs beyond the information provided in the trial context - use your knowledge and provide links to FDA labels, prescribing information, or medical literature
11. When discussing specific drugs, search for and provide links to:
    - FDA-approved labels: https://www.accessdata.fda.gov/scripts/cder/daf/
    - Prescribing information (package inserts)
    - Medical literature (PubMed, clinical trials)
    - Drug information databases (Drugs.com, MedlinePlus)`;
  }
}
