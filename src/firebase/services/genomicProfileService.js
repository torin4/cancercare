/**
 * Genomic Profile Service
 * 
 * Handles all genomic profile-related Firestore operations including:
 * - CRUD operations for genomic profile documents
 * - Normalization of genomic profile data for consistent UI display
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';
import { convertTimestamps } from './shared/convertTimestamps';

// Normalize genomic profile shape to a consistent schema used by the UI
function normalizeGenomicProfile(profile = {}) {
  const p = { ...profile };

  // Ensure mutations array exists and normalize each entry
  const rawMutations = Array.isArray(p.mutations) ? p.mutations : (p.variants || p.mut || []);
  const mutations = rawMutations.map((m) => {
    const mutation = typeof m === 'string' ? { variant: m } : { ...m };
    // Check multiple fields for DNA/protein notation: variant, alteration, dna, dnaChange
    const raw = (mutation.variant || '') + ' ' + (mutation.alteration || '') + ' ' + (mutation.type || '') + ' ' + (mutation.note || '');
    const dnaMatch = raw.match(/c\.[^\s,;)]*/i);
    const proteinMatch = raw.match(/p\.[^\s,;)]*/i);
    const copyMatch = raw.match(/(?:copy number|copy|cn|copies)[:=\s]*([0-9.]+)/i);

    // Check alteration field first if it contains DNA notation
    let dna = mutation.dna || mutation.dnaChange;
    if (!dna && mutation.alteration) {
      const altDnaMatch = mutation.alteration.match(/c\.[^\s,;)]*/i);
      if (altDnaMatch) {
        dna = altDnaMatch[0];
      } else if (mutation.alteration.match(/^c\./i)) {
        // If alteration starts with c., use it as DNA
        dna = mutation.alteration;
      }
    }
    if (!dna && dnaMatch) {
      dna = dnaMatch[0];
    }
    
    let protein = mutation.protein || mutation.aminoAcidChange;
    if (!protein && mutation.alteration) {
      const altProteinMatch = mutation.alteration.match(/p\.[^\s,;)]*/i);
      if (altProteinMatch) {
        protein = altProteinMatch[0];
      }
    }
    if (!protein && proteinMatch) {
      protein = proteinMatch[0];
    }
    const copyNumber = mutation.copyNumber || mutation.cn || (copyMatch ? parseFloat(copyMatch[1]) : (mutation.copy ? parseFloat(mutation.copy) : undefined));
    const gene = mutation.gene || mutation.symbol || mutation.name || (mutation.variant ? (mutation.variant.split(/[\s:]/)[0] || null) : null);
    const significance = mutation.significance || mutation.clinicalSignificance || mutation.annotation;
    const kind = mutation.type || (mutation.germline ? 'Germline' : mutation.somatic ? 'Somatic' : null);

    const out = {
      gene: gene || null,
      variant: mutation.variant || null,
      dna: dna || null,
      protein: protein || null,
      copyNumber: typeof copyNumber === 'number' ? copyNumber : null,
      type: mutation.type || null,
      significance: significance || null,
      source: mutation.source || null,
      // Preserve variant allele frequency and other AI-extracted fields
      // Check multiple possible field names: variantAlleleFrequency, vaf, frequency, VAF
      variantAlleleFrequency: (() => {
        const vaf = mutation.variantAlleleFrequency || mutation.vaf || mutation.VAF || mutation.frequency;
        if (vaf === undefined || vaf === null) return null;
        if (typeof vaf === 'number') return isNaN(vaf) ? null : vaf;
        const parsed = parseFloat(vaf);
        if (!isNaN(parsed)) {
          return parsed;
        }
        return null;
      })(),
      alteration: mutation.alteration || null,
      mutationType: mutation.mutationType || null,
      therapyImplication: mutation.therapyImplication || null,
      fdaApprovedTherapy: mutation.fdaApprovedTherapy || null
    };
    return out;
  });

  // Collect CNV/amplification entries either from mutations or from top-level fields
  const cnvs = [];
  // From explicit cnv list
  if (Array.isArray(p.cnvs)) {
    p.cnvs.forEach(c => {
      cnvs.push({ gene: c.gene || c.symbol || null, copyNumber: c.copyNumber || c.cn || null, note: c.note || null });
    });
  }
  // From mutations that include copyNumber
  mutations.forEach(m => {
    if (m.copyNumber && m.gene) cnvs.push({ gene: m.gene, copyNumber: m.copyNumber });
  });
  // From top-level fields like copyNumberMap or copyNumbers
  if (p.copyNumberMap && typeof p.copyNumberMap === 'object') {
    Object.keys(p.copyNumberMap).forEach(g => cnvs.push({ gene: g, copyNumber: Number(p.copyNumberMap[g]) }));
  }

  // Normalize biomarkers
  const tmbValue = p.tmbValue || (typeof p.tmb === 'string' && p.tmb.match(/[0-9.]+/) ? parseFloat(p.tmb.match(/[0-9.]+/)[0]) : null);
  const hrdScore = p.hrdScore || (p.hrd && typeof p.hrd === 'number' ? p.hrd : null);
  const msi = p.msi || p.msiStatus || (p.microsatelliteInstability ? p.microsatelliteInstability.status : null);
  const pdl1 = p.pdl1 || p.pdL1 || p.pdl1Expression || null;

  return {
    ...p,
    mutations,
    cnvs: cnvs.length ? cnvs : (Array.isArray(p.cnvs) ? p.cnvs : []),
    tmbValue: tmbValue || null,
    hrdScore: hrdScore || null,
    msi: msi || null,
    pdl1: pdl1 || null
  };
}

export const genomicProfileService = {
  // Get genomic profile for a patient
  async getGenomicProfile(patientId) {
    const docRef = doc(db, COLLECTIONS.GENOMIC_PROFILES, patientId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...convertTimestamps(docSnap.data()) };
      return normalizeGenomicProfile(data);
    }
    return null;
  },

  // Create or update genomic profile
  async saveGenomicProfile(patientId, profileData) {
    const docRef = doc(db, COLLECTIONS.GENOMIC_PROFILES, patientId);
    const normalized = normalizeGenomicProfile({ id: patientId, patientId, ...profileData });
    await setDoc(docRef, {
      ...normalized,
      id: patientId,
      patientId,
      updatedAt: serverTimestamp(),
      createdAt: profileData.createdAt || serverTimestamp()
    }, { merge: true });
    return patientId;
  }
};
