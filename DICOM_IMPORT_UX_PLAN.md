# DICOM Import UX Rework – Plan

## Problem Summary

1. **Misleading framing**: DICOM scans are treated as "upload" in the document flow. They are better described as an **import** (ingest + optional view), and dates come from scan metadata, not user input.

2. **Date step is wrong for DICOM**: The upload modal always shows "Document Date" (step 2). For DICOM, study/series dates are in the files; a user-entered date is redundant and confusing.

3. **Unclear home for DICOM**: Today, DICOM lives under "Other Medical Document" alongside reports, pathology, etc. DICOM has a distinct flow (ZIP vs single/multi, View Now vs Save to Library, viewer) and should be surfaced explicitly.

4. **View + Import**: The DICOM flow should support both opening the viewer and saving to the library. The current ZIP "View Now" / "Save to Library" pattern already supports this; we need to extend that clarity to the overall import UX.

---

## Current Flow (Simplified)

- **Files tab** → "Add File" → **DocumentUploadOnboarding**
- Steps: **1** Type (blood-test | genomic-profile | **other**) → **2** Date → **3** Notes → **4** Files
- "Other" includes DICOM. All types see the date step.
- For **ZIP**: after processing → **ZipChoiceModal** → "View Now" (viewer) or "Save to Library" (upload).
- For **single/multi DICOM**: upload → appear in list → "View" opens viewer.

---

## Options

### Option A: Dedicated DICOM Card in Document Uploader

**Idea:** Add a 4th card, **"Import DICOM / Medical Imaging"**, and treat DICOM as a first-class type with a different step sequence.

**Flow:**

1. **Step 1 – Type**: Four cards: Blood Test, Genomic, **Import DICOM**, Other.
2. **If DICOM selected**:
   - **Skip date step.**  
   - **Step 2** = Notes only (optional).  
   - **Step 3** = Files (ZIP, .dcm, etc.).
3. **If non-DICOM**:
   - Keep current flow: Date → Notes → Files.
4. **Copy:** Use **"Import"** (not "Upload") for DICOM. Examples: "Import DICOM / Medical Imaging", "Import scan", "Import and view".

**DICOM card content (examples):**

- **Title:** Import DICOM / Medical Imaging  
- **Description:** CT, MRI, PET scans. Single files, multiple files, or ZIP (e.g. from CD).  
- **Examples:** DICOM files (.dcm), DICOMDIR-based ZIPs, folder exports.  
- **Help text:** We use study/series dates from the files. You can view in the imaging viewer and optionally save to your library.

**After file selection:**

- **ZIP:** Same as now → ZipChoiceModal → View Now | Save to Library.  
- **Single/multi DICOM:** Upload → list → View. Optionally add a post-upload "View now?" (e.g. toast or small modal) for consistency with ZIP.

**Pros:**

- Single entry point for all document types.
- Clear separation of DICOM from "Other".
- No date step for DICOM.
- "Import" framing only where it applies.

**Cons:**

- Upload modal has conditional steps (different flows by type).
- "Other" still needs a clear definition (e.g. "Other documents – reports, pathology, etc. For DICOM, use Import DICOM.").

---

### Option B: Separate "Import DICOM" Button in Files Tab

**Idea:** Keep "Add File" for lab/genomic/other only. Add a dedicated **"Import DICOM"** action in the Files tab that goes straight to a DICOM-specific flow.

**Flow:**

1. **Files tab (Documents):**
   - **"Add File"** → DocumentUploadOnboarding (blood-test | genomic | other). Unchanged. No DICOM type.
   - **"Import DICOM"** → DICOM-only flow (see below).
2. **DICOM flow:**
   - **Step 1:** File picker only. Accept: `.dcm`, `.dicom`, `.zip`, extensionless DICOM.
   - **Step 2 (optional):** Single optional "Note" field (e.g. "Baseline CT") or skip.
   - **Step 3:**  
     - **ZIP:** Same as now → ZipChoiceModal → View Now | Save to Library.  
     - **Single/multi DICOM:** Choice: **View now** (open viewer) or **Save to library** (then view from list). Mirrors ZIP.

**UI placement:**

- When **documents empty:** Two actions, e.g.  
  - Primary: "Upload your first document" (existing).  
  - Secondary: "Import DICOM" (link or secondary button).
- When **documents exist:** Header actions: "Add File" + "Import DICOM" (e.g. next to Refresh).

**Pros:**

- No date step, no DICOM-specific branching inside the generic uploader.
- Clear "Import" vs "Upload" distinction.
- DICOM always goes through a purpose-built flow.
- Easy to add "View now" as default for DICOM.

**Cons:**

- Two entry points in Files tab.
- "Other" can still accept DICOM if we allow it; we’d hide or discourage DICOM from "Other" (e.g. validation + message: "Use Import DICOM for imaging").

---

### Option C: Hybrid (Recommendation)

**Combine the best of both:**

1. **Files tab**
   - **"Add File"** → DocumentUploadOnboarding.
   - **"Import DICOM"** → DICOM-only flow (as in Option B).
