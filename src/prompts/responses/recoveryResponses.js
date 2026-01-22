/**
 * Recovery response messages
 */

export function buildRecoveryInstructionsResponse() {
  return `I understand you need to recover deleted values. Unfortunately, Firestore doesn't have a built-in undo feature, but here are your recovery options:

**Best Recovery Method: Rescan Documents**
1. Go to the **Files** tab
2. Look for documents that contained your CA-125 (or other lab) values
3. Click the **"Rescan Document"** button (refresh icon) on any document
4. This will re-extract and restore all values from that document
5. The rescan will automatically clean up old values and add fresh ones

**How to Find Documents with CA-125:**
- Look for lab reports, blood work, or test results
- Documents are listed with their dates - find ones from when your CA-125 was measured
- You can rescan multiple documents if needed

**Alternative: Manual Entry**
- You can manually re-enter values through chat
- For example: "My CA-125 was 68 on January 3rd"
- Or use the Health tab to add values manually

**What Happened:**
- The duplicate removal function had a bug that deleted all values instead of just duplicates
- I've fixed this - it now only removes true duplicates (same date AND same value)
- It keeps the oldest value and only deletes exact duplicates

**Going Forward:**
- The duplicate removal is now safer and more conservative
- It will only delete values that are exact duplicates
- You can still use it, but it will be more careful

Would you like me to help you identify which documents to rescan, or would you prefer to manually re-enter the values?`;
}
