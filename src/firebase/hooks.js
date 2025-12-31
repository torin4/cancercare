import { useState, useEffect } from 'react';
import {
  patientService,
  labService,
  vitalService,
  medicationService,
  medicationLogService,
  documentService,
  messageService,
  symptomService,
  genomicProfileService,
  emergencyContactService,
  clinicalTrialService,
  trialLocationService
} from './services';

// Hook for patient data
export const usePatient = (patientId) => {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadPatient = async () => {
      try {
        setLoading(true);
        const data = await patientService.getPatient(patientId);
        setPatient(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading patient:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPatient();
  }, [patientId]);

  const updatePatient = async (updates) => {
    try {
      await patientService.updatePatient(patientId, updates);
      const updated = await patientService.getPatient(patientId);
      setPatient(updated);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { patient, loading, error, updatePatient };
};

// Hook for labs
export const useLabs = (patientId) => {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadLabs = async () => {
      try {
        setLoading(true);
        const data = await labService.getLabs(patientId);
        setLabs(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading labs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLabs();
  }, [patientId]);

  const addLab = async (labData) => {
    try {
      const id = await labService.saveLab({ ...labData, patientId });
      const updated = await labService.getLabs(patientId);
      setLabs(updated);
      return id;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const updateLab = async (labId, updates) => {
    try {
      await labService.saveLab({ id: labId, ...updates });
      const updated = await labService.getLabs(patientId);
      setLabs(updated);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { labs, loading, error, addLab, updateLab };
};

// Hook for vitals
export const useVitals = (patientId) => {
  const [vitals, setVitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadVitals = async () => {
      try {
        setLoading(true);
        const data = await vitalService.getVitals(patientId);
        setVitals(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading vitals:', err);
      } finally {
        setLoading(false);
      }
    };

    loadVitals();
  }, [patientId]);

  const addVital = async (vitalData) => {
    try {
      const id = await vitalService.saveVital({ ...vitalData, patientId });
      const updated = await vitalService.getVitals(patientId);
      setVitals(updated);
      return id;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { vitals, loading, error, addVital };
};

// Hook for medications
export const useMedications = (patientId) => {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadMedications = async () => {
      try {
        setLoading(true);
        const data = await medicationService.getMedications(patientId);
        setMedications(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading medications:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMedications();
  }, [patientId]);

  const addMedication = async (medData) => {
    try {
      const id = await medicationService.saveMedication({ ...medData, patientId });
      const updated = await medicationService.getMedications(patientId);
      setMedications(updated);
      return id;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const updateMedication = async (medId, updates) => {
    try {
      await medicationService.saveMedication({ id: medId, ...updates });
      const updated = await medicationService.getMedications(patientId);
      setMedications(updated);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { medications, loading, error, addMedication, updateMedication };
};

// Hook for medication logs
export const useMedicationLogs = (patientId) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadLogs = async () => {
      try {
        setLoading(true);
        const data = await medicationLogService.getMedicationLogs(patientId);
        setLogs(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading medication logs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [patientId]);

  const addLog = async (logData) => {
    try {
      const id = await medicationLogService.addMedicationLog({ ...logData, patientId });
      const updated = await medicationLogService.getMedicationLogs(patientId);
      setLogs(updated);
      return id;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { logs, loading, error, addLog };
};

// Hook for documents
export const useDocuments = (patientId) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadDocuments = async () => {
      try {
        setLoading(true);
        const data = await documentService.getDocuments(patientId);
        setDocuments(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading documents:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [patientId]);

  const addDocument = async (docData) => {
    try {
      const id = await documentService.saveDocument({ ...docData, patientId });
      const updated = await documentService.getDocuments(patientId);
      setDocuments(updated);
      return id;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { documents, loading, error, addDocument };
};

// Hook for messages
export const useMessages = (patientId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoading(true);
        const data = await messageService.getMessages(patientId);
        setMessages(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading messages:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [patientId]);

  const addMessage = async (messageData) => {
    try {
      const id = await messageService.addMessage({ ...messageData, patientId });
      const updated = await messageService.getMessages(patientId);
      setMessages(updated);
      return id;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { messages, loading, error, addMessage };
};

// Hook for symptoms
export const useSymptoms = (patientId) => {
  const [symptoms, setSymptoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadSymptoms = async () => {
      try {
        setLoading(true);
        const data = await symptomService.getSymptoms(patientId);
        setSymptoms(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading symptoms:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSymptoms();
  }, [patientId]);

  const addSymptom = async (symptomData) => {
    try {
      const id = await symptomService.addSymptom({ ...symptomData, patientId });
      const updated = await symptomService.getSymptoms(patientId);
      setSymptoms(updated);
      return id;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { symptoms, loading, error, addSymptom };
};

// Hook for genomic profile
export const useGenomicProfile = (patientId) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await genomicProfileService.getGenomicProfile(patientId);
        setProfile(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading genomic profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [patientId]);

  const updateProfile = async (profileData) => {
    try {
      await genomicProfileService.saveGenomicProfile(patientId, profileData);
      const updated = await genomicProfileService.getGenomicProfile(patientId);
      setProfile(updated);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { profile, loading, error, updateProfile };
};

// Hook for emergency contacts
export const useEmergencyContacts = (patientId) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadContacts = async () => {
      try {
        setLoading(true);
        const data = await emergencyContactService.getEmergencyContacts(patientId);
        setContacts(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading emergency contacts:', err);
      } finally {
        setLoading(false);
      }
    };

    loadContacts();
  }, [patientId]);

  const addContact = async (contactData) => {
    try {
      const id = await emergencyContactService.saveEmergencyContact({ ...contactData, patientId });
      const updated = await emergencyContactService.getEmergencyContacts(patientId);
      setContacts(updated);
      return id;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { contacts, loading, error, addContact };
};

// Hook for clinical trials
export const useClinicalTrials = (patientId) => {
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const loadTrials = async () => {
      try {
        setLoading(true);
        const data = await clinicalTrialService.getClinicalTrials(patientId);
        setTrials(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading clinical trials:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTrials();
  }, [patientId]);

  const addTrial = async (trialData) => {
    try {
      const id = await clinicalTrialService.saveClinicalTrial({ ...trialData, patientId });
      const updated = await clinicalTrialService.getClinicalTrials(patientId);
      setTrials(updated);
      return id;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { trials, loading, error, addTrial };
};






