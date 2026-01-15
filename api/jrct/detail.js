// api/jrct/detail.js
const axios = require('axios');
const cheerio = require('cheerio');

const ORIGIN = 'https://jrct.mhlw.go.jp';

function normalize(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function fetchSearchHtml({ q, page, userAgent }) {
  // First, GET the search page to establish session (same as search.js)
  let cookieString = '';
  const searchPageUrl = `${ORIGIN}/search`;
  
  try {
    const sessionResponse = await axios.get(searchPageUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,ja;q=0.9', // Prefer English content
        'User-Agent': userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `${ORIGIN}/`
      },
      timeout: 40000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });

    // Extract cookies from the session response
    const cookies = sessionResponse.headers['set-cookie'] || [];
    cookieString = cookies.map(c => c.split(';')[0]).join('; ');
  } catch (sessionErr) {
    // If session fetch fails, continue without cookies (might still work)
    console.error('Failed to fetch session page:', sessionErr.message);
    cookieString = '';
  }

  // Now POST the search form with the session cookie
  // IMPORTANT: Use reg_plobrem_1 (対象疾患名 / Target Disease Name) instead of demo_1 (keyword search)
  // This ensures we search the disease field specifically when fetching search HTML for token extraction
  const target = `${ORIGIN}/search?searched=1&page=${page}`;
  const form = new URLSearchParams();
  form.set('button_type', 'confReg');
  form.set('reg_plobrem_1', q); // Use disease field (対象疾患名) instead of keyword field (demo_1)
  form.set('others', '1');
  // Note: We're NOT setting demo_1 (free word search) to focus on disease-specific results

  const r = await axios.post(target, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en,ja;q=0.9', // Prefer English content
      'User-Agent': userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': ORIGIN,
      'Referer': searchPageUrl,
      ...(cookieString && { 'Cookie': cookieString })
    },
    timeout: 40000,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400
  });

  // Extract cookies from response as well
  const responseCookies = r.headers['set-cookie'] || [];
  const responseCookieString = responseCookies.map(c => c.split(';')[0]).join('; ');
  const allCookies = [cookieString, responseCookieString].filter(Boolean).join('; ');

  return { html: r.data, target, cookies: allCookies };
}

