// api/jrct/search.js
const axios = require('axios');
const cheerio = require('cheerio');

const ORIGIN = 'https://jrct.mhlw.go.jp';

function normalize(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function safeInt(v, fallback = 1) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Disable caching for search results - always get fresh data from JRCT
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function parseResults(html, filterRecruiting = false) {
  try {
    const $ = cheerio.load(html);

    const rows = $('table.table-search tbody tr');
    const results = [];

    rows.each((_, tr) => {
      try {
        const tds = $(tr).find('td');
        if (tds.length < 5) {
          return;
        }

        const id = normalize($(tds.eq(0)).text());
        const title = normalize($(tds.eq(1)).text());
        const condition = normalize($(tds.eq(2)).text());
        const status = normalize($(tds.eq(3)).text());
        const published = tds.length >= 5 ? normalize($(tds.eq(4)).text()) : '';
        // Last column (index 5 or 6) contains the "閲覧" (View) button with the form

        // Skip if no ID
        if (!id || !id.trim()) {
          return;
        }
        
        // Filter for recruiting studies only (default behavior)
        // Note: We're already filtering at the form level with reg_recruitment[]=2,
        // so this is a double-check. However, if the form filter isn't working properly
        // or status field format changed, this ensures we still filter correctly.
        // Only include: 募集中 (Recruiting), 受付中 (Accepting)
        // Exclude: 募集前 (Not yet recruiting), 募集中断 (Suspended), 募集終了 (Completed), 終了 (Terminated), 中止 (Discontinued)
        if (filterRecruiting) {
          const statusLower = (status || '').toLowerCase();
          const isRecruiting = status.includes('募集中') || 
                              status.includes('受付中') || 
                              statusLower.includes('recruiting') ||
                              statusLower.includes('active');
          
          // Exclude completed, terminated, suspended, or not yet recruiting
          const isExcluded = status.includes('募集前') || 
                            status.includes('募集中断') || 
                            status.includes('募集終了') || 
                            status.includes('終了') ||
                            status.includes('中止') ||
                            statusLower.includes('completed') ||
                            statusLower.includes('terminated') ||
                            statusLower.includes('suspended') ||
                            statusLower.includes('not yet');
          
          if (!isRecruiting || isExcluded) {
            return; // Skip non-recruiting trials
          }
        }

        // Find the hidden POST form for this ID
        // The form is likely in the last column (Details column) where the "閲覧" button is
        // Try multiple approaches to find the form
        let form = null;
        let action = null;
        let tokenData = null;
        
        // Approach 1: Look for form in the last column (Details column) first
        const lastTd = tds.eq(tds.length - 1);
        form = lastTd.find(`form[action*="/latest-detail/"], form[action*="/en-latest-detail/"]`);
        
        // Approach 2: Look in the entire row
        if (!form || !form.length) {
          form = $(tr).find(`form[action*="/latest-detail/${id}"], form[action*="/en-latest-detail/${id}"]`);
        }
        
        // Approach 3: Look for any form in the row (might not have ID in action)
        if (!form || !form.length) {
          form = $(tr).find('form[action*="/latest-detail/"], form[action*="/en-latest-detail/"]');
        }
        
        // Approach 4: Try finding form by button onclick handler (button might reference form by name)
        if (!form || !form.length) {
          const viewButton = $(tr).find('button, a, input[type="button"]').filter((_, btn) => {
            const text = normalize($(btn).text());
            const onclick = $(btn).attr('onclick') || '';
            return text.includes('閲覧') || text.includes('View') || onclick.includes('latest-detail') || onclick.includes(id);
          }).first();
          
          if (viewButton.length) {
            // Try to find form referenced in onclick
            const onclick = viewButton.attr('onclick') || '';
            const formNameMatch = onclick.match(/document\.(\w+)\.submit/);
            if (formNameMatch) {
              const formName = formNameMatch[1];
              form = $(`form[name="${formName}"]`);
            }
            // Also check if form is in the same parent as button
            if (!form || !form.length) {
              form = viewButton.closest('td, tr').find('form[action*="/latest-detail/"]');
            }
          }
        }
        
        // Approach 5: Last resort - try globally (less reliable)
        if (!form || !form.length) {
          form = $(`form[action*="/latest-detail/${id}"], form[action*="/en-latest-detail/${id}"]`).first();
        }
        
        // Extract form data if found
        if (form && form.length > 0) {
          const $form = form.first();
          const formAction = $form.attr('action');
          
          if (formAction) {
            try {
              // Extract action URL - use English version if available
              if (formAction.includes(id)) {
                // Form action contains the ID - convert to English version
                let englishAction = formAction.replace('/latest-detail/', '/en-latest-detail/');
                if (!englishAction.includes('/en-')) {
                  englishAction = formAction;
                }
                action = new URL(englishAction, ORIGIN).toString();
              } else {
                // Form action might be relative, construct it - use English version
                const actionId = formAction.match(/\/(?:en-)?latest-detail\/([^\/\?"]+)/)?.[1] || id;
                action = new URL(`/en-latest-detail/${actionId}`, ORIGIN).toString();
              }
              
              // Extract token data from the form
              const _method = $form.find('input[name="_method"]').attr('value') || 'POST';
              let tokenFields = $form.find('input[name="_Token[fields]"]').attr('value') || '';
              let tokenUnlocked = $form.find('input[name="_Token[unlocked]"]').attr('value') || '';
              
              // If token fields are empty, check nested divs (forms might be wrapped)
              if (!tokenFields && !tokenUnlocked) {
                const tokenContainer = $form.find('div[style*="display:none"], div[style*="display: none"]');
                if (tokenContainer.length) {
                  tokenFields = tokenContainer.find('input[name="_Token[fields]"]').attr('value') || '';
                  tokenUnlocked = tokenContainer.find('input[name="_Token[unlocked]"]').attr('value') || '';
                }
              }
              
              // If still empty, search in parent elements
              if (!tokenFields && !tokenUnlocked) {
                const tokenInputs = $form.closest('tr, td, div, form, body').find('input[name*="Token"]');
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
              
              // Store token data if we found it
              if (tokenFields || tokenUnlocked) {
                tokenData = {
                  _method,
                  '_Token[fields]': tokenFields,
                  '_Token[unlocked]': tokenUnlocked
                };
              }
            } catch (e) {
              console.error('Error parsing form action URL:', e.message);
            }
          }
        }

        results.push({
          id,
          title,
          condition,
          status,
          published,
          detailUrl: action,
          tokenData: tokenData // Store token data for later use (null if not found)
        });
      } catch (err) {
        // Skip this row if there's an error parsing it
        console.error('Error parsing row:', err.message);
      }
    });

    // Total count message: "3961件検索完了しました。" (Japanese) or "3961 search results completed." (English)
    let total = null;
    try {
      const alertText = normalize($('div[role="alert"]').text());
      // Try Japanese format: "3961件検索完了しました。"
      let totalMatch = alertText.match(/(\d+)\s*件/);
      if (!totalMatch) {
        // Try English format: "3961 search results completed" or "3961 results found"
        totalMatch = alertText.match(/(\d+)\s*(?:search\s*results?|results?)/i);
      }
      if (totalMatch) {
        total = parseInt(totalMatch[1], 10);
      }
    } catch (err) {
      // Total count is optional
    }

    // Pagination: current + next links
    const pages = [];
    try {
      $('ul.pagination a.page-link').each((_, a) => {
        try {
          const href = $(a).attr('href');
          const label = normalize($(a).text());
          if (!href || href === '#') return;
          const pageUrl = new URL(href, ORIGIN).toString();
          pages.push({ label, href: pageUrl });
        } catch (err) {
          // Skip invalid pagination links
        }
      });
    } catch (err) {
      // Pagination is optional
    }

    return { total, results, pages };
  } catch (err) {
    console.error('Error parsing HTML:', err.message);
    throw new Error(`Failed to parse JRCT results: ${err.message}`);
  }
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Get query parameters
  // 'q' = main disease/condition (goes in reg_plobrem_1 - disease field)
  // 'term' = subtype/keywords (goes in demo_1 - keyword search field, optional)
  // Search parameters: disease in reg_plobrem_1, keyword/subtype in demo_1, recruiting filter enabled
  const rawQuery = req.query.q || req.query.query || '';
  const q = normalize(rawQuery); // Main disease
  const rawTerm = req.query.term || req.query.subtype || '';
  // Normalize and lowercase keyword for better matching with JRCT database
  // JRCT keyword search appears to work better with lowercase terms
  let term = normalize(rawTerm);
  if (term) {
    term = term.toLowerCase(); // Convert to lowercase for better matching
  }
  const page = safeInt(req.query.page, 1);
  // Always filter for recruiting studies (user requirement)
  const filterRecruiting = req.query.filterRecruiting !== 'false' && req.query.filterRecruiting !== '0'; // Default true

  // If q (disease) is empty or only whitespace after normalization, return error
  // term (subtype) is optional, so we don't check it
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ 
      error: 'Missing or empty query param: q',
      message: 'Query parameter "q" (disease/condition) is required and cannot be empty. Use "term" parameter for subtype/keywords (optional).'
    });
  }

  try {
    // First, GET the search page with language=en parameter to set English session
    // The English button on JRCT site submits with language=en parameter
    const searchPageUrl = `${ORIGIN}/search?language=en`;
    let sessionResponse = null;
    let cookieString = '';
    
    try {
      // First, GET the search page with language=en to establish session with English preference
      sessionResponse = await axios.get(searchPageUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en,ja;q=0.9', // Prefer English content
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `${ORIGIN}/`
        },
        timeout: 40000, // 40 seconds - JRCT can be slow, need buffer above typical 11-13s
        maxRedirects: 10, // Allow redirects (language=en might redirect)
        validateStatus: (status) => status >= 200 && status < 400
      });

      // Extract cookies from the session response - IMPORTANT for language preference
      // JRCT sets language preference in cookies (like PHPSESSID) that must be passed to POST request
      const setCookieHeaders = sessionResponse.headers['set-cookie'] || [];
      const allCookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
      
      // Also check request object for cookies from redirects (axios may store them there)
      let redirectCookies = [];
      if (sessionResponse.request && sessionResponse.request._redirect) {
        const redirectRes = sessionResponse.request._redirect.response;
        if (redirectRes && redirectRes.headers && redirectRes.headers['set-cookie']) {
          const rc = redirectRes.headers['set-cookie'];
          redirectCookies = Array.isArray(rc) ? rc : [rc];
        }
      }
      
      // Combine all cookies from both initial response and redirects
      const combinedCookies = [...allCookies, ...redirectCookies];
      
      cookieString = combinedCookies
        .filter(c => c && typeof c === 'string')
        .map(c => {
          // Extract name=value part (before first semicolon)
          const cookieValue = c.split(';')[0].trim();
          return cookieValue;
        })
        .filter(Boolean)
        // Remove duplicates (same cookie name)
        .filter((cookie, index, self) => {
          const name = cookie.split('=')[0];
          return index === self.findIndex(c => c.split('=')[0] === name);
        })
        .join('; ');
      
    } catch (sessionErr) {
      // If session fetch fails, continue without cookies (might still work)
      console.error('Failed to fetch session page with language=en:', sessionErr.message);
      cookieString = '';
    }

    // Now POST the search form with the session cookie and language=en for English results
    // IMPORTANT: JRCT has separate fields:
    // - reg_plobrem_1 (対象疾患名 / Target Disease Name) for main disease (q parameter)
    // - demo_1 (フリーワード検索 / Free Word Search) for subtype/keywords (term parameter, optional)
    // - others: 0=AND, 1=OR - controls how demo_1 combines with disease field
    //   When both disease and keyword are provided, use AND (0) to match both conditions
    // - reg_plobrem_type: 0=AND, 1=OR - controls how multiple disease names combine (not needed for single disease)
    // - reg_recruitment[]: checkboxes for status - 2 = 募集中 (Recruiting)
    // - language: 'en' for English results (set via URL parameter)
    const target = `${ORIGIN}/search?searched=1&page=${page}&language=en`;
    const form = new URLSearchParams();
    form.set('button_type', 'confReg');
    form.set('reg_plobrem_1', q); // Main disease/condition (required)
    form.set('language', 'en'); // Force English language for results
    
    if (term && term.trim().length > 0) {
      form.set('demo_1', term); // Subtype/keywords in keyword search field (optional)
    }
    
    // Set reg_plobrem_type: 0=AND, 1=OR for how multiple disease names combine in reg_plobrem_1
    // Based on the form screenshot: disease field shows "and" selected → reg_plobrem_type='0'
    // This only matters if there were multiple diseases, but we only have one
    form.set('reg_plobrem_type', '0'); // AND for disease field
    
    // others: 0=AND, 1=OR - controls how keyword field (demo_1) combines with disease field
    // When BOTH disease and keyword are provided, we want AND logic (both must match)
    // The "or" in the form UI might refer to how keyword searches across multiple fields,
    // but when combining disease + keyword, we need AND so the trial matches BOTH conditions
    if (term && term.trim().length > 0) {
      // Both disease and keyword provided - use AND so both must match in the same trial
      form.set('others', '0'); // AND - require both disease and keyword to match
    } else {
      // Only disease provided - OR doesn't matter (default to OR for consistency)
      form.set('others', '1'); // OR (default, though not used when no keyword)
    }
    
    // Filter for recruiting studies only (reg_recruitment[]=2 means "募集中" / Recruiting)
    // Values: 1=募集前 (Not yet recruiting), 2=募集中 (Recruiting), 3=募集中断 (Recruitment suspended),
    //         4=募集終了 (Recruitment completed), 5=研究終了 (Study completed)
    if (filterRecruiting) {
      form.set('reg_recruitment[]', '2'); // Only include actively recruiting trials
    }

    const formData = form.toString();

    let r;
    try {
      // Ensure we're using the cookies from the language=en session
      // IMPORTANT: The Referer header should also have language=en to ensure English results
      const postHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,ja;q=0.9', // Prefer English content
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': ORIGIN,
        'Referer': `${ORIGIN}/search?language=en` // Ensure referer has language=en (not language=jp)
      };
      
      // Add cookies if we have them (important for language preference)
      if (cookieString) {
        postHeaders['Cookie'] = cookieString;
      }
      
      r = await axios.post(target, formData, {
        headers: postHeaders,
        timeout: 40000, // 40 seconds - JRCT can be slow, need buffer above typical 11-13s
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        // Ensure we follow redirects and maintain cookies
        decompress: true
      });
    } catch (postErr) {
      // Handle POST errors more gracefully
      if (postErr.response) {
        console.error('JRCT POST error:', postErr.response.status, postErr.response.statusText);
        throw new Error(`JRCT server error: ${postErr.response.status} ${postErr.response.statusText}`);
      } else {
        console.error('JRCT POST network error:', postErr.message);
        throw new Error(`Network error: ${postErr.message}`);
      }
    }

    // Check if we got HTML response
    if (!r || !r.data || typeof r.data !== 'string') {
      throw new Error('Invalid response from JRCT: expected HTML but got ' + (typeof r?.data));
    }

    // Debug: log HTML response length and a snippet to verify we got results
    const htmlLength = r.data.length;
    const htmlSnippet = r.data.substring(0, 1000);
    console.log(`\n========== JRCT SEARCH DEBUG ==========`);
    console.log(`JRCT HTML Response: ${htmlLength} characters`);
    console.log(`Status Code: ${r.status}`);
    console.log(`Target URL: ${target}`);
    
    // Extract cookies from POST response (may update language preference)
    const postResponseCookies = r.headers['set-cookie'] || [];
    const postCookies = Array.isArray(postResponseCookies) ? postResponseCookies : [postResponseCookies];
    const postCookieString = postCookies
      .filter(c => c && typeof c === 'string')
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    
    if (postCookieString) {
      console.log('JRCT POST response cookies:', postCookieString);
    }
    
    // Check if response is in English (look for English UI elements and trial content)
    const hasEnglishUI = r.data.includes('Search Results') || r.data.includes('View') || 
                         r.data.includes('Recruiting') || r.data.includes('English');
    const hasJapaneseUI = r.data.includes('検索結果') || r.data.includes('募集中');
    const hasEnglishTitles = r.data.includes('Ovarian Cancer') || r.data.includes('Phase') ||
                            r.data.includes('Study') || r.data.includes('Trial') ||
                            r.data.includes('Cancer');
    const isEnglish = hasEnglishUI || (hasEnglishTitles && !hasJapaneseUI);
    
    console.log(`Response appears to be in English: ${isEnglish}`);
    console.log(`  - Has English UI elements: ${hasEnglishUI}`);
    console.log(`  - Has Japanese UI elements: ${hasJapaneseUI}`);
    console.log(`  - Has English trial titles: ${hasEnglishTitles}`);
    
    // Check if response contains results table
    const hasResultsTable = r.data.includes('table-search') || r.data.includes('table.table-search');
    console.log(`Contains results table: ${hasResultsTable}`);
    
    // Check for pagination
    const hasPagination = r.data.includes('pagination') || r.data.includes('page-link');
    console.log(`Contains pagination: ${hasPagination}`);
    
    // Check if response indicates no results
    const noResultsText = r.data.includes('検索結果がありません') || r.data.includes('No search results') || r.data.includes('No results found');
    console.log(`Possible no results message: ${noResultsText}`);
    
    // Try to find the table directly
    const tableMatches = r.data.match(/<table[^>]*class[^>]*table-search[^>]*>/gi);
    console.log(`Table matches found: ${tableMatches ? tableMatches.length : 0}`);
    console.log(`========================================\n`);

    let parsed;
    try {
      parsed = parseResults(r.data, filterRecruiting);
      console.log(`Parsed ${parsed.results.length} results, total: ${parsed.total}`);
    } catch (parseErr) {
      console.error('Error parsing JRCT results:', parseErr.message);
      throw new Error(`Failed to parse JRCT results: ${parseErr.message}`);
    }

    // Ensure no caching headers are set (already set in cors(), but double-check)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', ''); // Remove ETag to prevent 304 responses
    
    return res.status(200).json({
      fetchedUrl: target,
      q, // Main disease
      term: term || null, // Subtype/keywords (if provided)
      page,
      filterRecruiting, // Include in response so caller knows if filtering was applied
      total: parsed.total,
      results: parsed.results,
      pages: parsed.pages
    });
  } catch (err) {
    // Log error for debugging
    console.error('JRCT search error:', {
      message: err.message,
      status: err?.response?.status,
      q: q?.substring(0, 50),
      page: page
    });
    
    // Determine HTTP status code
    let status = 500;
    if (err?.response?.status) {
      status = err.response.status;
    } else if (err.message?.includes('timeout')) {
      status = 504;
    } else if (err.message?.includes('Network')) {
      status = 503;
    }
    
    // Extract error message
    let errorMessage = err?.message || 'Unknown error';
    if (err?.response?.data) {
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
    
    const targetUrl = `${ORIGIN}/search?searched=1&page=${page || 1}`;
    
    return res.status(status).json({
      error: 'JRCT search failed',
      message: errorMessage,
      debug: { 
        target: targetUrl,
        q: q?.substring(0, 100), // Limit q length in error response
        page,
        status,
        errorType: err?.name || 'Unknown'
      }
    });
  }
};