2. **DocumentUploadOnboarding**
   - **Add a DICOM card** (as in Option A).
   - **If user selects DICOM card:**  
     - Don’t run the full modal steps.  
     - Instead, **redirect into the same DICOM flow** used by "Import DICOM" (file picker → optional note → View / Save).  
   - **Result:** One DICOM flow, two entry points (Files "Import DICOM" vs Upload modal’s DICOM card).

**Unified DICOM flow (used by both entry points):**

1. **Pick files:** ZIP or DICOM (.dcm, etc.).
2. **Optional note** (single field).
3. **No date.**
4. **Then:**
   - **ZIP:** ZipChoiceModal → View Now | Save to Library.  
   - **Single/multi DICOM:** View now | Save to library (same pattern).

**Terminology:**

- **Upload:** Lab, genomic, other documents.  
- **Import:** DICOM only. Use "Import DICOM" everywhere for imaging.

**"Other":**

- Clarify as "Other medical documents (reports, pathology, etc.)".  
- Exclude DICOM from "Other" examples, or add validation: if user picks DICOM under "Other", prompt: "Use **Import DICOM** for imaging."

---

## Recommendation: **Option C (Hybrid)**

- **Separate "Import DICOM"** in Files tab for discoverability and clarity.  
- **DICOM card** in uploader for users who start from "Add File"; both funnel into the **same DICOM flow**.  
- **No date** for DICOM; **optional note** only.  
- **Consistent "Import"** language for DICOM and **"View now" / "Save to library"** for both ZIP and non-ZIP.

---

## Implementation Outline

### 1. DICOM-only flow (new)

- New component or dedicated mode: **DicomImportFlow**.
- Steps: (1) File picker (ZIP / DICOM) → (2) Optional note → (3) View now | Save to library.
- Reuse existing logic: `prepareZipForViewing`, `onOpenDicomViewer`, upload/save handlers.
- **No** date input; **no** "Document Date" step.

### 2. Files tab

- Add **"Import DICOM"** button (empty state + header when documents exist).
- "Import DICOM" opens **DicomImportFlow** (modal or inline).
- Keep "Add File" → DocumentUploadOnboarding; ensure it no longer routes DICOM through the date step.

### 3. DocumentUploadOnboarding

- Add **"Import DICOM / Medical Imaging"** card.
- On DICOM card select: **open DicomImportFlow** instead of continuing to date → notes → files.  
  - Optionally close the onboarding modal and open the DICOM flow, so users don’t see date/notes for DICOM.

### 4. "Other" and validation

- Update "Other" copy to exclude DICOM.
- If files under "Other" are detected as DICOM: show message and link to "Import DICOM" (or trigger DICOM flow).

### 5. Copy and small UX tweaks

- Replace "Upload" with **"Import"** for all DICOM-related UI.
- Ensure empty state and headers use "Import DICOM" consistently.
- Optionally: after "Save to library" for DICOM, offer "View now" (e.g. toast action or one-click) to match ZIP.

### 6. Backend / processing

- Reuse existing DICOM processing and metadata extraction.  
- Ensure we **never** use a user-supplied "document date" for DICOM; always use **study/series date from metadata**.  
- If date is today used in any "document date" field for DICOM, remove that and rely only on DICOM tags.

---

## Files to Touch

- **`DocumentUploadOnboarding`**  
  - Add DICOM card.  
  - When DICOM selected, open DicomImportFlow; skip date (and possibly notes) for DICOM.
- **`FilesTab`**  
  - Add "Import DICOM" entry point.  
  - Wire to DicomImportFlow.
- **New (or refactored):** **`DicomImportFlow`**  
  - File picker → optional note → View now | Save to library.  
  - Reuse ZIP choice UI / handlers where possible.
- **Copy:**  
  - "Import DICOM" everywhere for imaging.  
  - "Other" clarified, DICOM excluded.
- **Document processing / metadata:**  
  - No user date for DICOM; use only DICOM metadata dates.

---

## Open Decisions

1. **DicomImportFlow:** New modal vs inline in Files tab?  
   - **Suggestion:** Modal (like onboarding) for consistency and focus.

2. **"View now" for non-ZIP DICOM:**  
   - Always show both "View now" and "Save to library" (like ZIP), or only "Save" with "View" from list?  
   - **Suggestion:** Mirror ZIP: View now | Save to library.

3. **"Other" + DICOM:**  
   - Hard block (validation + redirect to Import DICOM) or soft suggestion?  
   - **Suggestion:** Soft: detect DICOM, show message + "Use Import DICOM", and offer to open DICOM flow.

4. **Note in DICOM flow:**  
   - Optional single line vs optional multi-line?  
   - **Suggestion:** Optional single line or short multi-line; keep it minimal.

---

## Summary

- **Problem:** DICOM is misleadingly treated as "upload" and is forced through a date step.  
- **Fix:** Treat DICOM as **import**; **no date**; **dedicated flow** with **View now | Save to library**.  
- **Approach:** **Hybrid** – separate **"Import DICOM"** in Files tab **and** a **DICOM card** in the uploader, both using the **same DICOM-only flow** (file picker → optional note → View / Save).