function extractDetailPostForm(searchHtml, id) {
  const $ = cheerio.load(searchHtml);

  // Normalize ID for matching
  const normalizedId = normalize(id);
  
  // First, check if this trial ID actually exists in the search results
  const foundIds = [];
  $('table.table-search tbody tr td:first-child').each((_, td) => {
    const trialId = normalize($(td).text());
    if (trialId && trialId.match(/^jRCT/i)) {
      foundIds.push(trialId);
    }
  });
  
  // Check if our trial ID is in the results (case-insensitive)
  const idInResults = foundIds.some(foundId => 
    foundId.toLowerCase() === normalizedId.toLowerCase() || 
    foundId.replace(/^jRCT/i, 'jRCT') === normalizedId.replace(/^jRCT/i, 'jRCT')
  );
  
  if (!idInResults) {
    // Trial not found in search results - return null so we can return a proper error
    return null;
  }
  
  // Try multiple form selectors to find the form for this trial ID
  let $form = null;
  
  // Try exact match first (Japanese version)
  $form = $(`form[action="/latest-detail/${normalizedId}"]`);
  
  // Try English version
  if (!$form || !$form.length) {
    $form = $(`form[action="/en-latest-detail/${normalizedId}"]`);
  }
  
  // Try case-insensitive contains match (both Japanese and English versions)
  if (!$form || !$form.length) {
    $('form[action*="/latest-detail/"]').each((_, f) => {
      const action = $(f).attr('action') || '';
      // Match both /latest-detail/ and /en-latest-detail/
      const actionId = action.match(/\/(?:en-)?latest-detail\/([^\/\?"]+)/)?.[1];
      if (actionId && (actionId.toLowerCase() === normalizedId.toLowerCase() || actionId === normalizedId)) {
        $form = $(f);
        return false; // Break
      }
    });
  }
  
  // Try finding form within the row that contains this trial ID
  if (!$form || !$form.length) {
    $('table.table-search tbody tr').each((_, tr) => {
      const firstTd = $(tr).find('td:first-child');
      const rowId = normalize(firstTd.text());
      if (rowId && (rowId.toLowerCase() === normalizedId.toLowerCase() || rowId === normalizedId)) {
        // Try both Japanese and English versions
        let rowForm = $(tr).find('form[action*="/latest-detail/"]');
        if (!rowForm.length) {
          rowForm = $(tr).find('form[action*="/en-latest-detail/"]');
        }
        if (rowForm.length) {
          $form = rowForm.first();
          return false; // Break
        }
      }
    });
  }
  
  if (!$form || !$form.length) {
    // Form not found even though trial is in results - might be a parsing issue
    return null;
  }

  const action = $form.attr('action');
  if (!action) {
    return null;
  }
  
  const method = ($form.attr('method') || 'post').toLowerCase();

  // Extract token fields (these are required for the POST)
  let _method = $form.find('input[name="_method"]').attr('value') || 'POST';
  let tokenFields = $form.find('input[name="_Token[fields]"]').attr('value') || '';
  let tokenUnlocked = $form.find('input[name="_Token[unlocked]"]').attr('value') || '';

  // If token fields are empty, try to find them in parent elements or nearby
  if (!tokenFields && !tokenUnlocked) {
    const tokenInputs = $form.closest('tr, div, form, body').find('input[name*="Token"]');
    tokenInputs.each((_, inp) => {
      const name = $(inp).attr('name') || '';
      const value = $(inp).attr('value') || '';
      if (name.includes('fields') && !tokenFields) {
        tokenFields = value;
      } else if (name.includes('unlocked') && !tokenUnlocked) {
        tokenUnlocked = value;
      }
    });
  }

  // Build the action URL - PREFER English version
  let actionUrl;
  try {
    if (action.startsWith('http')) {
      actionUrl = action;
    } else if (action.startsWith('/')) {
      actionUrl = new URL(action, ORIGIN).toString();
    } else {
      // Default to English version
      actionUrl = new URL(`/en-latest-detail/${normalizedId}`, ORIGIN).toString();
    }
    
    // Convert to English version if it's Japanese (unless it's already English)
    if (actionUrl.includes('/latest-detail/') && !actionUrl.includes('/en-')) {
      actionUrl = actionUrl.replace('/latest-detail/', '/en-latest-detail/');
    }
  } catch (e) {
    // Invalid URL, construct manually - default to English
    actionUrl = `${ORIGIN}/en-latest-detail/${normalizedId}`;
  }

  return {
    actionUrl,
    method,
    postBody: new URLSearchParams({
      _method,
      '_Token[fields]': tokenFields,
      '_Token[unlocked]': tokenUnlocked
    })
  };
}

/**
 * Parse JRCT detail page HTML to extract comprehensive trial information
 * This extracts the same fields that ClinicalTrials.gov provides for consistency
 * @param {string} html - HTML content of the detail page
 * @param {string} id - Trial ID
 * @returns {Object} - Parsed trial data matching ClinicalTrials.gov format
 */
function parseJRCTDetail(html, id) {
  const $ = cheerio.load(html);
  
  // Helper to extract text from a selector
  const getText = (selector, defaultValue = '') => {
    const elem = $(selector).first();
    return normalize(elem.text() || defaultValue);
  };
  
  // Helper to extract value from table by label text (supports both Japanese and English)
  // More precise extraction to avoid cross-contamination between fields
  const getTableValue = (labelPatterns, excludePatterns = []) => {
    const patterns = Array.isArray(labelPatterns) ? labelPatterns : [labelPatterns];
    const exclude = Array.isArray(excludePatterns) ? excludePatterns : [excludePatterns];
    
    let found = false;
    let value = '';
    
    // Try to find label in table rows (more precise matching)
    try {
      // First try: Look for exact label match in th/td cells
      $('table tr').each((_, row) => {
        if (found) return; // Already found, skip
        
        const $row = $(row);
        const cells = $row.find('th, td');
        
        if (cells.length < 2) return; // Need at least label and value
        
        // Check first cell for label
        const labelText = normalize(cells.eq(0).text());
        
        // Check if label matches our patterns (handle special chars like &)
        const matchesLabel = patterns.some(pattern => {
          try {
            // Escape special regex chars but preserve & which is in "Key inclusion & exclusion criteria"
            const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\&/g, '&');
            const regex = new RegExp(`^${escapedPattern}[:：\\s]*$|^${escapedPattern}[:：\\s]`, 'i');
            return regex.test(labelText);
          } catch (err) {
            // If regex fails, try simple contains match
            return labelText.toLowerCase().includes(pattern.toLowerCase());
          }
        });
        
        if (matchesLabel && !found) {
          // Get value from second cell, but also check if there are more cells
          // Sometimes the value spans multiple cells
          let valueText = '';
          for (let i = 1; i < cells.length; i++) {
            const cellText = normalize(cells.eq(i).text());
            if (cellText && cellText.length > 0) {
              valueText += (valueText ? ' ' : '') + cellText;
            }
          }
          
          // If no value in cells, try next row (sometimes value is in following row)
          if (!valueText || valueText.length < 10) {
            const nextRow = $row.next();
            if (nextRow.length) {
              const nextRowCells = nextRow.find('td, th');
              if (nextRowCells.length > 0) {
                valueText = normalize(nextRowCells.first().text());
              }
            }
          }
          
          // Check if value should be excluded (e.g., don't get eligibility criteria as summary)
          const shouldExclude = exclude.some(pattern => {
            try {
              const regex = new RegExp(pattern, 'i');
              return regex.test(valueText);
            } catch (err) {
              return false;
            }
          });
          
          if (!shouldExclude && valueText && valueText.length > 0) {
            found = true;
            value = valueText;
            return false; // Break
          }
        }
      });
      
      // Second try: Look in definition lists (dl/dt/dd)
      if (!found) {
        $('dl dt, dl dd').each((_, elem) => {
          if (found) return;
          
          const text = normalize($(elem).text());
          const matchesLabel = patterns.some(pattern => {
            try {
              const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\&/g, '&');
              const regex = new RegExp(`^${escapedPattern}[:：\\s]*$`, 'i');
              return regex.test(text);
            } catch (err) {
              return text.toLowerCase().includes(pattern.toLowerCase());
            }
          });
          
          if (matchesLabel) {
            const $dt = $(elem).is('dt') ? $(elem) : $(elem).prev('dt');
            const $dd = $(elem).is('dd') ? $(elem) : $dt.next('dd');
            
            if ($dd.length) {
              const valueText = normalize($dd.text());
              const shouldExclude = exclude.some(pattern => {
                try {
                  const regex = new RegExp(pattern, 'i');
                  return regex.test(valueText);
                } catch (err) {
                  return false;
                }
              });
              
              if (!shouldExclude && valueText && valueText.length > 0) {
                found = true;
                value = valueText;
                return false; // Break
              }
            }
          }
        });
      }
    } catch (err) {
      console.error('Error in getTableValue:', err.message);
    }
    
    return value || '';
  };
  
  // Extract fields using common JRCT label patterns (Japanese and English)
  const fields = {
    // Title - Use "Public Title" from the details (full title, not truncated)
    publicTitle: getTableValue(['Public Title', '公開タイトル', '公表タイトル']),
    scientificTitle: getTableValue(['Scientific Title', '学術的タイトル', '研究課題名']),
    
    // Basic information
    condition: getTableValue(['疾患名', '疾病名', 'Health Condition', 'Disease', 'Condition']),
    phase: getTableValue(['フェーズ', 'Phase', '臨床研究段階', '臨床段階', '研究段階']),
    status: getTableValue(['募集状況', '受付状況', 'Recruitment Status', 'Status', '研究状況']),
    studyType: getTableValue(['研究デザイン', '研究種別', 'Study Design', 'Design', '研究タイプ']),
    
    // Enrollment
    enrollment: getTableValue(['目標症例数', '症例数', '参加者数', 'Target Sample Size', 'Enrollment', 'Sample Size']),
    
    // Dates
    firstEnrollmentDate: getTableValue(['開始日', '登録日', 'First Enrollment Date', 'Start Date', '登録年月日']),
    completionDate: getTableValue(['完了予定日', '終了日', 'Completion Date', 'End Date', '完了日']),
    publishedDate: getTableValue(['公開日', '発表日', 'Published Date', 'Publication Date']),
    
    // Sponsor/Principal Investigator
    sponsor: getTableValue(['実施責任医師', 'Principal Investigator', 'PI', '責任医師']),
    sponsorInstitution: getTableValue(['実施機関', 'Sponsor', '実施医療機関', 'Sponsor Institution']),
    
    // Contacts - Extract from "Contact for Public Queries" section specifically
    // We'll extract these separately in a dedicated function below
    
    // Eligibility - JRCT has "Key inclusion & exclusion criteria" as a single field
    // We need to extract this as a whole and then split it into inclusion/exclusion
    // First try to get the combined "Key inclusion & exclusion criteria" field
    keyEligibilityCriteria: getTableValue([
      'Key inclusion & exclusion criteria', 
      'Key inclusion and exclusion criteria',
      'Key inclusion & exclusion',
      '適格基準・除外基準',
      '選択基準・除外基準',
      'Key inclusion',
      'Key exclusion'
    ]),
    // Then try individual fields (fallback if combined field doesn't exist)
    inclusionCriteria: getTableValue(['選択基準', '適格基準', 'Inclusion Criteria', 'Inclusion'], ['summary', 'description', '概要', '研究の概要', 'Key inclusion']),
    exclusionCriteria: getTableValue(['除外基準', 'Exclusion Criteria', 'Exclusion'], ['summary', 'description', '概要', '研究の概要', 'inclusion criteria', '適格基準', 'Key inclusion']),
    age: getTableValue(['Age Minimum', 'Age Maximum', '年齢', 'Age', '年齢範囲'], ['inclusion', 'exclusion', 'criteria', '適格', '除外']),
    gender: getTableValue(['性別', 'Gender', 'Sex'], ['inclusion', 'exclusion', 'criteria', '適格', '除外']),
    
    // Interventions
    intervention: getTableValue(['介入', '治療', 'Intervention', 'Treatment', '治療内容']),
    
    // Outcomes
    primaryOutcome: getTableValue(['主要評価項目', '主要エンドポイント', 'Primary Outcome', 'Primary Endpoint']),
    secondaryOutcome: getTableValue(['副次的評価項目', '副次エンドポイント', 'Secondary Outcome', 'Secondary Endpoint']),
    
    // Countries of Recruitment
    countriesOfRecruitment: getTableValue([
      'Countries of Recruitment（Except Japan）',
      'Countries of Recruitment (Except Japan)',
      'Countries of Recruitment',
      '参加国（日本を除く）',
      '参加国'
    ]),
  };
  
  // Extract contact information from "Contact for Public Queries" section
  // JRCT has two contact sections: "Contact for Scientific Queries" and "Contact for Public Queries"
  // We want the public one (for patients/public inquiries)
  const extractPublicContactInfo = () => {
    let contactName = '';
    let contactAffiliation = '';
    let contactAddress = '';
    let contactPhone = '';
    let contactEmail = '';
    
    try {
      // Strategy 1: Look for "Contact for Public Queries" in table rows
      // The structure is typically:
      // Row: "Contact for Public Queries" | (empty)
      // Row: "Name" | value
      // Row: "Affiliation" | value
      // Row: "Address" | value
      // Row: "Telephone" | value
      // Row: "E-mail" | value
      
      let foundPublicHeader = false;
      let rowsAfterPublicHeader = 0;
      const maxRowsToCheck = 10; // Don't check more than 10 rows after header
      
      $('table tr').each((_, row) => {
        const $row = $(row);
        const cells = $row.find('th, td');
        
        if (cells.length === 0) return;
        
        const firstCellText = normalize(cells.eq(0).text());
        const secondCellText = cells.length > 1 ? normalize(cells.eq(1).text()) : '';
        
        // Check if this row is the "Contact for Public Queries" header
        if (firstCellText.match(/^Contact\s+for\s+Public\s+Queries[:：\s]*$/i)) {
          foundPublicHeader = true;
          rowsAfterPublicHeader = 0;
          return; // Continue to next row
        }
        
        // If we found the header, extract contact fields from subsequent rows
        if (foundPublicHeader && rowsAfterPublicHeader < maxRowsToCheck) {
          rowsAfterPublicHeader++;
          
          // Extract Name
          if (firstCellText.match(/^Name[:：\s]*$/i) && secondCellText && !contactName) {
            contactName = secondCellText;
          }
          // Extract Affiliation
          else if (firstCellText.match(/^Affiliation[:：\s]*$/i) && secondCellText && !contactAffiliation) {
            contactAffiliation = secondCellText;
          }
          // Extract Address
          else if (firstCellText.match(/^Address[:：\s]*$/i) && secondCellText && !contactAddress) {
            contactAddress = secondCellText;
          }
          // Extract Telephone
          else if (firstCellText.match(/^Telephone[:：\s]*$/i) && secondCellText && !contactPhone) {
            contactPhone = secondCellText;
          }
          // Extract E-mail (can be "E-mail" or "Email")
          else if (firstCellText.match(/^E-?mail[:：\s]*$/i) && secondCellText && !contactEmail) {
            contactEmail = secondCellText;
          }
          
          // Stop if we hit the next major section header
          if (firstCellText.match(/^(?:Contact\s+for\s+Scientific|Recruitment|Study\s+Type|Age|Gender|Health\s+Condition|Intervention)/i)) {
            foundPublicHeader = false; // Stop extracting
            return false;
          }
        }
      });
      
      // Strategy 2: If we didn't find using Strategy 1, try looking in all tables
      // Check if we found at least some contact info - if not, try Strategy 2
      if (!contactName && !contactAffiliation && !contactPhone && !contactEmail && !contactAddress) {
        $('table').each((_, table) => {
          const $table = $(table);
          const tableText = normalize($table.text());
          
          // Check if this table contains "Contact for Public Queries"
          if (tableText.includes('Contact for Public Queries') || tableText.includes('Contact for Public')) {
            let inPublicSection = false;
            
            $table.find('tr').each((_, row) => {
              const $row = $(row);
              const cells = $row.find('th, td');
              
              if (cells.length < 2) return;
              
              const label = normalize(cells.eq(0).text());
              const value = normalize(cells.eq(1).text());
              
              // Check if this row starts the public section
              if (label.match(/^Contact\s+for\s+Public\s+Queries[:：\s]*$/i)) {
                inPublicSection = true;
                return;
              }
              
              // Extract fields while in public section
              if (inPublicSection) {
                if (label.match(/^Name[:：\s]*$/i) && value && !contactName) {
                  contactName = value;
                }
                else if (label.match(/^Affiliation[:：\s]*$/i) && value && !contactAffiliation) {
                  contactAffiliation = value;
                }
                else if (label.match(/^Address[:：\s]*$/i) && value && !contactAddress) {
                  contactAddress = value;
                }
                else if (label.match(/^Telephone[:：\s]*$/i) && value && !contactPhone) {
                  contactPhone = value;
                }
                else if (label.match(/^E-?mail[:：\s]*$/i) && value && !contactEmail) {
                  contactEmail = value;
                }
                
                // Stop if we hit next major section
                if (label.match(/^(?:Contact\s+for\s+Scientific|Recruitment|Study\s+Type|Age|Gender)/i)) {
                  return false;
                }
              }
            });
          }
        });
      }
    } catch (err) {
      console.error(`JRCT ${id}: Error extracting public contact info:`, err.message);
    }
    
    return { contactName, contactAffiliation, contactAddress, contactPhone, contactEmail };
  };
  
  // Extract public contact information
  const publicContact = extractPublicContactInfo();
  
  // Use Public Title as the main title (full title, not truncated)
  // Extract this early because it's used in phase extraction
  // Fallback to Scientific Title, then try extracting from HTML tags
  let title = fields.publicTitle || fields.scientificTitle || '';
  if (!title) {
    // Fallback: Extract title from HTML tags (legacy method)
    title = getText('h2, h1.title, .trial-title, .study-title, .detail-title');
    if (!title) {
      const titleTag = $('title').first().text();
      if (titleTag) {
        title = titleTag.replace(/ - .*/, '').replace(/臨床研究等提出・公開システム/, '').trim();
      }
    }
    if (!title) {
      title = getText('.container h2, .container h1');
    }
  }
  title = title || '';
  
  // Extract summary/description from various possible locations
  // CRITICAL: JRCT often doesn't have a real summary - it's usually just eligibility criteria
  // So we need to be very strict about what counts as a summary
  let rawSummary = getTableValue(['研究の概要', '概要', 'Study Summary', 'Summary'], 
                                  ['inclusion criteria', 'exclusion criteria', '適格基準', '除外基準', '選択基準', '^\d+\.\s*patients']) ||
                  getText('.summary, .description, .brief-summary, .trial-description, .study-summary') ||
                  $('meta[name="description"]').attr('content') ||
                  '';
  
  // STRICT filtering: If summary looks like eligibility criteria, reject it
  if (rawSummary) {
    const summaryLower = rawSummary.toLowerCase();
    const summaryNormalized = rawSummary.replace(/\s+/g, ' ').trim();
    
    // Strong indicators this is eligibility criteria, not summary:
    const isEligibilityCriteria = 
      // Contains eligibility keywords
      (summaryLower.includes('inclusion criteria') || 
       summaryLower.includes('exclusion criteria') ||
       summaryLower.includes('適格基準') ||
       summaryLower.includes('除外基準') ||
       summaryLower.includes('選択基準')) ||
      // Starts with numbered list of patients (typical eligibility format)
      /^\d+\.\s*patients?\s+(with|who|having)/i.test(summaryNormalized) ||
      // Contains multiple numbered items about patients (eligibility list)
      (/\d+\.\s*patients/i.test(summaryNormalized) && (summaryNormalized.match(/\d+\./g) || []).length >= 2) ||
      // Very short and contains eligibility-like patterns
      (summaryLower.length < 200 && /(eligible|criteria|基準)/i.test(summaryLower));
    
    if (isEligibilityCriteria) {
      rawSummary = ''; // Reject - this is eligibility criteria, not summary
    }
  }
  
  const summary = rawSummary || ''; // For JRCT, summary is often empty
  
  // Extract detailed description - same strict filtering
  let rawDetailedDescription = getTableValue(['詳細説明', '詳細', 'Detailed Description', 'Description'],
                                             ['inclusion criteria', 'exclusion criteria', '適格基準', '除外基準', '選択基準', '^\d+\.\s*patients']) ||
                              getText('.detailed-description, .full-description, .study-description') ||
                              '';
  
  // Filter out if it's eligibility criteria
  if (rawDetailedDescription) {
    const descLower = rawDetailedDescription.toLowerCase();
    const descNormalized = rawDetailedDescription.replace(/\s+/g, ' ').trim();
    
    const isEligibilityCriteria = 
      descLower.includes('inclusion criteria') || 
      descLower.includes('exclusion criteria') ||
      descLower.includes('適格基準') ||
      descLower.includes('除外基準') ||
      /^\d+\.\s*patients?\s+(with|who|having)/i.test(descNormalized) ||
      (/\d+\.\s*patients/i.test(descNormalized) && (descNormalized.match(/\d+\./g) || []).length >= 2);
    
    if (isEligibilityCriteria) {
      rawDetailedDescription = '';
    }
  }
  
  const detailedDescription = rawDetailedDescription || '';
  
  // Helper function to extract phase from text (fallback if not found in structured fields)
  const extractPhaseFromText = (text) => {
    if (!text) return '';
    
    const textNormalized = normalize(text);
    
    // Common phase patterns (case-insensitive)
    // Try to match in order of specificity (most specific first)
    
    // Combined phases: Phase I/II, Phase II/III, Phase 1/2, etc.
    const combinedPhaseMatch = textNormalized.match(/\bphase\s+([ivxlcdm]+|[1-4])\s*[/-]\s*([ivxlcdm]+|[1-4])\b/i);
    if (combinedPhaseMatch) {
      const phase1 = combinedPhaseMatch[1].toUpperCase();
      const phase2 = combinedPhaseMatch[2].toUpperCase();
      // Normalize numbers to roman numerals
      const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
      const p1 = numToRoman[phase1] || phase1;
      const p2 = numToRoman[phase2] || phase2;
      return `Phase ${p1}/${p2}`;
    }
    
    // Single phases: Phase I, Phase II, Phase III, Phase IV, Phase 1, Phase 2, etc.
    const singlePhaseMatch = textNormalized.match(/\bphase\s+([ivxlcdm]+|[1-4])\b/i);
    if (singlePhaseMatch) {
      let phaseStr = singlePhaseMatch[1].toUpperCase();
      // Normalize numbers to roman numerals
      const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
      if (numToRoman[phaseStr]) {
        phaseStr = numToRoman[phaseStr];
      }
      // Normalize lowercase i's to uppercase (ii -> II, iii -> III)
      phaseStr = phaseStr.replace(/i+/g, (match) => {
        const mapping = { 'i': 'I', 'ii': 'II', 'iii': 'III', 'iiii': 'IV' };
        return mapping[match.toLowerCase()] || match.toUpperCase();
      });
      return `Phase ${phaseStr}`;
    }
    
    // Japanese: フェーズI, フェーズII, フェーズIII, フェーズIV, フェーズ1, etc.
    const japanesePhaseMatch = textNormalized.match(/フェーズ\s*([ivxlcdm]+|[1-4]|[一二三四])/i);
    if (japanesePhaseMatch) {
      let phaseStr = japanesePhaseMatch[1];
      // Convert Japanese numbers to roman numerals
      const jpToRoman = { '一': 'I', '二': 'II', '三': 'III', '四': 'IV' };
      if (jpToRoman[phaseStr]) {
        phaseStr = jpToRoman[phaseStr];
      } else {
        // Normalize numbers to roman numerals
        const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
        phaseStr = numToRoman[phaseStr] || phaseStr.toUpperCase();
      }
      return `Phase ${phaseStr}`;
    }
    
    // Phase with qualifiers: Phase 1 trial, Phase II study, etc.
    const qualifiedPhaseMatch = textNormalized.match(/\bphase\s+([ivxlcdm]+|[1-4])\s+(?:trial|study|clinical|investigation)\b/i);
    if (qualifiedPhaseMatch) {
      let phaseStr = qualifiedPhaseMatch[1].toUpperCase();
      const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
      phaseStr = numToRoman[phaseStr] || phaseStr;
      return `Phase ${phaseStr}`;
    }
    
    // Standalone: I phase, II phase, etc. (less common)
    const standalonePhaseMatch = textNormalized.match(/\b([ivxlcdm]+|[1-4])\s+phase\b/i);
    if (standalonePhaseMatch) {
      let phaseStr = standalonePhaseMatch[1].toUpperCase();
      const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
      phaseStr = numToRoman[phaseStr] || phaseStr;
      return `Phase ${phaseStr}`;
    }
    
    return '';
  };
  
  // Extract phase from text fields if not found in structured field
  let extractedPhase = fields.phase || '';
  if (!extractedPhase) {
    // Try extracting from summary, detailed description, title, intervention, or study type
    const textsToSearch = [
      summary,
      detailedDescription,
      title,
      fields.intervention,
      fields.studyType
    ].filter(t => t && t.length > 0);
    
    for (const text of textsToSearch) {
      extractedPhase = extractPhaseFromText(text);
      if (extractedPhase) break;
    }
  }
  
  // Helper function to clean and filter eligibility criteria while preserving numbered list formatting
  const cleanEligibilityCriteria = (text) => {
    if (!text) return '';
    
    // Normalize whitespace but preserve line breaks for numbered lists
    let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove common prefixes/headers that might be duplicated (multiple times)
    // Remove "Inclusion Criteria:", "Exclusion Criteria:", etc. from the beginning
    cleaned = cleaned.replace(/^(inclusion\s+criteria|exclusion\s+criteria|適格基準|除外基準|選択基準)[:：\s]*/i, '');
    
    // Also remove these headers if they appear in the middle (duplicate headers)
    // But preserve line breaks
    cleaned = cleaned.replace(/\n\s*(inclusion\s+criteria|exclusion\s+criteria|適格基準|除外基準|選択基準)[:：\s]*\n/gi, '\n');
    cleaned = cleaned.replace(/\s+(inclusion\s+criteria|exclusion\s+criteria|適格基準|除外基準|選択基準)[:：\s]*\s+/gi, ' ');
    
    // Remove duplicate "Exclusion Criteria" headers that might appear in inclusion text
    // Pattern: "Exclusion Criteria" followed by a number or list item
    cleaned = cleaned.replace(/\bexclusion\s+criteria\s+(?:exclusion\s+criteria\s*)?\d+\./gi, '');
    cleaned = cleaned.replace(/\b除外基準\s*(?:除外基準\s*)?\d+\./g, '');
    
    // Normalize multiple consecutive line breaks to double line breaks (paragraph breaks in markdown)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Normalize Japanese separators to periods (but preserve line breaks)
    cleaned = cleaned.replace(/[。．]/g, '.');
    
    // Normalize bullet points (but keep numbered lists)
    cleaned = cleaned.replace(/[•\-\*]\s+/g, '- ');
    
    // Normalize semicolons to periods (but preserve line breaks for numbered lists)
    cleaned = cleaned.replace(/[;；]/g, '.');
    
    // Remove duplicate consecutive numbers (e.g., "23. 24. Text" -> "24. Text")
    // This happens when JRCT has overlapping numbering
    cleaned = cleaned.replace(/(\d+)\.\s+(\d+)\.\s+/g, '$2. ');
    
    // CRITICAL: Split numbered items that appear on the same line
    // We need to be aggressive about this - find ALL numbered items and put each on its own line
    // Pattern: "1. Item 2. Item 3. Item" -> "1. Item\n2. Item\n3. Item"
    // Use a more aggressive approach: find all numbered patterns and split them
    
    // First, split by numbered items - find all "NUMBER. " patterns
    // We'll process line by line to ensure numbered items are separated
    const lines = cleaned.split('\n');
    const processedLines = [];
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Check if this line contains multiple numbered items (e.g., "1. Text 2. Text 3. Text" or "1.Text 2.Text")
      // Handle both "1. " (with space) and "1." (without space) patterns
      const numberedItemPattern = /(\d+)\.(?:\s+|(?=\S))/g;
      const matches = [...line.matchAll(numberedItemPattern)];
      
      if (matches.length > 1) {
        // This line has multiple numbered items - split them
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const startIndex = match.index;
          const endIndex = i < matches.length - 1 ? matches[i + 1].index : line.length;
          
          // Extract the numbered item
          let numberedItem = line.substring(startIndex, endIndex).trim();
          
          // Ensure there's a space after the period for markdown compatibility
          numberedItem = numberedItem.replace(/^(\d+)\.([^\s])/, '$1. $2');
          
          if (numberedItem) {
            processedLines.push(numberedItem);
          }
        }
      } else {
        // Single item or no numbered items - keep as is, but ensure proper spacing for numbered items
        // If line starts with "NUMBER." (no space), add space: "1.Text" -> "1. Text"
        const numberedNoSpacePattern = /^(\d+)\.([^\s])/;
        if (numberedNoSpacePattern.test(line)) {
          line = line.replace(numberedNoSpacePattern, '$1. $2');
        }
        processedLines.push(line);
      }
    }
    
    // Rejoin with line breaks
    cleaned = processedLines.join('\n');
    
    // Also handle cases where numbered items are directly adjacent like "1.Item2.Item" (no space)
    // This handles cases like "1.Histologically2.Must" -> "1. Histologically\n2. Must"
    cleaned = cleaned.replace(/(\d+)\.([^\n\d\s]+?)(\d+)\./g, (match, num1, content, num2) => {
      return `${num1}. ${content.trim()}\n${num2}. `;
    });
    
    // Also handle numbered items that appear right after text without space (e.g., "text1.Item")
    // Pattern: non-digit, non-period, then number.letter -> "text\n1. Item"
    cleaned = cleaned.replace(/([^\n\d\.])(\d+)\.([^\s\n])/g, (match, before, num, after) => {
      // Only split if it looks like a numbered list item (number followed by capital letter or common pattern)
      if (/[A-Z]/.test(after) || after.length > 0) {
        return `${before}\n${num}. ${after}`;
      }
      return match;
    });
    
    // Ensure numbered items that appear after text/period are on new lines
    // Pattern: "text. 1. Item" or "text 1. Item" -> "text.\n\n1. Item"
    cleaned = cleaned.replace(/([^\n\d])\s+(\d+)\.\s+/g, '$1\n\n$2. ');
    
    // Now split by lines again and ensure proper formatting
    const finalLines = cleaned.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Rebuild ensuring numbered items are on separate lines
    let result = [];
    for (let i = 0; i < finalLines.length; i++) {
      const line = finalLines[i];
      const nextLine = finalLines[i + 1];
      const isNumbered = /^\d+\.\s+/.test(line);
      const nextIsNumbered = nextLine && /^\d+\.\s+/.test(nextLine);
      
      result.push(line);
      
      // Add line breaks based on content type
      if (i < finalLines.length - 1) {
        if (isNumbered && nextIsNumbered) {
          // Both are numbered items - single line break (no empty line)
          // Don't add empty line - join will add single \n
        } else {
          // Transition between numbered and non-numbered, or non-numbered sections
          // Add double line break (paragraph break)
          result.push('', '');
        }
      }
    }
    
    // Join lines with single line breaks
    cleaned = result.join('\n');
    
    // Critical fix: ensure numbered items in sequence have ONLY single line breaks (no empty lines)
    // Remove any empty lines between numbered items
    cleaned = cleaned.replace(/(\d+\.\s+[^\n]+)\n+\n*(\d+\.\s+)/g, '$1\n$2');
    
    // Clean up excessive line breaks (more than 2 consecutive becomes 2)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Remove leading/trailing line breaks
    cleaned = cleaned.replace(/^\n+|\n+$/g, '');
    
    return cleaned;
  };
  
  // Helper function to remove duplicates and filter incorrect exclusion criteria
  const filterExclusionCriteria = (inclusionText, exclusionText) => {
    if (!exclusionText) return exclusionText;
    
    // Terms that should NOT appear in exclusion criteria (subtypes, not disqualifiers)
    const subtypeTerms = [
      'clear cell', 'clear-cell', 'serous', 'endometrioid', 'mucinous', 
      'squamous', 'adenocarcinoma', 'neuroendocrine', 'papillary',
      'follicular', 'medullary', 'lobular', 'ductal'
    ];
    
    // Clean exclusion text (preserves line breaks for numbered lists)
    let filtered = cleanEligibilityCriteria(exclusionText);
    
    // Remove lines/items that contain subtype terms (these are inclusion characteristics, not exclusions)
    // Work with lines to preserve numbered list formatting
    const exclusionLines = filtered.split('\n')
      .map(line => line.trim())
      .filter(line => {
        if (!line || line.length < 3) return false;
        
        const lineLower = line.toLowerCase();
        
        // Filter out lines that are just subtype mentions without negation
        // Subtypes like "clear cell" shouldn't be exclusion criteria unless explicitly negated
        const isSubtypeOnly = subtypeTerms.some(subtype => {
          const regex = new RegExp(`\\b${subtype.replace('-', '[-\\s]?')}\\b`, 'i');
          // Check if subtype is mentioned, but only exclude if it's NOT part of a negation
          if (regex.test(lineLower)) {
            // If it's mentioned with negation words, keep it (e.g., "not clear cell", "excluding clear cell")
            // Also check if it's part of a proper exclusion statement (e.g., "Patients with... clear cell...")
            const hasNegation = lineLower.match(/without|no\s|not\s|exclud|except|other\s+than|other\s+types/i);
            const isExclusionStatement = lineLower.match(/patients?\s+with|patients?\s+who|patients?\s+having/i);
            // Keep if it's part of a proper exclusion statement OR has negation
            return !hasNegation && !isExclusionStatement;
          }
          return false;
        });
        
        if (isSubtypeOnly) {
          return false; // Exclude this line - it's not a proper disqualifier
        }
        
        return true;
      });
    
    filtered = exclusionLines.join('\n').trim();
    
    // If inclusion criteria exists, remove duplicate content from exclusion (preserve line breaks)
    if (inclusionText && filtered) {
      const inclusionLower = inclusionText.toLowerCase();
      const filteredLines = filtered.split('\n')
        .map(line => line.trim())
        .filter(line => {
          if (!line || line.length < 3) return false;
          
          // Check if this line is a duplicate of something in inclusion criteria
          const lineLower = line.toLowerCase();
          
          // Remove common stop words and get meaningful words
          const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'patients', 'patient'];
          const words = lineLower.split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
          
          // If most meaningful words in this exclusion line appear in inclusion, it's likely a duplicate
          if (words.length >= 2) {
            const matchingWords = words.filter(word => inclusionLower.includes(word));
            // If more than 60% of meaningful words match AND the phrase is similar, it's probably a duplicate
            const matchRatio = matchingWords.length / words.length;
            if (matchRatio > 0.6) {
              // Additional check: if the line is very similar to a phrase in inclusion, exclude it
              const lineNormalized = lineLower.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
              const inclusionNormalized = inclusionLower.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
              
              // If exclusion line is a substring of inclusion (or very similar), exclude it
              if (inclusionNormalized.includes(lineNormalized) || lineNormalized.length < 20) {
                return false; // Exclude as duplicate
              }
            }
          }
          
          return true;
        });
      
      filtered = filteredLines.join('\n').trim();
    }
    
    return filtered;
  };
  
  // Helper function to separate inclusion and exclusion criteria when they're mixed together
  const separateInclusionExclusion = (inclusionText, exclusionText) => {
    let cleanedInclusion = inclusionText || '';
    let cleanedExclusion = exclusionText || '';
    
    // Check if inclusion criteria contains exclusion criteria text
    // Pattern: "Inclusion Criteria: Exclusion Criteria 1." 
    // The exclusion is embedded in the inclusion field
    if (cleanedInclusion) {
      // First, check if the inclusion text contains "Exclusion Criteria" followed by a number
      // Pattern: "Inclusion Criteria: Exclusion Criteria 1." or "Inclusion Criteria Exclusion Criteria 1."
      const exclusionInInclusionPattern = /(?:inclusion\s+criteria[:：]?\s*)?exclusion\s+criteria[:：]?\s*(\d+)\./i;
      const exclusionMatch = cleanedInclusion.match(exclusionInInclusionPattern);
      
      if (exclusionMatch) {
        // Found "Exclusion Criteria" followed by a number in inclusion text
        // Split at where "Exclusion Criteria" starts (not the number)
        const exclusionStartPattern = /(?:inclusion\s+criteria[:：]?\s*)?exclusion\s+criteria[:：]?\s*\d+\./i;
        const exclusionStartMatch = cleanedInclusion.match(exclusionStartPattern);
        
        if (exclusionStartMatch && exclusionStartMatch.index !== undefined) {
          // Split at the exclusion criteria header
          const splitIndex = exclusionStartMatch.index;
          const beforeExclusion = cleanedInclusion.substring(0, splitIndex).trim();
          let afterExclusion = cleanedInclusion.substring(splitIndex + exclusionStartMatch[0].length).trim();
          
          // Clean up inclusion - remove "Inclusion Criteria:" header if present
          cleanedInclusion = beforeExclusion.replace(/^(?:inclusion\s+criteria|適格基準|選択基準)[:：\s]*/i, '').trim();
          
          // The afterExclusion part is the exclusion criteria (starts with "1.")
          if (afterExclusion && afterExclusion.length > 10) {
            // Remove any duplicate "Exclusion Criteria" header that might be in the exclusion text
            afterExclusion = afterExclusion.replace(/^(?:exclusion\s+criteria|除外基準)[:：\s]*/i, '').trim();
            
            // If exclusion criteria already exists from fields.exclusionCriteria, check for duplicates
            if (cleanedExclusion) {
              // Check if they're the same (normalized comparison)
              const existingLower = cleanedExclusion.toLowerCase().replace(/\s+/g, ' ');
              const newLower = afterExclusion.toLowerCase().replace(/\s+/g, ' ');
              
              // If they're very similar (>80% match), it's a duplicate
              if (existingLower === newLower || existingLower.includes(newLower.substring(0, 50)) || newLower.includes(existingLower.substring(0, 50))) {
                // Duplicate - keep existing but prefer the longer one
                if (afterExclusion.length > cleanedExclusion.length) {
                  cleanedExclusion = afterExclusion;
                }
              } else {
                // Different content - prefer the one from inclusion field (more accurate)
                cleanedExclusion = afterExclusion;
              }
            } else {
              // No existing exclusion - use the extracted one
              cleanedExclusion = afterExclusion;
            }
          }
        }
      } else {
        // Check for simpler pattern: "Inclusion Criteria: Exclusion Criteria" (without number)
        const simplePattern = /(?:inclusion\s+criteria[:：]?\s*)?exclusion\s+criteria[:：]?\s*(?=\d)/i;
        const simpleMatch = cleanedInclusion.match(simplePattern);
        
        if (simpleMatch && simpleMatch.index !== undefined) {
          // Split at "Exclusion Criteria"
          const splitIndex = simpleMatch.index + simpleMatch[0].length;
          const beforeExclusion = cleanedInclusion.substring(0, simpleMatch.index).trim();
          let afterExclusion = cleanedInclusion.substring(splitIndex).trim();
          
          // Clean up inclusion
          cleanedInclusion = beforeExclusion.replace(/^(?:inclusion\s+criteria|適格基準|選択基準)[:：\s]*/i, '').trim();
          
          // Clean up exclusion
          if (afterExclusion && afterExclusion.length > 10) {
            afterExclusion = afterExclusion.replace(/^(?:exclusion\s+criteria|除外基準)[:：\s]*/i, '').trim();
            if (!cleanedExclusion || afterExclusion.length > cleanedExclusion.length) {
              cleanedExclusion = afterExclusion;
            }
          }
        }
      }
      
      // Additional check: if inclusion text starts with "Exclusion Criteria" (wrong field), swap them
      if (cleanedInclusion && /^(?:exclusion\s+criteria|除外基準)/i.test(cleanedInclusion) && !cleanedExclusion) {
        cleanedExclusion = cleanedInclusion.replace(/^(?:exclusion\s+criteria|除外基準)[:：\s]*/i, '').trim();
        cleanedInclusion = '';
      }
    }
    
    // Clean up duplicate headers at the beginning
    cleanedInclusion = cleanedInclusion.replace(/^(?:inclusion\s+criteria|適格基準|選択基準)[:：\s]*/i, '').trim();
    cleanedExclusion = cleanedExclusion.replace(/^(?:exclusion\s+criteria|除外基準)[:：\s]*/i, '').trim();
    
    // Remove duplicate "Exclusion Criteria" headers that appear in the middle of exclusion text
    cleanedExclusion = cleanedExclusion.replace(/\bexclusion\s+criteria[:：]?\s*/gi, '').trim();
    cleanedExclusion = cleanedExclusion.replace(/^\d+\.\s*exclusion\s+criteria[:：]?\s*/i, '').trim();
    
    return { cleanedInclusion, cleanedExclusion };
  };
  
  // CRITICAL: JRCT has "Key inclusion & exclusion criteria" as a single field containing BOTH
  // We need to extract this first and split it properly
  let rawInclusion = fields.inclusionCriteria || '';
  let rawExclusion = fields.exclusionCriteria || '';
  
    // If we have the combined "Key inclusion & exclusion criteria" field, use that first
    if (fields.keyEligibilityCriteria && fields.keyEligibilityCriteria.trim().length > 0) {
      const combinedCriteria = fields.keyEligibilityCriteria;
      
      // The structure can be:
      // "Inclusion Criteria\n- item1\n- item2\nExclusion Criteria\n- item1\n- item2"
      // OR "Inclusion Criteria\t- item1\n- item2\nExclusion Criteria\t- item1\n- item2" (tab-separated in table)
      // Find where "Exclusion Criteria" starts (case-insensitive, handle whitespace variations)
      const exclusionHeaderPattern = /\bExclusion\s+Criteria\b/i;
      const exclusionMatch = combinedCriteria.match(exclusionHeaderPattern);
      
      if (exclusionMatch && exclusionMatch.index !== undefined) {
        // Split at "Exclusion Criteria" header
        const beforeExclusion = combinedCriteria.substring(0, exclusionMatch.index).trim();
        const afterExclusion = combinedCriteria.substring(exclusionMatch.index + exclusionMatch[0].length).trim();
        
        // Extract inclusion criteria (everything before "Exclusion Criteria")
        // Remove "Inclusion Criteria" header if present (handle tabs and colons)
        rawInclusion = beforeExclusion.replace(/^Inclusion\s+Criteria[:：\t\s]*/i, '').trim();
        
        // Extract exclusion criteria (everything after "Exclusion Criteria")
        // Remove any leading "Exclusion Criteria" header that might be duplicated
        rawExclusion = afterExclusion.replace(/^Exclusion\s+Criteria[:：\t\s]*/i, '').trim();
      } else {
        // No "Exclusion Criteria" header found - might be all inclusion
        rawInclusion = combinedCriteria.replace(/^Inclusion\s+Criteria[:：\t\s]*/i, '').trim();
      }
    } else {
      // No combined field - use individual fields, but validate them
    // Validate inclusion criteria - should NOT contain "Exclusion Criteria" at the start
    if (rawInclusion && /^(?:exclusion\s+criteria|除外基準)/i.test(rawInclusion)) {
      // Wrong field extracted - this is exclusion, not inclusion
      console.warn(`JRCT ${id}: Inclusion criteria field contains "Exclusion Criteria" - swapping`);
      // Swap if exclusion is empty
      if (!rawExclusion) {
        rawExclusion = rawInclusion;
        rawInclusion = '';
      }
    }
    
    // Validate exclusion criteria - should NOT contain "Inclusion Criteria" at the start
    if (rawExclusion && /^(?:inclusion\s+criteria|適格基準|選択基準)/i.test(rawExclusion)) {
      // Wrong field extracted - this might be inclusion
      console.warn(`JRCT ${id}: Exclusion criteria field contains "Inclusion Criteria" - checking`);
      // Only swap if inclusion is empty
      if (!rawInclusion) {
        rawInclusion = rawExclusion;
        rawExclusion = '';
      }
    }
  }
  
  // Update fields with extracted/validated values
  fields.inclusionCriteria = rawInclusion;
  fields.exclusionCriteria = rawExclusion;
  
  // Separate inclusion and exclusion criteria if they're still mixed together
  const { cleanedInclusion: separatedInclusion, cleanedExclusion: separatedExclusion } = 
    separateInclusionExclusion(fields.inclusionCriteria, fields.exclusionCriteria);
  
  // Clean the separated criteria
  let cleanedInclusion = cleanEligibilityCriteria(separatedInclusion);
  let cleanedExclusion = filterExclusionCriteria(cleanedInclusion, separatedExclusion);
  
  // Final check: Make sure inclusion and exclusion are actually different
  // If they're the same, something went wrong with separation
  if (cleanedInclusion && cleanedExclusion) {
    const inclusionNormalized = cleanedInclusion.toLowerCase().replace(/\s+/g, ' ').trim();
    const exclusionNormalized = cleanedExclusion.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // If they're identical or exclusion is a substring of inclusion, there's a problem
    if (inclusionNormalized === exclusionNormalized || 
        inclusionNormalized.includes(exclusionNormalized) && exclusionNormalized.length > 50) {
      console.warn(`JRCT ${id}: Inclusion and exclusion criteria appear to be the same - clearing exclusion`);
      cleanedExclusion = ''; // Clear exclusion if it's the same as inclusion
    } else if (exclusionNormalized.includes(inclusionNormalized) && inclusionNormalized.length > 50) {
      console.warn(`JRCT ${id}: Exclusion contains inclusion - this is wrong, clearing both and re-extracting`);
      // Both are mixed - try to extract from original fields again
      cleanedInclusion = cleanEligibilityCriteria(fields.inclusionCriteria || '');
      cleanedExclusion = filterExclusionCriteria(cleanedInclusion, fields.exclusionCriteria || '');
    }
  }
  
  // Ensure inclusion doesn't contain "Exclusion Criteria" header
  if (cleanedInclusion && /exclusion\s+criteria/i.test(cleanedInclusion)) {
    // Try to split again at exclusion criteria
    const exclusionMatch = cleanedInclusion.match(/exclusion\s+criteria[:：]?\s*\d+\./i);
    if (exclusionMatch && exclusionMatch.index > 50) {
      // Split at exclusion criteria
      cleanedInclusion = cleanedInclusion.substring(0, exclusionMatch.index).trim();
      if (!cleanedExclusion) {
        cleanedExclusion = cleanedInclusion.substring(exclusionMatch.index + exclusionMatch[0].length).trim();
        cleanedExclusion = filterExclusionCriteria(cleanedInclusion, cleanedExclusion);
      }
    }
  }
  
  // Ensure exclusion doesn't contain "Inclusion Criteria" header
  if (cleanedExclusion && /inclusion\s+criteria/i.test(cleanedExclusion)) {
    // Exclusion shouldn't contain inclusion - remove it
    cleanedExclusion = cleanedExclusion.replace(/inclusion\s+criteria[:：]?\s*/i, '').trim();
  }
  
  // Final validation: Make sure summary is not eligibility criteria
  // Double-check before returning
  const finalSummary = summary || detailedDescription || '';
  if (finalSummary) {
    const finalSummaryLower = finalSummary.toLowerCase();
    // If summary matches inclusion/exclusion criteria, it's wrong - clear it
    if (cleanedInclusion && finalSummaryLower.includes(cleanedInclusion.toLowerCase().substring(0, 50))) {
      console.warn(`JRCT ${id}: Summary appears to be inclusion criteria - clearing summary`);
      // Don't use this as summary - it's eligibility criteria
    } else if (cleanedExclusion && finalSummaryLower.includes(cleanedExclusion.toLowerCase().substring(0, 50))) {
      console.warn(`JRCT ${id}: Summary appears to be exclusion criteria - clearing summary`);
      // Don't use this as summary
    }
  }
  
  // Final validation: Make sure inclusion doesn't contain exclusion and vice versa
  // Check if cleaned inclusion still contains exclusion patterns (shouldn't after separation)
  if (cleanedInclusion && cleanedExclusion) {
    const inclusionLower = cleanedInclusion.toLowerCase();
    const exclusionLower = cleanedExclusion.toLowerCase();
    
    // If inclusion contains exclusion content, remove it
    if (inclusionLower.includes(exclusionLower.substring(0, Math.min(100, exclusionLower.length)))) {
      console.warn(`JRCT ${id}: Inclusion still contains exclusion content - removing from inclusion`);
      // Try to find and remove exclusion from inclusion
      const exclusionStart = inclusionLower.indexOf(exclusionLower.substring(0, 50));
      if (exclusionStart > 0) {
        cleanedInclusion = cleanedInclusion.substring(0, exclusionStart).trim();
      }
    }
    
    // If exclusion contains inclusion content, it's probably wrong - remove it
    if (exclusionLower.includes(inclusionLower.substring(0, Math.min(100, inclusionLower.length)))) {
      console.warn(`JRCT ${id}: Exclusion contains inclusion content - this might be wrong`);
      // Don't remove it completely, but warn
    }
  }
  
  // Combine eligibility criteria (inclusion + exclusion)
  // For JRCT, don't include demographics separately as they're already in inclusion criteria
  let eligibilityCriteria = '';
  if (cleanedInclusion || cleanedExclusion) {
    if (cleanedInclusion) {
      // Make sure inclusion doesn't start with "Exclusion Criteria"
      const inclusionCleaned = cleanedInclusion.replace(/^(?:exclusion\s+criteria|除外基準)[:：\s]*/i, '').trim();
      eligibilityCriteria += '**Inclusion Criteria:**\n' + inclusionCleaned;
    }
    if (cleanedExclusion) {
      // Make sure exclusion doesn't start with "Inclusion Criteria"
      const exclusionCleaned = cleanedExclusion.replace(/^(?:inclusion\s+criteria|適格基準|選択基準)[:：\s]*/i, '').trim();
      // Remove duplicate "Exclusion Criteria" headers
      const exclusionFinal = exclusionCleaned.replace(/^(?:exclusion\s+criteria|除外基準)[:：\s]*/i, '').trim();
      eligibilityCriteria += (eligibilityCriteria ? '\n\n' : '') + '**Exclusion Criteria:**\n' + exclusionFinal;
    }
  }
  
  // Note: For JRCT trials, age/gender are typically already in inclusion criteria
  // We do NOT add a separate Demographics section in eligibility criteria for JRCT
  
  // Extract participating facilities/hospitals
  // Try multiple approaches to find facility information
  const facilities = [];
  const facilityTexts = new Set();
  
  // Approach 1: Look for facility-specific tables/sections
  const facilitySelectors = [
    'table.facilities tr td',
    '.facilities li, .facility-list li',
    'table:has(th:contains("施設")), table:has(th:contains("医療機関")) tr td',
    '.institution, .hospital, .facility'
  ];
  
  facilitySelectors.forEach(selector => {
    try {
      $(selector).each((_, elem) => {
        const text = normalize($(elem).text());
        // Filter out header rows and short/irrelevant text
        if (text && text.length > 5 && 
            !text.match(/施設名|医療機関名|実施医療機関|Name|Name of/i) &&
            !facilityTexts.has(text)) {
          
          // Check if it contains hospital/facility indicators
          if (text.match(/病院|大学|医療|診療|クリニック|施設|医院|病院|大学病院|医科大学|総合病院|国立|公立|私立/i) ||
              text.match(/都|道|府|県|市|区|町|村|〒/)) {
            facilities.push(text);
            facilityTexts.add(text);
          }
        }
      });
    } catch (err) {
      // Skip if selector fails
    }
  });
  
  // Approach 2: Look in all table cells for facility-like patterns
  if (facilities.length === 0) {
    $('table td, table th').each((_, elem) => {
      const text = normalize($(elem).text());
      const headerText = normalize($(elem).closest('table').find('th, tr:first-child td').text());
      
      // If this looks like a facility row (not a header)
      if (text && text.length > 10 && 
          !headerText.match(/施設名|医療機関名|実施医療機関|Name/i) &&
          (text.match(/病院|大学|医療|診療|クリニック|施設|医院/i) || 
           text.match(/都|道|府|県|市|区|町|村/) ||
           text.match(/〒/))) {
        if (!facilityTexts.has(text)) {
          facilities.push(text);
          facilityTexts.add(text);
        }
      }
    });
  }
  
  // Extract locations from facilities
  const locations = facilities.length > 0 ? facilities.map(facility => {
    // Try to parse Japanese address format: Prefecture + City + Address
    let city = '';
    let prefecture = '';
    let address = facility;
    
    // Extract prefecture (都道府県)
    const prefectureMatch = facility.match(/([東京都|大阪府|京都府|北海道]|[^\s]*[都道府県])/);
    if (prefectureMatch) {
      prefecture = prefectureMatch[1];
    }
    
    // Extract city (usually after prefecture)
    const cityMatch = facility.match(/[都道府県]\s*([^\s]*[市区町村])/);
    if (cityMatch) {
      city = cityMatch[1];
    }
    
    return {
      facility: facility,
      city: city || '',
      state: prefecture || '', // Use prefecture as state equivalent
      country: 'Japan',
      address: facility,
      raw: facility
    };
  }) : [];
  
  // Default to Japan if no facilities found
  if (locations.length === 0) {
    locations.push({
      facility: fields.sponsorInstitution || 'Japan',
      city: '',
      state: '',
      country: 'Japan',
      address: fields.sponsorInstitution || 'Japan'
    });
  }
  
  // Map JRCT status from Japanese to English (matching ClinicalTrials.gov format - all caps)
  const statusMap = {
    '募集中': 'RECRUITING',
    '受付中': 'RECRUITING',
    '継続中': 'ONGOING',
    '終了': 'COMPLETED',
    '中止': 'TERMINATED',
    '未開始': 'NOT_YET_RECRUITING',
    '中断': 'SUSPENDED',
    '審査中': 'REVIEWING'
  };
  const normalizedStatus = statusMap[fields.status] || fields.status || 'UNKNOWN';
  
  // Validate age/gender - make sure they're actually demographics, not exclusion criteria
  // Age should be a range or number, gender should be male/female/etc
  let validatedAge = fields.age || '';
  let validatedGender = fields.gender || '';
  
  // Check if age field contains exclusion criteria (wrong field extracted)
  if (validatedAge && (validatedAge.toLowerCase().includes('exclusion') || 
                       validatedAge.toLowerCase().includes('除外') ||
                       validatedAge.toLowerCase().includes('patients with') ||
                       /^\d+\.\s*patients/i.test(validatedAge))) {
    console.warn(`JRCT ${id}: Age field contains exclusion criteria - clearing age`);
    validatedAge = '';
  }
  
  // Check if gender field contains exclusion criteria (wrong field extracted)
  if (validatedGender && (validatedGender.toLowerCase().includes('exclusion') || 
                          validatedGender.toLowerCase().includes('除外') ||
                          validatedGender.toLowerCase().includes('patients with') ||
                          /^\d+\.\s*patients/i.test(validatedGender))) {
    console.warn(`JRCT ${id}: Gender field contains exclusion criteria - clearing gender`);
    validatedGender = '';
  }
  
  // Age should look like a number/range (18+, 18-65, etc.), not eligibility criteria
  if (validatedAge && !validatedAge.match(/^\d+[-\s]*(?:and\s*older|years?|歳|歳以上|\d+|up)/i) && 
      validatedAge.length > 50) {
    // Too long to be age - probably wrong field
    validatedAge = '';
  }
  
  // Gender should be short (male, female, all, etc.), not eligibility criteria
  if (validatedGender && validatedGender.length > 30) {
    // Too long to be gender - probably wrong field
    validatedGender = '';
  }
  
  // Build comprehensive trial data object matching ClinicalTrials.gov format
  return {
    id,
    source: 'JRCT',
    title: title || '', // Full Public Title (will be truncated by CSS line-clamp-2 if needed)
    titleJa: title, // Can be refined if separate Japanese title exists
    conditions: fields.condition ? [fields.condition] : [],
    status: normalizedStatus,
    statusJa: fields.status || '',
    phase: extractedPhase || '',
    // For JRCT, summary is often empty (they don't have a separate summary field)
    // Only use summary if it's not eligibility criteria
    summary: summary || '',
    summaryJa: summary || '',
    detailedDescription: detailedDescription || '',
    eligibilityCriteria: eligibilityCriteria || '',
    eligibilityCriteriaJa: eligibilityCriteria || '',
    eligibility: eligibilityCriteria ? { criteria: eligibilityCriteria } : undefined,
    locations: locations,
    facilities: facilities, // Raw facility list for reference
    sponsor: fields.sponsor || fields.sponsorInstitution || '',
    sponsorInstitution: fields.sponsorInstitution || fields.sponsor || '',
    enrollment: fields.enrollment || '',
    studyType: fields.studyType || '',
    intervention: fields.intervention || '',
    primaryOutcome: fields.primaryOutcome || '',
    secondaryOutcome: fields.secondaryOutcome || '',
    firstEnrollmentDate: fields.firstEnrollmentDate || '',
    completionDate: fields.completionDate || '',
    publishedDate: fields.publishedDate || '',
    contactName: publicContact.contactName || fields.contactName || '',
    contactAffiliation: publicContact.contactAffiliation || '',
    contactAddress: publicContact.contactAddress || '',
    contactPhone: publicContact.contactPhone || fields.contactPhone || '',
    contactEmail: publicContact.contactEmail || fields.contactEmail || '',
    age: validatedAge || '',
    gender: validatedGender || '',
    inclusionCriteria: cleanedInclusion || '',
    exclusionCriteria: cleanedExclusion || '',
    // Countries of Recruitment: Parse the field and add Japan
    countriesOfRecruitment: (() => {
      const countriesStr = fields.countriesOfRecruitment || '';
      if (!countriesStr) {
        return ['Japan']; // Default to Japan only
      }
      // Parse countries (split by "/" or ",")
      const countries = countriesStr
        .split(/[/,、]/)
        .map(c => c.trim())
        .filter(c => c.length > 0 && c.toLowerCase() !== 'none' && c.toLowerCase() !== 'n/a');
      // Always include Japan for JRCT trials
      if (!countries.some(c => c.toLowerCase().includes('japan'))) {
        countries.push('Japan');
      }
      return countries;
    })(),
    url: `https://jrct.mhlw.go.jp/en-latest-detail/${id}`, // Prefer English URL
    urlJa: `https://jrct.mhlw.go.jp/latest-detail/${id}`, // Japanese URL as fallback
    country: 'Japan'
  };
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = normalize(req.query.id);
  const q = normalize(req.query.q || ''); // Main disease - optional, only needed if tokenData not provided
  const term = normalize(req.query.term || req.query.subtype || ''); // Subtype/keywords - optional
  const page = parseInt(String(req.query.page || '1'), 10) || 1;
  
  // NEW: Accept token data directly from search results (avoids rebuilding search page)
  let tokenData = null;
  try {
    if (req.query.tokenData) {
      tokenData = JSON.parse(decodeURIComponent(req.query.tokenData));
    }
  } catch (e) {
    // Invalid token data, will fall back to search page method
    console.warn('Invalid tokenData provided, will use search page method:', e.message);
  }

  if (!id) return res.status(400).json({ error: 'Missing query param: id' });

  try {
    const ua = req.headers['user-agent'] || 'CancerCareProxy/1.0';
    let detailResp;
    let extracted = null;

    // METHOD 1: Use provided token data directly (preferred - faster and more reliable)
    if (tokenData && tokenData['_Token[fields]']) {
      // Get action URL from detailUrl if provided, otherwise construct it
      // PREFER English version if available
      let detailUrl = req.query.detailUrl || `${ORIGIN}/latest-detail/${id}`;
      
      // If detailUrl doesn't specify language, try English version first
      if (!detailUrl.includes('/en-') && !detailUrl.includes('/latest-detail/')) {
        // Try English version first
        detailUrl = `${ORIGIN}/en-latest-detail/${id}`;
      } else if (detailUrl.includes('/latest-detail/') && !detailUrl.includes('/en-')) {
        // Convert to English if it's the Japanese version
        detailUrl = detailUrl.replace('/latest-detail/', '/en-latest-detail/');
      }
      
      let actionUrl;
      try {
        actionUrl = detailUrl.startsWith('http') ? detailUrl : new URL(detailUrl, ORIGIN).toString();
      } catch (e) {
        actionUrl = `${ORIGIN}/en-latest-detail/${id}`; // Default to English
      }

      // Establish session first (still need cookies)
      let sessionCookies = '';
      try {
        const sessionResponse = await axios.get(`${ORIGIN}/search`, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en,ja;q=0.9', // Prefer English
            'User-Agent': ua,
            'Referer': `${ORIGIN}/`
          },
          timeout: 40000,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400
        });
        const cookies = sessionResponse.headers['set-cookie'] || [];
        sessionCookies = cookies.map(c => c.split(';')[0]).join('; ');
      } catch (sessionErr) {
        console.warn('Failed to establish session, continuing without cookies:', sessionErr.message);
      }

      // POST directly with stored token data - try English version first
      const postBody = new URLSearchParams(tokenData);
      
      try {
        // Try English version first
        detailResp = await axios.post(actionUrl, postBody.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en,ja;q=0.9', // Prefer English
            'User-Agent': ua,
            'Origin': ORIGIN,
            'Referer': `${ORIGIN}/search`,
            ...(sessionCookies && { 'Cookie': sessionCookies })
          },
          timeout: 40000,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400
        });
      } catch (postErr) {
        // If English version fails, try Japanese version
        if (actionUrl.includes('/en-latest-detail/')) {
          console.warn('English detail page failed, trying Japanese version:', postErr.message);
          const japaneseUrl = actionUrl.replace('/en-latest-detail/', '/latest-detail/');
          try {
            detailResp = await axios.post(japaneseUrl, postBody.toString(), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en;q=0.9',
                'User-Agent': ua,
                'Origin': ORIGIN,
                'Referer': `${ORIGIN}/search`,
                ...(sessionCookies && { 'Cookie': sessionCookies })
              },
              timeout: 40000,
              maxRedirects: 5,
              validateStatus: (status) => status >= 200 && status < 400
            });
          } catch (japaneseErr) {
            // Both failed, fall through to METHOD 2
            console.warn('Both English and Japanese detail pages failed, trying search page method:', japaneseErr.message);
            tokenData = null; // Force fallback
          }
        } else {
          // Original error was not English version, fall through to METHOD 2
          console.warn('Direct POST with stored token failed, trying search page method:', postErr.message);
          tokenData = null; // Force fallback
        }
      }
    }

    // METHOD 2: Rebuild search page and extract token (fallback)
    if (!detailResp && (!tokenData || !tokenData['_Token[fields]'])) {
      if (!q) {
        return res.status(400).json({ 
          error: 'Missing required params',
          message: 'Either tokenData (from search results) or q (search query) must be provided to fetch trial details'
        });
      }

          // 1) load search HTML to get the correct hidden form token AND session cookies
          const { html: searchHtml, target: searchUrl, cookies: sessionCookies } = await fetchSearchHtml({ q, term, page, userAgent: ua });

      // 2) extract the correct tokened hidden form for that id
      extracted = extractDetailPostForm(searchHtml, id);
      if (!extracted) {
        // Check if trial exists in search results for better error message
        const $ = cheerio.load(searchHtml);
        const foundIds = [];
        $('table.table-search tbody tr td:first-child').each((_, td) => {
          const trialId = normalize($(td).text());
          if (trialId && trialId.match(/^jRCT/i)) {
            foundIds.push(trialId);
          }
        });
        
        const idInResults = foundIds.some(foundId => 
          foundId.toLowerCase() === id.toLowerCase() || 
          foundId.replace(/^jRCT/i, 'jRCT') === id.replace(/^jRCT/i, 'jRCT')
        );
        
        return res.status(404).json({
          error: 'Could not find detail form for id on search page',
          message: idInResults
            ? `Trial ${id} was found in search results but the detail form could not be extracted. This may be a parsing issue or the trial detail page is not accessible.`
            : `Trial ID ${id} not found in search results for query "${q}". The query may not return this trial, or the trial may not exist in JRCT. Try using a different search query or verify the trial ID is correct.`,
          debug: {
            id,
            q,
            page,
            searchUrl,
            idFoundInSearchResults: idInResults,
            foundTrialIds: foundIds.slice(0, 10),
            suggestion: idInResults
              ? 'Trial found but form extraction failed. Try using the tokenData from search results instead.'
              : `Trial ${id} not found in search results. Try searching for this specific trial ID or use a query that matches this trial.`
          }
        });
      }

      // 3) POST to /en-latest-detail/<id> (English) or /latest-detail/<id> (Japanese) with the token fields AND session cookies
      // PREFER English version - try it first, fallback to Japanese if it fails
      let detailActionUrl = extracted.actionUrl;
      
      // Convert to English version if it's Japanese
      if (detailActionUrl.includes('/latest-detail/') && !detailActionUrl.includes('/en-')) {
        detailActionUrl = detailActionUrl.replace('/latest-detail/', '/en-latest-detail/');
      }
      
      // Try English version first
      try {
        detailResp = await axios.post(detailActionUrl, extracted.postBody.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en,ja;q=0.9', // Prefer English content
            'User-Agent': ua,
            'Origin': ORIGIN,
            'Referer': searchUrl,
            ...(sessionCookies && { 'Cookie': sessionCookies })
          },
          timeout: 40000,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400
        });
      } catch (englishErr) {
        // English version failed, try Japanese version as fallback
        console.warn(`English detail page (${detailActionUrl}) failed, trying Japanese version:`, englishErr.message);
        const japaneseUrl = extracted.actionUrl.includes('/en-') 
          ? extracted.actionUrl.replace('/en-latest-detail/', '/latest-detail/')
          : extracted.actionUrl;
        
        try {
          detailResp = await axios.post(japaneseUrl, extracted.postBody.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'ja,en;q=0.9', // Fallback to Japanese
              'User-Agent': ua,
              'Origin': ORIGIN,
              'Referer': searchUrl,
              ...(sessionCookies && { 'Cookie': sessionCookies })
            },
            timeout: 40000,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400
          });
        } catch (japaneseErr) {
          // Both failed - re-throw the original English error
          throw englishErr;
        }
      }
    }

    // Check if JRCT returned an error page
    if (typeof detailResp.data === 'string' && detailResp.data.includes('An Internal Error Has Occurred')) {
      // The trial ID might not be in the search results for this query
      // Check if the trial exists in the search results we fetched
      const $ = cheerio.load(searchHtml);
      const foundIds = [];
      $('table.table-search tbody tr td:first-child').each((_, td) => {
        const trialId = normalize($(td).text());
        if (trialId && trialId.match(/^jRCT/i)) {
          foundIds.push(trialId);
        }
      });
      
      const idInResults = foundIds.includes(id);
      
      return res.status(502).json({
        error: 'JRCT server returned an internal error',
        message: idInResults
          ? `JRCT returned an internal error for trial ${id} even though it was found in search results. This may be a temporary JRCT server issue, invalid token, or the trial may have been removed.`
          : `JRCT returned an internal error. Trial ${id} was NOT found in the search results for query "${q}". The trial may not exist, or you may need to use a different search query that returns this trial.`,
        debug: {
          id,
          q,
          page,
          fetchedFrom: extracted.actionUrl,
          status: detailResp.status,
          idFoundInSearchResults: idInResults,
          foundTrialIds: foundIds.slice(0, 20), // Show first 20 IDs found
          suggestion: idInResults
            ? 'Trial was found in search results but JRCT server error occurred. Try again later or visit the JRCT website directly.'
            : `Trial ${id} not found in search results for query "${q}". Try searching for this specific trial ID or use a query that matches this trial.`
        }
      });
    }

    // Parse HTML to extract comprehensive trial information
    try {
      const parsedData = parseJRCTDetail(detailResp.data, id);
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        id,
        fetchedFrom: extracted?.actionUrl || 'Direct POST with stored token',
        ...parsedData
      });
    } catch (parseError) {
      console.error('Error parsing JRCT detail:', parseError.message);
      console.error('Stack:', parseError.stack);
      
      // Return error response with debug info
      return res.status(500).json({
        error: 'Failed to parse JRCT detail page',
        message: parseError.message,
        debug: {
          id,
          q: q || 'N/A (used stored token)',
          page,
          fetchedFrom: extracted?.actionUrl || 'Direct POST with stored token',
          errorType: parseError.name,
          usedStoredToken: !!tokenData
        }
      });
    }
  } catch (err) {
    // Handle different types of errors
    let status = 502;
    let errorMessage = err?.message || 'Unknown error';
    
    if (err?.response) {
      // HTTP error response
      status = err.response.status || 502;
      if (err.response.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data.substring(0, 500);
        } else {
          try {
            errorMessage = JSON.stringify(err.response.data).substring(0, 500);
          } catch {
            errorMessage = 'Invalid error response format';
          }
        }
      }
    } else if (err?.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      // Timeout error
      status = 504;
      errorMessage = 'Request timeout - JRCT server took too long to respond';
    } else if (err.message?.includes('Network')) {
      // Network error
      status = 503;
      errorMessage = 'Network error - could not connect to JRCT server';
    }
    
    return res.status(status).json({
      error: 'JRCT detail fetch failed',
      message: errorMessage,
      debug: {
        id,
        q,
        page,
        status,
        errorType: err?.name || 'Unknown',
        errorCode: err?.code || null
      }
    });
  }
};