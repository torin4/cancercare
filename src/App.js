import React, { useState, useEffect } from 'react';
import { Upload, MessageSquare, FolderOpen, User, Home, Send, Camera, AlertCircle, TrendingUp, MapPin, Search, Activity, Plus, X, Edit2, ChevronRight } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { uploadDocument } from './firebase/storage';
import { documentService } from './firebase/services';
import { auth } from './firebase/config';
import Login from './components/Login';

const styles = `
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  
  @keyframes fade-scale {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  @keyframes fab-in {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes fab-out {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.5);
    }
  }
  
  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }
  
  .animate-fade-scale {
    animation: fade-scale 0.2s ease-out;
  }
  
  .animate-fab-in {
    animation: fab-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .animate-fab-out {
    animation: fab-out 0.2s ease-in;
  }
`;

export default function CancerCareApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [healthSection, setHealthSection] = useState('labs');
  const [selectedLab, setSelectedLab] = useState('ca125');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [genomicExpanded, setGenomicExpanded] = useState(false);
  const [labViewMode, setLabViewMode] = useState('labs'); // 'labs' or 'vitals'
  const [selectedVital, setSelectedVital] = useState('bp');
  const [showAddVital, setShowAddVital] = useState(false);
  const [showFab, setShowFab] = useState(true);
  const [fabAnimating, setFabAnimating] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'ai', text: 'Hi Joe. How can I help you track Mary\'s health today?\n\nJust tell me about her values naturally - like "She had her appointment and CA-125 came back at 70" or "Blood pressure was 145/92 today" - and I\'ll extract and log everything automatically.' }
  ]);
  const [quickLogInput, setQuickLogInput] = useState('');
  const [inputText, setInputText] = useState('');
  const [showUploadDemo, setShowUploadDemo] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [editMode, setEditMode] = useState('ai');
  const [showAddLab, setShowAddLab] = useState(false);
  const [showEditGenomic, setShowEditGenomic] = useState(false);
  const [showEditContacts, setShowEditContacts] = useState(false);
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [trialLocation, setTrialLocation] = useState({
    city: 'Seattle',
    state: 'WA',
    country: 'United States',
    zip: '98109',
    searchRadius: '100',
    includeAllLocations: false
  });
  const [newLabData, setNewLabData] = useState({
    label: '',
    normalRange: '',
    unit: ''
  });

  const [documents, setDocuments] = useState([
    { id: 1, name: 'Lab Results - Dec 28, 2024', type: 'Lab', date: '2024-12-28', data: 'CA-125: 62 U/mL, WBC: 5.8, Hemoglobin: 11.2', icon: 'lab' },
    { id: 2, name: 'CT Scan - Abdomen & Pelvis', type: 'Scan', date: '2024-12-20', data: 'Stable disease, no new lesions', icon: 'scan' },
    { id: 3, name: 'Lab Results - Nov 15, 2024', type: 'Lab', date: '2024-11-15', data: 'CA-125: 55 U/mL, WBC: 6.1, Platelets: 245', icon: 'lab' },
    { id: 4, name: 'Foundation One CDx Report', type: 'Genomic', date: '2024-11-10', data: 'BRCA1 pathogenic variant, HRD positive, TP53 wild-type', icon: 'genomic' },
    { id: 5, name: 'Oncology Progress Note - Dr. Chen', type: 'Report', date: '2024-11-08', data: 'Patient tolerating Paclitaxel + Bevacizumab well, ECOG 1', icon: 'report' },
    { id: 6, name: 'Lab Results - Nov 1, 2024', type: 'Lab', date: '2024-11-01', data: 'CA-125: 38 U/mL, ANC: 2100, Creatinine: 0.9', icon: 'lab' },
    { id: 7, name: 'MRI - Pelvis with Contrast', type: 'Scan', date: '2024-10-28', data: 'Interval decrease in peritoneal disease', icon: 'scan' },
    { id: 8, name: 'Pathology Report - Surgical Specimen', type: 'Report', date: '2024-10-20', data: 'Clear cell ovarian carcinoma, Stage IIIC, ARID1A mutation', icon: 'report' },
    { id: 9, name: 'Treatment Plan - Cycle 3', type: 'Report', date: '2024-10-15', data: 'Continue Paclitaxel 175mg/m² + Bevacizumab 15mg/kg q3wk', icon: 'report' },
    { id: 10, name: 'PET/CT Scan - Full Body', type: 'Scan', date: '2024-10-10', data: 'Hypermetabolic activity in pelvis and omentum', icon: 'scan' },
    { id: 11, name: 'BRCA1/BRCA2 Genetic Test', type: 'Genomic', date: '2024-10-05', data: 'BRCA1 c.5266dupC pathogenic variant detected', icon: 'genomic' },
    { id: 12, name: 'Initial Consultation - Dr. Chen', type: 'Report', date: '2024-09-28', data: 'New patient consult for Stage IIIC ovarian cancer', icon: 'report' },
  ]);

  const [medications, setMedications] = useState([
    {
      id: 1,
      name: 'Paclitaxel',
      dosage: '175 mg/m²',
      frequency: 'Every 3 weeks',
      schedule: 'IV infusion',
      purpose: 'Chemotherapy',
      nextDose: '2025-01-05',
      color: 'purple',
      instructions: 'Administered at infusion center',
      active: true
    },
    {
      id: 2,
      name: 'Bevacizumab',
      dosage: '15 mg/kg',
      frequency: 'Every 3 weeks',
      schedule: 'IV infusion',
      purpose: 'Targeted therapy',
      nextDose: '2025-01-05',
      color: 'blue',
      instructions: 'Given with Paclitaxel',
      active: true
    },
    {
      id: 3,
      name: 'Ondansetron',
      dosage: '8 mg',
      frequency: 'Twice daily',
      schedule: '8:00 AM, 8:00 PM',
      purpose: 'Anti-nausea',
      nextDose: '2024-12-28 8:00 PM',
      color: 'green',
      instructions: 'Take with or without food',
      active: true
    },
    {
      id: 4,
      name: 'Dexamethasone',
      dosage: '4 mg',
      frequency: 'Daily',
      schedule: '9:00 AM',
      purpose: 'Anti-inflammatory',
      nextDose: '2024-12-29 9:00 AM',
      color: 'orange',
      instructions: 'Take with food to reduce stomach upset',
      active: true
    },
    {
      id: 5,
      name: 'Omeprazole',
      dosage: '20 mg',
      frequency: 'Daily',
      schedule: '8:00 AM',
      purpose: 'Stomach protection',
      nextDose: '2024-12-29 8:00 AM',
      color: 'teal',
      instructions: 'Take 30 minutes before breakfast',
      active: true
    }
  ]);

  const [medicationLog, setMedicationLog] = useState([
    { medId: 3, scheduledTime: '8:00 AM', takenAt: '2024-12-28T08:05:00' },
    { medId: 5, scheduledTime: '8:00 AM', takenAt: '2024-12-28T08:03:00' },
    { medId: 4, scheduledTime: '9:00 AM', takenAt: '2024-12-28T09:02:00' },
  ]);

  const markMedicationTaken = (medId, scheduledTime) => {
    const now = new Date().toISOString();
    
    setMedicationLog([...medicationLog, {
      medId: medId,
      scheduledTime: scheduledTime,
      takenAt: now
    }]);
  };

  const isMedicationTaken = (medId, scheduledTime) => {
    const today = new Date().toDateString();
    return medicationLog.some(log => {
      const logDate = new Date(log.takenAt).toDateString();
      return log.medId === medId && 
             log.scheduledTime === scheduledTime && 
             logDate === today;
    });
  };

  // Comprehensive lab data
  const allLabData = {
    ca125: {
      name: 'CA-125',
      unit: 'U/mL',
      current: 62,
      status: 'warning',
      trend: 'up',
      normalRange: '<35',
      data: [
        { date: 'Oct 15', value: 38 },
        { date: 'Oct 29', value: 42 },
        { date: 'Nov 12', value: 45 },
        { date: 'Nov 26', value: 47 },
        { date: 'Dec 1', value: 48 },
        { date: 'Dec 8', value: 51 },
        { date: 'Dec 15', value: 53 },
        { date: 'Dec 20', value: 55 },
        { date: 'Dec 28', value: 62 }
      ]
    },
    wbc: {
      name: 'WBC',
      unit: 'K/μL',
      current: 5.8,
      status: 'normal',
      trend: 'stable',
      normalRange: '4.5-11.0',
      data: [
        { date: 'Nov 12', value: 6.5 },
        { date: 'Dec 1', value: 6.3 },
        { date: 'Dec 15', value: 6.0 },
        { date: 'Dec 20', value: 6.2 },
        { date: 'Dec 28', value: 5.8 }
      ]
    },
    anc: {
      name: 'ANC',
      unit: '/μL',
      current: 3200,
      status: 'normal',
      trend: 'stable',
      normalRange: '>1,500',
      data: [
        { date: 'Nov 12', value: 3500 },
        { date: 'Dec 1', value: 3400 },
        { date: 'Dec 15', value: 3300 },
        { date: 'Dec 20', value: 3100 },
        { date: 'Dec 28', value: 3200 }
      ]
    },
    hemoglobin: {
      name: 'Hemoglobin',
      unit: 'g/dL',
      current: 11.2,
      status: 'normal',
      trend: 'stable',
      normalRange: '12.0-16.0',
      data: [
        { date: 'Oct 15', value: 12.5 },
        { date: 'Nov 12', value: 11.8 },
        { date: 'Dec 1', value: 11.5 },
        { date: 'Dec 15', value: 11.3 },
        { date: 'Dec 20', value: 11.4 },
        { date: 'Dec 28', value: 11.2 }
      ]
    },
    platelets: {
      name: 'Platelets',
      unit: 'K/μL',
      current: 238,
      status: 'normal',
      trend: 'stable',
      normalRange: '150-400',
      data: [
        { date: 'Nov 12', value: 252 },
        { date: 'Dec 1', value: 248 },
        { date: 'Dec 15', value: 242 },
        { date: 'Dec 20', value: 245 },
        { date: 'Dec 28', value: 238 }
      ]
    },
    creatinine: {
      name: 'Creatinine',
      unit: 'mg/dL',
      current: 0.9,
      status: 'normal',
      trend: 'stable',
      normalRange: '0.6-1.2',
      data: [
        { date: 'Oct 15', value: 0.8 },
        { date: 'Nov 12', value: 0.85 },
        { date: 'Dec 1', value: 0.87 },
        { date: 'Dec 20', value: 0.88 },
        { date: 'Dec 28', value: 0.9 }
      ]
    },
    egfr: {
      name: 'eGFR',
      unit: 'mL/min',
      current: 82,
      status: 'normal',
      trend: 'stable',
      normalRange: '>60',
      data: [
        { date: 'Oct 15', value: 88 },
        { date: 'Nov 12', value: 86 },
        { date: 'Dec 1', value: 84 },
        { date: 'Dec 20', value: 83 },
        { date: 'Dec 28', value: 82 }
      ]
    },
    alt: {
      name: 'ALT',
      unit: 'U/L',
      current: 28,
      status: 'normal',
      trend: 'stable',
      normalRange: '7-56',
      data: [
        { date: 'Oct 15', value: 25 },
        { date: 'Nov 12', value: 27 },
        { date: 'Dec 20', value: 26 },
        { date: 'Dec 28', value: 28 }
      ]
    },
    ast: {
      name: 'AST',
      unit: 'U/L',
      current: 32,
      status: 'normal',
      trend: 'stable',
      normalRange: '10-40',
      data: [
        { date: 'Oct 15', value: 30 },
        { date: 'Nov 12', value: 31 },
        { date: 'Dec 20', value: 33 },
        { date: 'Dec 28', value: 32 }
      ]
    }
  };

  const allVitalsData = {
    bp: {
      name: 'Blood Pressure',
      unit: 'mmHg',
      current: '128/82',
      systolic: 128,
      diastolic: 82,
      status: 'normal',
      trend: 'stable',
      normalRange: '<140/90',
      data: [
        { date: 'Oct 15', value: 122, systolic: 122, diastolic: 78 },
        { date: 'Nov 12', value: 126, systolic: 126, diastolic: 80 },
        { date: 'Dec 20', value: 125, systolic: 125, diastolic: 81 },
        { date: 'Dec 28', value: 128, systolic: 128, diastolic: 82 }
      ]
    },
    hr: {
      name: 'Heart Rate',
      unit: 'BPM',
      current: 72,
      status: 'normal',
      trend: 'stable',
      normalRange: '60-100',
      data: [
        { date: 'Oct 15', value: 68 },
        { date: 'Nov 12', value: 70 },
        { date: 'Dec 20', value: 74 },
        { date: 'Dec 28', value: 72 }
      ]
    },
    temp: {
      name: 'Temperature',
      unit: '°F',
      current: 98.2,
      status: 'normal',
      trend: 'stable',
      normalRange: '97.5-99.5',
      data: [
        { date: 'Oct 15', value: 98.1 },
        { date: 'Nov 12', value: 98.3 },
        { date: 'Dec 20', value: 98.0 },
        { date: 'Dec 28', value: 98.2 }
      ]
    },
    weight: {
      name: 'Weight',
      unit: 'kg',
      current: 62.0,
      status: 'normal',
      trend: 'down',
      normalRange: '55-70',
      data: [
        { date: 'Oct 15', value: 64.5 },
        { date: 'Nov 12', value: 63.8 },
        { date: 'Dec 20', value: 62.5 },
        { date: 'Dec 28', value: 62.0 }
      ]
    },
    o2sat: {
      name: 'Oxygen Saturation',
      unit: '%',
      current: 98,
      status: 'normal',
      trend: 'stable',
      normalRange: '>95',
      data: [
        { date: 'Oct 15', value: 97 },
        { date: 'Nov 12', value: 98 },
        { date: 'Dec 20', value: 98 },
        { date: 'Dec 28', value: 98 }
      ]
    },
    rr: {
      name: 'Respiratory Rate',
      unit: '/min',
      current: 16,
      status: 'normal',
      trend: 'stable',
      normalRange: '12-20',
      data: [
        { date: 'Oct 15', value: 15 },
        { date: 'Nov 12', value: 16 },
        { date: 'Dec 20', value: 16 },
        { date: 'Dec 28', value: 16 }
      ]
    }
  };

  const symptoms = [
    { date: 'Dec 28', type: 'Fatigue', severity: 'Moderate', notes: 'Energy 3/10' },
    { date: 'Dec 27', type: 'Pain', severity: 'Mild', notes: 'Lower back' },
    { date: 'Dec 26', type: 'Nausea', severity: 'Mild', notes: 'After meals' }
  ];

  const genomicProfile = {
    brca1: 'Positive',
    brca2: 'Negative',
    tp53: 'Wild-type',
    pik3ca: 'Wild-type',
    arid1a: 'Mutated',
    pten: 'Loss detected',
    hrd: 'HRD Positive (Score: 45)',
    msi: 'MSS (Microsatellite Stable)',
    tmb: 'Low (3 mutations/Mb)'
  };

  const emergencyContacts = {
    oncologist: { name: 'Dr. Sarah Chen', phone: '(206) 555-0123', email: 'schen@cancercenter.org' },
    primaryCare: { name: 'Dr. Michael Ross', phone: '(206) 555-0156', email: 'mross@healthcare.org' },
    hospital: { name: 'Seattle Cancer Center', phone: '(206) 555-0199', address: '1234 Medical Plaza, Seattle, WA' },
    emergency: { name: 'John (Husband)', phone: '(206) 555-0142', relation: 'Spouse' }
  };

  const trials = [
    {
      id: 'NCT05123456',
      name: 'Phase II PARP Inhibitor + Immunotherapy for OCCC',
      location: 'Fred Hutch Cancer Center',
      distance: '2.3 miles',
      match: '92%',
      phase: 'Phase II',
      status: 'Recruiting',
      matchReasons: ['BRCA1+', 'HRD+', 'Stage IIIC']
    },
    {
      id: 'NCT05234567',
      name: 'ARID1A-Targeted Therapy Study',
      location: 'UW Medicine',
      distance: '4.1 miles',
      match: '88%',
      phase: 'Phase I/II',
      status: 'Recruiting',
      matchReasons: ['ARID1A mutation', 'Clear cell histology']
    }
  ];

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load documents from Firestore when user logs in
  useEffect(() => {
    const loadDocuments = async () => {
      if (user) {
        try {
          const docs = await documentService.getDocuments(user.uid);
          setDocuments(docs);
        } catch (error) {
          console.error('Error loading documents:', error);
        }
      }
    };

    loadDocuments();
  }, [user]);

  // Manage FAB animations
  useEffect(() => {
    if (activeTab === 'dashboard') {
      setShowFab(true);
      setFabAnimating(false);
    } else {
      setFabAnimating(true);
      setShowFabMenu(false);
      const timer = setTimeout(() => {
        setShowFab(false);
        setFabAnimating(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    const userMessage = inputText;
    setInputText('');
    
    // Add user message immediately
    setMessages(prev => [...prev, { type: 'user', text: userMessage }]);
    
    try {
      // Call Gemini API via our serverless function
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.slice(-10).map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Check if AI extracted any values
        const hasValues = data.response.includes('logged') || data.response.includes('extracted');
        setMessages(prev => [...prev, { 
          type: 'ai', 
          text: data.response,
          isAnalysis: hasValues
        }]);
      } else {
        setMessages(prev => [...prev, { 
          type: 'ai', 
          text: `Sorry, I encountered an error: ${data.error}. Please try again.`
        }]);
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      setMessages(prev => [...prev, { 
        type: 'ai', 
        text: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment.'
      }]);
    }
  };

  const handleRealFileUpload = async (file, docType) => {
    if (!user) {
      alert('Please log in to upload files');
      return;
    }

    try {
      // Upload to Firebase Storage
      const result = await uploadDocument(file, user.uid, {
        category: docType,
        documentType: docType
      });

      console.log('File uploaded successfully:', result);

      // Add to local documents state
      const newDoc = {
        id: result.id,
        name: file.name,
        type: docType,
        date: new Date().toISOString().split('T')[0],
        fileUrl: result.fileUrl,
        storagePath: result.storagePath,
        icon: docType.toLowerCase()
      };

      setDocuments([newDoc, ...documents]);
      setMessages([...messages,
        { type: 'user', text: `Uploaded: ${file.name}`, isUpload: true },
        { type: 'ai', text: `Document uploaded successfully to Firebase Storage. File is securely stored and accessible.`, isAnalysis: true }
      ]);
      setShowUploadDemo(false);
      setActiveTab('chat');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file: ' + error.message);
    }
  };

  const simulateDocumentUpload = (docType) => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleRealFileUpload(file, docType);
      }
    };

    input.click();
  };

  const currentLab = allLabData[selectedLab];

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out: ' + error.message);
    }
  };

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-green-600 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <Login onLoginSuccess={() => setUser(auth.currentUser)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <style>{styles}</style>

        {/* Header - Responsive */}
        <div className="bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">CancerCare</h1>
                <p className="text-xs sm:text-sm text-gray-600">Ovarian Cancer • Stage IIIC</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('profile')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto pb-20">
          {activeTab === 'dashboard' && (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* AI Alert */}
              <div className="bg-amber-50 border-l-4 border-amber-500 p-3 sm:p-4 rounded">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-amber-800 font-medium text-sm">CA-125 Trending Up</p>
                    <p className="text-amber-700 text-xs sm:text-sm mt-1">
                      Rose from 55 → 62 in 8 days (13% increase). Consider discussing with oncologist.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Stats - Responsive Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm text-gray-600">CA-125</span>
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">62</p>
                  <p className="text-xs text-orange-600 mt-1">Above normal</p>
                </div>
                
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm text-gray-600">WBC</span>
                    <Activity className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">5.8</p>
                  <p className="text-xs text-green-600 mt-1">Normal range</p>
                </div>

                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm text-gray-600">Energy</span>
                    <Activity className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">6/10</p>
                  <p className="text-xs text-gray-600 mt-1">Today</p>
                </div>

                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm text-gray-600">Treatment</span>
                    <Activity className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">Day 12</p>
                  <p className="text-xs text-gray-600 mt-1">Cycle 3</p>
                </div>
              </div>

              {/* Two Column Layout on larger screens */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Genomic Profile Card */}
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow p-4 border border-purple-200">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Genomic Profile
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">BRCA1 Pathogenic</span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">HRD Score: 68</span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">TP53 WT</span>
                    <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">ARID1A Mut</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">TMB-High</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="text-purple-600 text-sm font-medium mt-3 hover:underline"
                  >
                    View Full Profile →
                  </button>
                </div>

                {/* Upcoming Appointment */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Next Appointment</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Dr. Chen - Oncology</p>
                      <p className="text-sm text-gray-600">Jan 15, 2025 at 10:30 AM</p>
                    </div>
                    <span className="text-blue-600 font-medium text-sm">18 days</span>
                  </div>
                </div>
              </div>

              {/* Top Trials */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <TrendingUp size={18} className="mr-2" />
                  Top Trial Matches
                </h3>
                {trials.slice(0, 2).map((trial, idx) => (
                  <div key={idx} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm flex-1">{trial.name}</p>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium ml-2">{trial.match}</span>
                    </div>
                    <p className="text-xs text-gray-600">{trial.location} • {trial.distance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      msg.type === 'user' 
                        ? 'bg-green-600 text-white' 
                        : msg.isAnalysis
                          ? 'bg-purple-50 border border-purple-200 text-gray-800'
                          : 'bg-white border border-gray-200 text-gray-900'
                    }`}>
                      <p className="text-sm sm:text-base">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about symptoms, treatments, or upload results..."
                    className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm sm:text-base focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-green-600 text-white p-2.5 rounded-full hover:bg-green-700 transition flex-shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="p-4 space-y-4">
              {/* Health Section Tabs */}
              <div className="flex justify-center gap-2 bg-white rounded-lg p-1 shadow">
                {['labs', 'symptoms', 'medications', 'files'].map(section => (
                  <button
                    key={section}
                    onClick={() => setHealthSection(section)}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                      healthSection === section
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {section === 'labs' && 'Labs'}
                    {section === 'symptoms' && 'Symptoms'}
                    {section === 'medications' && 'Meds'}
                    {section === 'files' && 'Files'}
                  </button>
                ))}
              </div>

              {healthSection === 'labs' && (
                <>
                  {/* Labs/Vitals Toggle */}
                  <div className="flex justify-center gap-2 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                    <button
                      onClick={() => setLabViewMode('labs')}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                        labViewMode === 'labs'
                          ? 'bg-green-600 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Lab Values
                    </button>
                    <button
                      onClick={() => setLabViewMode('vitals')}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                        labViewMode === 'vitals'
                          ? 'bg-green-600 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Vitals
                    </button>
                  </div>

                  {labViewMode === 'labs' ? (
                    <>
                      {/* AI Alert */}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-amber-900">AI Alert: Possible Progression</p>
                            <p className="text-xs text-amber-700 mt-1">
                              CA-125 has risen 63% over 2 months. Consider imaging to assess disease status.
                            </p>
                          </div>
                        </div>
                      </div>

                  {/* Lab Trend Chart */}
                  <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900">Lab Trends</h2>
                      <select 
                        value={selectedLab}
                        onChange={(e) => setSelectedLab(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 focus:ring-2 focus:ring-green-500"
                      >
                        {Object.keys(allLabData).map(key => (
                          <option key={key} value={key}>{allLabData[key].name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-2xl sm:text-3xl font-bold text-gray-900">{currentLab.current}</span>
                        <span className="text-sm text-gray-600">{currentLab.unit}</span>
                        <span className={`ml-auto text-xs px-2 py-1 rounded-full ${
                          currentLab.status === 'warning' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {currentLab.status === 'warning' ? 'High' : 'Normal'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600">Normal range: {currentLab.normalRange} {currentLab.unit}</p>
                    </div>

                    {/* Chart - Responsive with Y-axis and hover tooltips */}
                    <div className="flex gap-3">
                      {/* Y-axis labels */}
                      <div className="flex flex-col justify-between text-xs text-gray-600 font-medium py-2" style={{ paddingBottom: '1.5rem' }}>
                        {(() => {
                          const values = currentLab.data.map(d => d.value);
                          const minVal = Math.min(...values);
                          const maxVal = Math.max(...values);
                          const range = maxVal - minVal;
                          const padding = range * 0.2;
                          const yMin = Math.floor(minVal - padding);
                          const yMax = Math.ceil(maxVal + padding);
                          const step = (yMax - yMin) / 4;
                          
                          return [4, 3, 2, 1, 0].map(i => (
                            <div key={i} className="text-right pr-2 w-10" style={{ lineHeight: '1' }}>
                              {(yMin + (step * i)).toFixed(maxVal > 100 ? 0 : 1)}
                            </div>
                          ));
                        })()}
                      </div>

                      {/* Chart area */}
                      <div className="flex-1">
                        <div className="relative h-40 mb-3">
                          {/* Horizontal grid lines */}
                          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            {[0, 1, 2, 3, 4].map(i => (
                              <div key={i} className="border-t border-gray-200"></div>
                            ))}
                          </div>

                          {/* SVG Graph */}
                          {(() => {
                            const values = currentLab.data.map(d => d.value);
                            const minVal = Math.min(...values);
                            const maxVal = Math.max(...values);
                            const range = maxVal - minVal;
                            const padding = range * 0.2;
                            const yMin = Math.floor(minVal - padding);
                            const yMax = Math.ceil(maxVal + padding);
                            const yRange = yMax - yMin;
                            
                            return (
                              <>
                                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="none">
                                  <defs>
                                    <linearGradient id={`gradient-${selectedLab}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor={currentLab.status === 'warning' ? '#f97316' : '#10b981'} stopOpacity="0.2" />
                                      <stop offset="100%" stopColor={currentLab.status === 'warning' ? '#f97316' : '#10b981'} stopOpacity="0.05" />
                                    </linearGradient>
                                  </defs>
                                  
                                  {/* Area under line */}
                                  <polygon
                                    points={(() => {
                                      const topPoints = currentLab.data.map((d, i) => 
                                        `${(i / (currentLab.data.length - 1)) * 400},${160 - ((d.value - yMin) / yRange) * 160}`
                                      ).join(' ');
                                      return `${topPoints} 400,160 0,160`;
                                    })()}
                                    fill={`url(#gradient-${selectedLab})`}
                                  />
                                  
                                  {/* Line */}
                                  <polyline
                                    points={currentLab.data.map((d, i) => 
                                      `${(i / (currentLab.data.length - 1)) * 400},${160 - ((d.value - yMin) / yRange) * 160}`
                                    ).join(' ')}
                                    fill="none"
                                    stroke={currentLab.status === 'warning' ? '#f97316' : '#10b981'}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>

                                {/* Interactive data points with tooltips */}
                                {currentLab.data.map((d, i) => {
                                  const x = (i / (currentLab.data.length - 1)) * 100;
                                  const y = ((d.value - yMin) / yRange) * 100;
                                  const isLatest = i === currentLab.data.length - 1;
                                  
                                  return (
                                    <div
                                      key={i}
                                      className="absolute group cursor-pointer"
                                      style={{
                                        left: `${x}%`,
                                        bottom: `${y}%`,
                                        transform: 'translate(-50%, 50%)'
                                      }}
                                    >
                                      {/* Hover area */}
                                      <div className="absolute inset-0 w-10 h-10 -m-5"></div>
                                      
                                      {/* Outer ring on hover */}
                                      <div 
                                        className="absolute inset-0 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          margin: '-10px',
                                          border: `2px solid ${currentLab.status === 'warning' ? '#f97316' : '#10b981'}`,
                                          backgroundColor: currentLab.status === 'warning' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                                        }}
                                      />
                                      
                                      {/* Data point dot */}
                                      <div 
                                        className={`rounded-full transition-all relative z-10 group-hover:scale-125 ${
                                          isLatest ? 'w-3.5 h-3.5' : 'w-3 h-3'
                                        }`}
                                        style={{
                                          backgroundColor: currentLab.status === 'warning' ? '#f97316' : '#10b981',
                                          border: '2px solid white',
                                          boxShadow: isLatest 
                                            ? '0 2px 8px rgba(0,0,0,0.25)' 
                                            : '0 1px 4px rgba(0,0,0,0.15)'
                                        }}
                                      />
                                      
                                      {/* Tooltip */}
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                                          <div className="font-bold text-sm">{d.value} {currentLab.unit}</div>
                                          <div className="text-gray-300 text-center text-xs mt-0.5">{d.date}</div>
                                          {/* Arrow */}
                                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                                            <div className="border-4 border-transparent border-t-gray-900"></div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </div>

                        {/* X-axis labels */}
                        <div className="flex justify-between border-t border-gray-300 pt-2 text-xs text-gray-600">
                          {currentLab.data.map((d, i) => (
                            <span key={i} className="hidden sm:inline">{d.date}</span>
                          ))}
                          <span className="sm:hidden">{currentLab.data[0].date}</span>
                          <span className="sm:hidden">{currentLab.data[currentLab.data.length - 1].date}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lab Value Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {Object.entries(allLabData).slice(0, 6).map(([key, lab]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedLab(key)}
                        className={`bg-white rounded-lg shadow p-3 text-left transition-all hover:shadow-md ${
                          selectedLab === key ? 'ring-2 ring-blue-500 shadow-md' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-600 font-medium">{lab.name}</p>
                          <span className={`text-xs font-medium ${
                            lab.status === 'warning' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {lab.trend === 'up' ? '↑' : lab.trend === 'down' ? '↓' : '→'}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-gray-800">{lab.current}</p>
                        <p className="text-xs text-gray-500">{lab.unit}</p>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowAddLab(true)}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
                  >
                    + Add Lab Value to Track
                  </button>
                    </>
                  ) : (
                    <>
                      {/* Vitals Section */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-blue-900">Vitals Monitoring</p>
                            <p className="text-xs text-blue-700 mt-1">
                              All vitals within normal range. Weight trending down slightly.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Vital Trend Chart */}
                      <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Vital Signs</h2>
                          <select 
                            value={selectedVital}
                            onChange={(e) => setSelectedVital(e.target.value)}
                            className="text-sm border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 focus:ring-2 focus:ring-green-500"
                          >
                            {Object.keys(allVitalsData).map(key => (
                              <option key={key} value={key}>{allVitalsData[key].name}</option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const currentVital = allVitalsData[selectedVital];
                          return (
                            <>
                              <div className="mb-4">
                                <div className="flex items-baseline gap-2 mb-1">
                                  <span className="text-2xl sm:text-3xl font-bold text-gray-900">{currentVital.current}</span>
                                  <span className="text-sm text-gray-600">{currentVital.unit}</span>
                                  <span className={`ml-auto text-xs px-2 py-1 rounded-full ${
                                    currentVital.status === 'warning' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                  }`}>
                                    {currentVital.status === 'warning' ? 'Abnormal' : 'Normal'}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-600">Normal range: {currentVital.normalRange} {currentVital.unit}</p>
                              </div>

                              {/* Chart */}
                              <div className="h-48 sm:h-64">
                                <div className="relative h-full border-l-2 border-b-2 border-gray-300">
                                  <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                                    <polyline
                                      fill="none"
                                      stroke="#10b981"
                                      strokeWidth="3"
                                      points={currentVital.data.map((point, idx) => {
                                        const x = (idx / (currentVital.data.length - 1)) * 380 + 10;
                                        const maxVal = Math.max(...currentVital.data.map(d => selectedVital === 'bp' ? d.systolic : d.value));
                                        const minVal = Math.min(...currentVital.data.map(d => selectedVital === 'bp' ? (d.diastolic || d.value) : d.value));
                                        const range = maxVal - minVal || 1;
                                        const val = selectedVital === 'bp' ? point.systolic : point.value;
                                        const y = 180 - ((val - minVal) / range) * 160;
                                        return `${x},${y}`;
                                      }).join(' ')}
                                    />
                                    {currentVital.data.map((point, idx) => {
                                      const x = (idx / (currentVital.data.length - 1)) * 380 + 10;
                                      const maxVal = Math.max(...currentVital.data.map(d => selectedVital === 'bp' ? d.systolic : d.value));
                                      const minVal = Math.min(...currentVital.data.map(d => selectedVital === 'bp' ? (d.diastolic || d.value) : d.value));
                                      const range = maxVal - minVal || 1;
                                      const val = selectedVital === 'bp' ? point.systolic : point.value;
                                      const y = 180 - ((val - minVal) / range) * 160;
                                      return (
                                        <g key={idx}>
                                          <circle cx={x} cy={y} r="4" fill="#10b981" />
                                          <text x={x} y="195" textAnchor="middle" fontSize="10" fill="#666">{point.date}</text>
                                        </g>
                                      );
                                    })}
                                  </svg>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Quick Vital Stats */}
                      <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="font-semibold text-gray-800 mb-3">All Vitals (Latest)</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(allVitalsData).map(([key, vital]) => (
                            <button
                              key={key}
                              onClick={() => setSelectedVital(key)}
                              className={`p-3 rounded-lg border-2 transition text-left ${
                                selectedVital === key
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <p className="text-xs text-gray-600 mb-0.5">{vital.name}</p>
                              <p className="text-lg font-bold text-gray-900">{vital.current}</p>
                              <p className="text-xs text-gray-500">{vital.unit}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => setShowAddVital(true)}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
                      >
                        + Log Vital Reading
                      </button>
                    </>
                  )}
                </>
              )}

              {healthSection === 'symptoms' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">AI Pattern Detection</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Fatigue symptoms correlate with rising CA-125, suggesting progression.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Symptom Calendar */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">December 2024</h3>
                      <button
                        onClick={() => setShowQuickLog(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Symptom
                      </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        // December 2024 starts on Sunday (day 0)
                        const daysInMonth = 31;
                        const firstDayOfWeek = 0; // Sunday
                        const calendar = [];
                        
                        // Symptom data mapped to dates
                        const symptomsByDate = {
                          '26': [
                            { type: 'Nausea', severity: 'Mild', time: '2:00 PM' },
                          ],
                          '27': [
                            { type: 'Pain', severity: 'Mild', time: '9:00 AM' },
                            { type: 'Fatigue', severity: 'Moderate', time: '3:00 PM' },
                          ],
                          '28': [
                            { type: 'Fatigue', severity: 'Moderate', time: '10:00 AM' },
                            { type: 'Nausea', severity: 'Mild', time: '1:00 PM' },
                          ],
                          '24': [
                            { type: 'Pain', severity: 'Moderate', time: '8:00 AM' },
                          ],
                          '23': [
                            { type: 'Fatigue', severity: 'Severe', time: '11:00 AM' },
                          ],
                          '20': [
                            { type: 'Nausea', severity: 'Moderate', time: '4:00 PM' },
                            { type: 'Headache', severity: 'Mild', time: '6:00 PM' },
                          ],
                          '18': [
                            { type: 'Fatigue', severity: 'Mild', time: '2:00 PM' },
                          ],
                          '15': [
                            { type: 'Pain', severity: 'Mild', time: '7:00 AM' },
                          ],
                          '12': [
                            { type: 'Nausea', severity: 'Severe', time: '12:00 PM' },
                          ],
                          '10': [
                            { type: 'Fatigue', severity: 'Moderate', time: '9:00 AM' },
                          ],
                          '8': [
                            { type: 'Headache', severity: 'Mild', time: '5:00 PM' },
                          ],
                          '5': [
                            { type: 'Pain', severity: 'Moderate', time: '10:00 AM' },
                          ],
                        };
                        
                        // Symptom type colors
                        const symptomColors = {
                          'Fatigue': 'bg-blue-500',
                          'Pain': 'bg-red-500',
                          'Nausea': 'bg-green-500',
                          'Headache': 'bg-purple-500',
                          'Dizziness': 'bg-yellow-500',
                          'Other': 'bg-gray-500'
                        };
                        
                        // Add empty cells for days before month starts
                        for (let i = 0; i < firstDayOfWeek; i++) {
                          calendar.push(
                            <div key={`empty-${i}`} className="aspect-square"></div>
                          );
                        }
                        
                        // Add days of month
                        for (let day = 1; day <= daysInMonth; day++) {
                          const dayStr = day.toString();
                          const hasSymptoms = symptomsByDate[dayStr];
                          const isToday = day === 28;
                          const uniqueSymptomTypes = hasSymptoms ? [...new Set(hasSymptoms.map(s => s.type))] : [];
                          
                          calendar.push(
                            <button
                              key={day}
                              onClick={() => {
                                if (hasSymptoms) {
                                  if (selectedDate === dayStr) {
                                    setSelectedDate(null);
                                  } else {
                                    setSelectedDate(dayStr);
                                  }
                                }
                              }}
                              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all relative ${
                                isToday 
                                  ? 'bg-green-100 border-2 border-green-500 font-bold' 
                                  : hasSymptoms
                                    ? 'hover:bg-gray-100 border border-gray-200'
                                    : 'border border-transparent text-gray-400'
                              } ${selectedDate === dayStr ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                            >
                              <span className={isToday ? 'text-green-700' : hasSymptoms ? 'text-gray-900' : ''}>{day}</span>
                              
                              {/* Symptom dots */}
                              {hasSymptoms && (
                                <div className="flex gap-0.5 mt-1">
                                  {uniqueSymptomTypes.slice(0, 3).map((type, idx) => (
                                    <div
                                      key={idx}
                                      className={`w-1.5 h-1.5 rounded-full ${symptomColors[type] || symptomColors['Other']}`}
                                      title={type}
                                    />
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        }
                        
                        return (
                          <>
                            {calendar}
                            
                            {/* Selected Date Details */}
                            {selectedDate && symptomsByDate[selectedDate] && (
                              <div className="col-span-7 mt-4 bg-gray-50 rounded-lg p-4 animate-fade-scale">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-gray-800">December {selectedDate}, 2024</h4>
                                  <button
                                    onClick={() => setSelectedDate(null)}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                
                                <div className="space-y-2">
                                  {symptomsByDate[selectedDate].map((symptom, idx) => (
                                    <div
                                      key={idx}
                                      className={`border-l-4 pl-3 py-2 rounded-r ${
                                        symptom.severity === 'Severe' ? 'border-red-400 bg-red-50' :
                                        symptom.severity === 'Moderate' ? 'border-yellow-400 bg-yellow-50' :
                                        'border-green-400 bg-green-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${symptomColors[symptom.type] || symptomColors['Other']}`}></div>
                                          <p className="text-sm font-medium">{symptom.type}</p>
                                        </div>
                                        <span className="text-xs text-gray-600">{symptom.time}</span>
                                      </div>
                                      <p className={`text-xs font-medium ${
                                        symptom.severity === 'Severe' ? 'text-red-700' :
                                        symptom.severity === 'Moderate' ? 'text-yellow-700' :
                                        'text-green-700'
                                      }`}>
                                        {symptom.severity}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h4 className="font-semibold text-gray-800 mb-3 text-sm">Symptom Types</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { type: 'Fatigue', color: 'bg-blue-500' },
                        { type: 'Pain', color: 'bg-red-500' },
                        { type: 'Nausea', color: 'bg-green-500' },
                        { type: 'Headache', color: 'bg-purple-500' },
                        { type: 'Dizziness', color: 'bg-yellow-500' },
                        { type: 'Other', color: 'bg-gray-500' },
                      ].map(item => (
                        <div key={item.type} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                          <span className="text-xs text-gray-700">{item.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {healthSection === 'medications' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Medication Adherence</p>
                        <p className="text-xs text-blue-700 mt-1">
                          All medications taken on schedule. Next IV infusion scheduled for Jan 5.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Active Medications */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Active Medications</h3>
                    <div className="space-y-3">
                      {medications.filter(med => med.active).map(med => {
                        const colorClasses = {
                          purple: 'bg-purple-100 border-purple-300 text-purple-800',
                          blue: 'bg-blue-100 border-blue-300 text-blue-800',
                          green: 'bg-green-100 border-green-300 text-green-800',
                          orange: 'bg-orange-100 border-orange-300 text-orange-800',
                          teal: 'bg-teal-100 border-teal-300 text-teal-800',
                        };
                        
                        return (
                          <div key={med.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">{med.name}</h4>
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClasses[med.color]}`}>
                                    {med.purpose}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">{med.dosage}</span> • {med.frequency}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                              <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-0.5">Next dose</p>
                                <p className="text-sm font-medium text-gray-800">
                                  {new Date(med.nextDose).toLocaleString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: med.schedule.includes(':') ? 'numeric' : undefined,
                                    minute: med.schedule.includes(':') ? '2-digit' : undefined
                                  })}
                                </p>
                              </div>
                              {med.schedule.includes(':') && (
                                (() => {
                                  const times = med.schedule.split(',').map(t => t.trim());
                                  const nextTime = times[0]; // Use first scheduled time for today
                                  const taken = isMedicationTaken(med.id, nextTime);
                                  
                                  return taken ? (
                                    <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg">
                                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      <span className="text-xs font-medium text-green-700">Taken</span>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => markMedicationTaken(med.id, nextTime)}
                                      className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 transition font-medium"
                                    >
                                      Mark Taken
                                    </button>
                                  );
                                })()
                              )}
                            </div>
                            
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <p className="text-xs text-gray-600">
                                <span className="font-medium">Schedule:</span> {med.schedule}
                              </p>
                              {med.instructions && (
                                <p className="text-xs text-gray-600 mt-1">
                                  <span className="font-medium">Instructions:</span> {med.instructions}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Upcoming Doses */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Today's Schedule</h3>
                    <div className="space-y-2">
                      {medications
                        .filter(med => med.active && med.schedule.includes(':'))
                        .flatMap(med => 
                          med.schedule.split(',').map(time => ({
                            ...med,
                            specificTime: time.trim()
                          }))
                        )
                        .sort((a, b) => a.specificTime.localeCompare(b.specificTime))
                        .map((med, idx) => {
                          const taken = isMedicationTaken(med.id, med.specificTime);
                          
                          return (
                            <button
                              key={`schedule-${med.id}-${idx}`}
                              onClick={() => !taken && markMedicationTaken(med.id, med.specificTime)}
                              className={`w-full flex items-center gap-3 p-2 border-2 rounded-lg transition ${
                                taken 
                                  ? 'border-green-300 bg-green-50 cursor-default' 
                                  : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
                              }`}
                            >
                              <div className="text-sm font-semibold text-gray-700 w-20">
                                {med.specificTime}
                              </div>
                              <div className="flex-1 text-left">
                                <p className="text-sm font-medium text-gray-900">{med.name}</p>
                                <p className="text-xs text-gray-600">{med.dosage}</p>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                taken ? 'border-green-500 bg-green-500' : 'border-gray-300'
                              }`}>
                                {taken && (
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAddMedication(true)}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
                  >
                    + Add Medication
                  </button>
                </>
              )}

              {healthSection === 'files' && (
                <>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-purple-900">AI Document Analysis</p>
                        <p className="text-xs text-purple-700 mt-1">
                          12 documents processed. Next suggested upload: Recent imaging (last scan was Dec 20).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-3">Medical Documents</h3>
                    <div className="space-y-2">
                      {documents.map(doc => {
                        // Define icon and color based on document type
                        const getIconConfig = (type) => {
                          switch(type) {
                            case 'Lab':
                              return {
                                bgColor: 'bg-blue-100',
                                iconColor: 'text-blue-600',
                                icon: (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                  </svg>
                                )
                              };
                            case 'Scan':
                              return {
                                bgColor: 'bg-purple-100',
                                iconColor: 'text-purple-600',
                                icon: (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                )
                              };
                            case 'Report':
                              return {
                                bgColor: 'bg-green-100',
                                iconColor: 'text-green-600',
                                icon: (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )
                              };
                            case 'Genomic':
                              return {
                                bgColor: 'bg-amber-100',
                                iconColor: 'text-amber-600',
                                icon: (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                  </svg>
                                )
                              };
                            default:
                              return {
                                bgColor: 'bg-gray-100',
                                iconColor: 'text-gray-600',
                                icon: (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )
                              };
                          }
                        };
                        
                        const iconConfig = getIconConfig(doc.type);
                        
                        return (
                          <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition">
                            <div className={`w-10 h-10 ${iconConfig.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                              <div className={iconConfig.iconColor}>
                                {iconConfig.icon}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.name}</p>
                              <p className="text-xs text-gray-600">
                                {new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {doc.type}
                              </p>
                            </div>
                            {doc.fileUrl ? (
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View
                              </a>
                            ) : (
                              <div className="flex-shrink-0">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowUploadDemo(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2"
                  >
                    <Upload size={18} />
                    Upload Document
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'trials' && (
            <div className="p-4 space-y-4">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                <h3 className="font-semibold text-gray-800 mb-2">AI Trial Matching</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Based on genomic profile (BRCA1+, HRD+, ARID1A mutation)
                </p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">BRCA1+</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">HRD+</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">ARID1A Mut</span>
                </div>
                <button 
                  onClick={() => setShowEditLocation(true)}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium mt-3 flex items-center gap-1"
                >
                  <MapPin className="w-4 h-4" />
                  Edit Location
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {trials.map((trial) => (
                  <div key={trial.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            {trial.phase}
                          </span>
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                            {trial.status}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm">{trial.name}</h3>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold ml-2">{trial.match}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-gray-600 mb-3">
                      <MapPin className="w-3 h-3" />
                      <span>{trial.location} • {trial.distance}</span>
                    </div>

                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-700 mb-1">Why this matches:</p>
                      <div className="flex flex-wrap gap-1">
                        {trial.matchReasons.map((reason, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="p-4 space-y-4">
              {/* Patient Info */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        MJ
                      </div>
                    )}
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => setProfileImage(e.target.result);
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                      className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-700 transition"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1">
                    <h2 className="font-bold text-lg">Mary Johnson</h2>
                    <p className="text-sm text-gray-600">Age: 58</p>
                    <p className="text-sm text-gray-600">DOB: 03/15/1966</p>
                    <button
                      onClick={() => setShowEditInfo(true)}
                      className="text-blue-600 text-sm font-medium mt-1 hover:underline"
                    >
                      Edit Information
                    </button>
                  </div>
                </div>
              </div>

              {/* Current Status */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-800">Current Status</h2>
                  <button
                    onClick={() => setShowUpdateStatus(true)}
                    className="text-blue-600 text-sm font-medium hover:underline"
                  >
                    Update
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Diagnosis:</span>
                    <span className="font-medium">Stage IIIC OCCC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Treatment Status:</span>
                    <span className="font-medium">Maintenance Therapy</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ECOG Performance:</span>
                    <span className="font-medium">1</span>
                  </div>
                </div>
              </div>

              {/* Genomic Profile */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800 text-lg">Genomic Profile</h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setGenomicExpanded(!genomicExpanded)}
                      className="text-purple-600 hover:text-purple-700 flex items-center gap-1 text-sm font-medium"
                    >
                      {genomicExpanded ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Collapse
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Expand
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => setShowEditGenomic(true)}
                      className="text-purple-600 hover:text-purple-700"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Summary View - Always Visible */}
                <div className="bg-white rounded-lg p-3 mb-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">BRCA1 Pathogenic</span>
                    <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">ARID1A Mut</span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">TP53 WT</span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">HRD: 68</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">TMB-High</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {genomicExpanded && (
                  <div className="space-y-3 animate-fade-scale">
                    {/* Key Mutations */}
                    <div className="bg-white rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                        Germline & Somatic Mutations
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between p-2 bg-red-50 border border-red-200 rounded">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 text-sm">BRCA1</span>
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium">Pathogenic</span>
                            </div>
                            <p className="text-xs text-gray-700 mt-1">c.5266dupC (p.Gln1756Profs*74)</p>
                            <p className="text-xs text-gray-600 mt-1">Germline variant • Increased PARP inhibitor sensitivity</p>
                          </div>
                        </div>

                        <div className="flex items-start justify-between p-2 bg-orange-50 border border-orange-200 rounded">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 text-sm">ARID1A</span>
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-medium">Mutated</span>
                            </div>
                            <p className="text-xs text-gray-700 mt-1">c.3760C>T (p.Arg1254*)</p>
                            <p className="text-xs text-gray-600 mt-1">Somatic • Common in clear cell ovarian cancer</p>
                          </div>
                        </div>

                        <div className="flex items-start justify-between p-2 bg-green-50 border border-green-200 rounded">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 text-sm">TP53</span>
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">Wild-type</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">No pathogenic variants detected</p>
                          </div>
                        </div>

                        <div className="flex items-start justify-between p-2 bg-green-50 border border-green-200 rounded">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 text-sm">PIK3CA</span>
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">Wild-type</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">No pathogenic variants detected</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Biomarkers */}
                    <div className="bg-white rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Biomarkers
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                          <p className="text-xs text-gray-600 mb-1">HRD Score</p>
                          <p className="text-lg font-bold text-purple-900">68</p>
                          <p className="text-xs text-purple-700 font-medium">Positive (≥42)</p>
                        </div>

                        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs text-gray-600 mb-1">TMB</p>
                          <p className="text-lg font-bold text-blue-900">15.2</p>
                          <p className="text-xs text-blue-700 font-medium">High (>10 mut/Mb)</p>
                        </div>

                        <div className="p-2 bg-green-50 border border-green-200 rounded">
                          <p className="text-xs text-gray-600 mb-1">MSI Status</p>
                          <p className="text-sm font-bold text-green-900">MS-Stable</p>
                          <p className="text-xs text-green-700 font-medium">Microsatellite stable</p>
                        </div>

                        <div className="p-2 bg-teal-50 border border-teal-200 rounded">
                          <p className="text-xs text-gray-600 mb-1">PD-L1</p>
                          <p className="text-sm font-bold text-teal-900">8% TPS</p>
                          <p className="text-xs text-teal-700 font-medium">Low expression</p>
                        </div>
                      </div>
                    </div>

                    {/* Test Information */}
                    <div className="bg-white rounded-lg p-3">
                      <h3 className="font-semibold text-gray-800 mb-2 text-sm">Test Information</h3>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Test Type:</span>
                          <span className="font-medium text-gray-900">FoundationOne CDx</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Sample:</span>
                          <span className="font-medium text-gray-900">Tumor tissue (surgical)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Test Date:</span>
                          <span className="font-medium text-gray-900">Nov 10, 2024</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Genes Analyzed:</span>
                          <span className="font-medium text-gray-900">324 genes</span>
                        </div>
                      </div>
                    </div>

                    {/* Treatment Implications */}
                    <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-purple-700 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-xs font-semibold text-purple-900">Treatment Implications</p>
                          <p className="text-xs text-purple-800 mt-1">
                            BRCA1 mutation indicates high sensitivity to PARP inhibitors (Olaparib, Niraparib). 
                            HRD-positive status supports platinum-based chemotherapy.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Trial Location */}
              <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-lg shadow p-4 border border-green-200">
                <h2 className="font-semibold text-gray-800 mb-3">Trial Search Location</h2>
                <div className="bg-white rounded-lg p-3 mb-3">
                  <p className="text-sm text-gray-800 font-medium">
                    {trialLocation.city}, {trialLocation.state}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{trialLocation.country}</p>
                  {!trialLocation.includeAllLocations && (
                    <p className="text-xs text-gray-600 mt-1">
                      Search radius: {trialLocation.searchRadius} miles
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowEditLocation(true)}
                  className="w-full text-green-600 font-medium text-sm hover:bg-green-50 py-2 rounded transition"
                >
                  Edit Location Settings
                </button>
              </div>

              {/* Emergency Contacts */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-800">Emergency Contacts</h2>
                  <button 
                    onClick={() => setShowEditContacts(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={14} className="text-blue-600" />
                      <p className="text-xs text-gray-600 font-medium">Oncologist</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">Dr. Sarah Chen</p>
                    <p className="text-xs text-gray-600 mt-0.5">(206) 555-0123</p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={14} className="text-green-600" />
                      <p className="text-xs text-gray-600 font-medium">Primary Care</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">Dr. Michael Ross</p>
                    <p className="text-xs text-gray-600 mt-0.5">(206) 555-0156</p>
                  </div>

                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Home size={14} className="text-red-600" />
                      <p className="text-xs text-gray-600 font-medium">Hospital</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">Seattle Cancer Center</p>
                    <p className="text-xs text-gray-600 mt-0.5">1234 Medical Plaza, Seattle, WA</p>
                    <p className="text-xs text-gray-600">(206) 555-0199</p>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={14} className="text-orange-600" />
                      <p className="text-xs text-gray-600 font-medium">Emergency Contact</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">John (Husband)</p>
                    <p className="text-xs text-gray-600 mt-0.5">(206) 555-0142</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation - Fixed */}
        <div className="bg-white border-t px-2 sm:px-4 py-2 flex-shrink-0 fixed bottom-0 left-0 right-0 z-10">
          <div className="flex justify-around items-center">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition ${
                activeTab === 'dashboard' ? 'text-green-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Home className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs font-medium">Home</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition ${
                activeTab === 'chat' ? 'text-green-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs font-medium">Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition ${
                activeTab === 'health' ? 'text-green-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs font-medium">Health</span>
            </button>

            <button
              onClick={() => setActiveTab('trials')}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition ${
                activeTab === 'trials' ? 'text-green-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Search className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs font-medium">Trials</span>
            </button>
          </div>
        </div>

        {/* FAB - Only on Dashboard */}
        {(showFab || fabAnimating) && activeTab === 'dashboard' && (
          <button
            onClick={() => setShowFabMenu(!showFabMenu)}
            className={`fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-br from-green-600 to-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-40 hover:scale-110 transition-all ${
              fabAnimating ? 'animate-fab-out' : 'animate-fab-in'
            }`}
          >
            <Plus className={`w-7 h-7 transition-transform ${showFabMenu ? 'rotate-45' : ''}`} />
          </button>
        )}

        {/* Speed Dial Menu */}
        {showFabMenu && activeTab === 'dashboard' && showFab && (
          <div className="fixed bottom-36 right-4 z-30 flex flex-col gap-3">
            <button
              onClick={() => {
                setShowFabMenu(false);
                setShowQuickLog(true);
              }}
              className="flex items-center gap-3 bg-white rounded-full shadow-lg pl-4 pr-5 py-3 hover:shadow-xl transition-all animate-fade-scale"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">Quick Log</span>
            </button>

            <button
              onClick={() => {
                setShowFabMenu(false);
                alert('Camera opened for scanning');
              }}
              className="flex items-center gap-3 bg-white rounded-full shadow-lg pl-4 pr-5 py-3 hover:shadow-xl transition-all animate-fade-scale"
              style={{ animationDelay: '50ms' }}
            >
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">Scan File</span>
            </button>

            <button
              onClick={() => {
                setShowFabMenu(false);
                setShowUploadDemo(true);
              }}
              className="flex items-center gap-3 bg-white rounded-full shadow-lg pl-4 pr-5 py-3 hover:shadow-xl transition-all animate-fade-scale"
              style={{ animationDelay: '100ms' }}
            >
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">Add File</span>
            </button>
          </div>
        )}

        {/* Quick Log Overlay - 50% Bottom Sheet */}
        {showQuickLog && (
          <div className="fixed inset-0 z-50">
            <div
              onClick={() => setShowQuickLog(false)}
              className="absolute inset-0 bg-black bg-opacity-50"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-slide-up" style={{ height: '50vh' }}>
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-lg">Quick Health Log</h3>
                <button
                  onClick={() => setShowQuickLog(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                <p className="text-sm text-gray-600 mb-4">
                  Tell me about symptoms, energy levels, or anything you'd like to track for Mary.
                </p>

                <textarea
                  value={quickLogInput}
                  onChange={(e) => setQuickLogInput(e.target.value)}
                  placeholder="e.g., 'Fatigue 6/10 today, mild nausea after breakfast'"
                  className="w-full h-32 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />

                <button
                  onClick={() => {
                    if (quickLogInput.trim()) {
                      setMessages([...messages,
                        { type: 'user', text: quickLogInput },
                        { type: 'ai', text: 'Logged! I\'ve added this to Mary\'s health timeline.' }
                      ]);
                      setQuickLogInput('');
                      setShowQuickLog(false);
                      setActiveTab('chat');
                    }
                  }}
                  className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  Log & Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Log Symptom Modal */}
        {showQuickLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Log Symptom</h3>
                <button
                  onClick={() => setShowQuickLog(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Quick Symptom Logging</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Track your symptoms to help identify patterns and inform your care team.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Symptom Type <span className="text-red-600">*</span>
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select symptom type...</option>
                      <option value="fatigue">Fatigue</option>
                      <option value="pain">Pain</option>
                      <option value="nausea">Nausea</option>
                      <option value="headache">Headache</option>
                      <option value="dizziness">Dizziness</option>
                      <option value="fever">Fever</option>
                      <option value="shortness">Shortness of Breath</option>
                      <option value="appetite">Loss of Appetite</option>
                      <option value="sleep">Sleep Issues</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Severity <span className="text-red-600">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button className="border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 rounded-lg py-3 text-center transition">
                        <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
                        <div className="text-sm font-medium text-gray-700">Mild</div>
                      </button>
                      <button className="border-2 border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 rounded-lg py-3 text-center transition">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto mb-1"></div>
                        <div className="text-sm font-medium text-gray-700">Moderate</div>
                      </button>
                      <button className="border-2 border-gray-300 hover:border-red-500 hover:bg-red-50 rounded-lg py-3 text-center transition">
                        <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-1"></div>
                        <div className="text-sm font-medium text-gray-700">Severe</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        defaultValue="2024-12-28"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <input
                        type="time"
                        defaultValue="14:30"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes <span className="text-gray-500 text-xs">(optional)</span>
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Additional details about the symptom..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    ></textarea>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Quick Actions:</p>
                    <div className="flex flex-wrap gap-2">
                      <button className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1.5 hover:bg-gray-100 transition">
                        Related to treatment
                      </button>
                      <button className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1.5 hover:bg-gray-100 transition">
                        Discuss with doctor
                      </button>
                      <button className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1.5 hover:bg-gray-100 transition">
                        Medication needed
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowQuickLog(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickLog(false);
                      alert('Symptom logged successfully!');
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Log Symptom
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Medication Modal */}
        {showAddMedication && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Add Medication</h3>
                <button
                  onClick={() => setShowAddMedication(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Medication Tracking</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Add any medication to track dosage, schedule, and adherence.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Medication Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Paclitaxel, Ibuprofen"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dosage <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 20"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit <span className="text-red-600">*</span>
                      </label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select...</option>
                        <option value="mg">mg</option>
                        <option value="mg/m²">mg/m²</option>
                        <option value="mg/kg">mg/kg</option>
                        <option value="mcg">mcg</option>
                        <option value="mL">mL</option>
                        <option value="units">units</option>
                        <option value="tablets">tablet(s)</option>
                        <option value="capsules">capsule(s)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Frequency <span className="text-red-600">*</span>
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select frequency...</option>
                      <option value="once-daily">Once daily</option>
                      <option value="twice-daily">Twice daily</option>
                      <option value="three-daily">Three times daily</option>
                      <option value="four-daily">Four times daily</option>
                      <option value="every-other">Every other day</option>
                      <option value="weekly">Weekly</option>
                      <option value="every-2-weeks">Every 2 weeks</option>
                      <option value="every-3-weeks">Every 3 weeks</option>
                      <option value="monthly">Monthly</option>
                      <option value="as-needed">As needed</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time(s) of Day
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 8:00 AM, 8:00 PM"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">For daily medications, specify times</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Purpose/Type <span className="text-red-600">*</span>
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select purpose...</option>
                      <option value="chemotherapy">Chemotherapy</option>
                      <option value="targeted">Targeted therapy</option>
                      <option value="immunotherapy">Immunotherapy</option>
                      <option value="hormone">Hormone therapy</option>
                      <option value="anti-nausea">Anti-nausea</option>
                      <option value="pain">Pain management</option>
                      <option value="anti-inflammatory">Anti-inflammatory</option>
                      <option value="antibiotic">Antibiotic</option>
                      <option value="stomach">Stomach protection</option>
                      <option value="vitamin">Vitamin/Supplement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      defaultValue="2024-12-28"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Special Instructions <span className="text-gray-500 text-xs">(optional)</span>
                    </label>
                    <textarea
                      rows="2"
                      placeholder="e.g., Take with food, Avoid grapefruit"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddMedication(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMedication(false);
                      alert('Medication added successfully!');
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Add Medication
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Upload Demo Modal */}
        {showUploadDemo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-lg md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Upload Medical Documents</h3>
                  <p className="text-xs text-blue-100 mt-0.5">AI will automatically process and categorize</p>
                </div>
                <button 
                  onClick={() => setShowUploadDemo(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">Intelligent Document Processing</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Upload any medical document. Our AI will automatically identify the type, extract key information like lab values and dates, and update your health records.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Select document type:</p>

                  <button
                    onClick={() => simulateDocumentUpload('Lab')}
                    className="w-full bg-white border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition group"
                  >
                    <div className="p-4 flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:shadow-lg transition">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 text-base">Laboratory Results</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Blood work, CBC panels, tumor markers (CA-125, CEA, PSA), chemistry panels, kidney/liver function tests
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-blue-600 font-medium">Auto-extracts values & trends</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => simulateDocumentUpload('Scan')}
                    className="w-full bg-white border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 rounded-xl transition group"
                  >
                    <div className="p-4 flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:shadow-lg transition">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 text-base">Imaging & Scans</div>
                        <div className="text-sm text-gray-600 mt-1">
                          CT scans, MRI reports, PET scans, X-rays, ultrasound results with radiologist interpretations
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-purple-600 font-medium">Identifies findings & measurements</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => simulateDocumentUpload('Report')}
                    className="w-full bg-white border-2 border-green-200 hover:border-green-400 hover:bg-green-50 rounded-xl transition group"
                  >
                    <div className="p-4 flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:shadow-lg transition">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 text-base">Clinical Reports</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Oncology notes, pathology reports, treatment summaries, hospital discharge papers, consultation notes
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-green-600 font-medium">Summarizes key treatment info</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => simulateDocumentUpload('Genomic')}
                    className="w-full bg-white border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 rounded-xl transition group"
                  >
                    <div className="p-4 flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:shadow-lg transition">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 text-base">Genomic Test Results</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Foundation One, Guardant360, Tempus xT, BRCA testing, MSI/MMR status, OncoType DX, mutation panels
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-amber-600 font-medium">Matches mutations to clinical trials</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex-shrink-0 border-t bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>All documents are encrypted and HIPAA compliant</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Lab Modal */}
        {showAddLab && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Add Lab Value to Track</h3>
                <button
                  onClick={() => {
                    setShowAddLab(false);
                    setNewLabData({ label: '', normalRange: '', unit: '' });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Custom Lab Tracking</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Select a common marker or add your own custom lab value. The AI will track trends and alert you to significant changes.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lab Value to Track <span className="text-red-600">*</span>
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const selected = JSON.parse(e.target.value);
                        setNewLabData({ 
                          label: selected.name, 
                          normalRange: selected.range, 
                          unit: selected.unit 
                        });
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a common lab marker...</option>
                    
                    <optgroup label="Tumor Markers">
                      <option value={JSON.stringify({ name: 'CA-125', range: '<35', unit: 'U/mL' })}>CA-125 (Ovarian) - &lt;35 U/mL</option>
                      <option value={JSON.stringify({ name: 'CA 19-9', range: '<37', unit: 'U/mL' })}>CA 19-9 (Pancreatic) - &lt;37 U/mL</option>
                      <option value={JSON.stringify({ name: 'CA 15-3', range: '<30', unit: 'U/mL' })}>CA 15-3 (Breast) - &lt;30 U/mL</option>
                      <option value={JSON.stringify({ name: 'CEA', range: '<3', unit: 'ng/mL' })}>CEA (Colorectal) - &lt;3 ng/mL</option>
                      <option value={JSON.stringify({ name: 'AFP', range: '<10', unit: 'ng/mL' })}>AFP (Liver) - &lt;10 ng/mL</option>
                      <option value={JSON.stringify({ name: 'PSA', range: '<4', unit: 'ng/mL' })}>PSA (Prostate) - &lt;4 ng/mL</option>
                      <option value={JSON.stringify({ name: 'HE4', range: '<70', unit: 'pmol/L' })}>HE4 (Ovarian) - &lt;70 pmol/L</option>
                    </optgroup>
                    
                    <optgroup label="Complete Blood Count">
                      <option value={JSON.stringify({ name: 'WBC', range: '4.5-11.0', unit: 'K/μL' })}>WBC (White Blood Cells) - 4.5-11.0 K/μL</option>
                      <option value={JSON.stringify({ name: 'RBC', range: '4.5-5.5', unit: 'M/μL' })}>RBC (Red Blood Cells) - 4.5-5.5 M/μL</option>
                      <option value={JSON.stringify({ name: 'Hemoglobin', range: '12.0-16.0', unit: 'g/dL' })}>Hemoglobin - 12.0-16.0 g/dL</option>
                      <option value={JSON.stringify({ name: 'Hematocrit', range: '36-48', unit: '%' })}>Hematocrit - 36-48%</option>
                      <option value={JSON.stringify({ name: 'Platelets', range: '150-400', unit: 'K/μL' })}>Platelets - 150-400 K/μL</option>
                      <option value={JSON.stringify({ name: 'ANC', range: '>1500', unit: '/μL' })}>ANC (Absolute Neutrophil Count) - &gt;1500 /μL</option>
                      <option value={JSON.stringify({ name: 'Neutrophils', range: '40-70', unit: '%' })}>Neutrophils - 40-70%</option>
                      <option value={JSON.stringify({ name: 'Lymphocytes', range: '20-40', unit: '%' })}>Lymphocytes - 20-40%</option>
                    </optgroup>
                    
                    <optgroup label="Kidney Function">
                      <option value={JSON.stringify({ name: 'Creatinine', range: '0.6-1.2', unit: 'mg/dL' })}>Creatinine - 0.6-1.2 mg/dL</option>
                      <option value={JSON.stringify({ name: 'eGFR', range: '>60', unit: 'mL/min' })}>eGFR - &gt;60 mL/min</option>
                      <option value={JSON.stringify({ name: 'BUN', range: '7-20', unit: 'mg/dL' })}>BUN (Blood Urea Nitrogen) - 7-20 mg/dL</option>
                    </optgroup>
                    
                    <optgroup label="Liver Function">
                      <option value={JSON.stringify({ name: 'ALT', range: '7-56', unit: 'U/L' })}>ALT - 7-56 U/L</option>
                      <option value={JSON.stringify({ name: 'AST', range: '10-40', unit: 'U/L' })}>AST - 10-40 U/L</option>
                      <option value={JSON.stringify({ name: 'ALP', range: '44-147', unit: 'U/L' })}>ALP (Alkaline Phosphatase) - 44-147 U/L</option>
                      <option value={JSON.stringify({ name: 'Bilirubin', range: '0.1-1.2', unit: 'mg/dL' })}>Bilirubin (Total) - 0.1-1.2 mg/dL</option>
                      <option value={JSON.stringify({ name: 'Albumin', range: '3.5-5.5', unit: 'g/dL' })}>Albumin - 3.5-5.5 g/dL</option>
                    </optgroup>
                    
                    <optgroup label="Metabolic Panel">
                      <option value={JSON.stringify({ name: 'Glucose', range: '70-100', unit: 'mg/dL' })}>Glucose (Fasting) - 70-100 mg/dL</option>
                      <option value={JSON.stringify({ name: 'Sodium', range: '136-145', unit: 'mmol/L' })}>Sodium - 136-145 mmol/L</option>
                      <option value={JSON.stringify({ name: 'Potassium', range: '3.5-5.0', unit: 'mmol/L' })}>Potassium - 3.5-5.0 mmol/L</option>
                      <option value={JSON.stringify({ name: 'Calcium', range: '8.5-10.5', unit: 'mg/dL' })}>Calcium - 8.5-10.5 mg/dL</option>
                      <option value={JSON.stringify({ name: 'Magnesium', range: '1.7-2.2', unit: 'mg/dL' })}>Magnesium - 1.7-2.2 mg/dL</option>
                    </optgroup>
                    
                    <optgroup label="Other Important Markers">
                      <option value={JSON.stringify({ name: 'LDH', range: '140-280', unit: 'U/L' })}>LDH (Lactate Dehydrogenase) - 140-280 U/L</option>
                      <option value={JSON.stringify({ name: 'CRP', range: '<3', unit: 'mg/L' })}>CRP (C-Reactive Protein) - &lt;3 mg/L</option>
                      <option value={JSON.stringify({ name: 'Vitamin D', range: '30-100', unit: 'ng/mL' })}>Vitamin D - 30-100 ng/mL</option>
                      <option value={JSON.stringify({ name: 'TSH', range: '0.4-4.0', unit: 'mIU/L' })}>TSH (Thyroid) - 0.4-4.0 mIU/L</option>
                      <option value={JSON.stringify({ name: 'HbA1c', range: '<5.7', unit: '%' })}>HbA1c (Diabetes) - &lt;5.7%</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Common cancer-related lab values</p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500 font-medium">Or add custom lab</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-gray-800 text-sm">Custom Lab Value</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lab Name *</label>
                    <input
                      type="text"
                      value={newLabData.label}
                      onChange={(e) => setNewLabData({ ...newLabData, label: e.target.value })}
                      placeholder="e.g., Vitamin D, Albumin, Magnesium"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Normal Range *</label>
                      <input
                        type="text"
                        value={newLabData.normalRange}
                        onChange={(e) => setNewLabData({ ...newLabData, normalRange: e.target.value })}
                        placeholder="e.g., <35, 4.5-11.0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                      <input
                        type="text"
                        value={newLabData.unit}
                        onChange={(e) => setNewLabData({ ...newLabData, unit: e.target.value })}
                        placeholder="e.g., U/mL, mg/dL"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Tip:</span> You can add any lab value from your medical records - the AI will learn what's normal for you over time.
                    </p>
                  </div>
                </div>

                {newLabData.label && newLabData.normalRange && newLabData.unit && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-900 mb-1">Preview:</p>
                    <p className="text-sm text-green-800">
                      <strong>{newLabData.label}</strong> • Normal: {newLabData.normalRange} {newLabData.unit}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddLab(false);
                      setNewLabData({ label: '', normalRange: '', unit: '' });
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (newLabData.label && newLabData.normalRange && newLabData.unit) {
                        alert(`Added ${newLabData.label} to your tracked labs!\n\nNormal Range: ${newLabData.normalRange} ${newLabData.unit}\n\nYou can now log values and track trends for this marker.`);
                        setNewLabData({ label: '', normalRange: '', unit: '' });
                        setShowAddLab(false);
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    disabled={!newLabData.label || !newLabData.normalRange || !newLabData.unit}
                  >
                    Add Lab Value
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Log Vital Reading Modal */}
        {showAddVital && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Log Vital Reading</h3>
                <button
                  onClick={() => setShowAddVital(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Log Vital Reading</p>
                      <p className="text-xs text-blue-700 mt-1">
                        All vitals are tracked automatically. Select which vital you measured and enter the reading.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vital Sign <span className="text-red-600">*</span>
                  </label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select vital sign...</option>
                    <option value="bp">Blood Pressure</option>
                    <option value="hr">Heart Rate</option>
                    <option value="temp">Temperature</option>
                    <option value="weight">Weight</option>
                    <option value="o2sat">Oxygen Saturation</option>
                    <option value="rr">Respiratory Rate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reading <span className="text-red-600">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Systolic"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Diastolic"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">For blood pressure, enter both values</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <textarea
                    rows="2"
                    placeholder="e.g., Taken after rest, morning reading"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddVital(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowAddVital(false);
                      alert('Vital reading logged successfully!');
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Log Reading
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Location Modal - Comprehensive */}
        {showEditLocation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-xl sm:max-h-[85vh] flex flex-col animate-slide-up">
              <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">Trial Search Location</h3>
                <button
                  onClick={() => setShowEditLocation(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">Trial Matching</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        Your location helps us find clinical trials nearby. You can also enable global search to include international trials.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialLocation.includeAllLocations}
                      onChange={(e) => setTrialLocation({ ...trialLocation, includeAllLocations: e.target.checked })}
                      className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <div>
                      <p className="font-semibold text-gray-800">Include Global Locations</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Search international databases for all available clinical trials worldwide
                      </p>
                    </div>
                  </label>
                </div>

                <div className={trialLocation.includeAllLocations ? 'opacity-50' : ''}>
                  <h4 className="font-semibold text-gray-800 mb-3">Your Location</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <select
                        value={trialLocation.country}
                        onChange={(e) => setTrialLocation({ ...trialLocation, country: e.target.value })}
                        disabled={trialLocation.includeAllLocations}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="United Kingdom">United Kingdom</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          value={trialLocation.city}
                          onChange={(e) => setTrialLocation({ ...trialLocation, city: e.target.value })}
                          disabled={trialLocation.includeAllLocations}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={trialLocation.state}
                          onChange={(e) => setTrialLocation({ ...trialLocation, state: e.target.value })}
                          disabled={trialLocation.includeAllLocations}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {!trialLocation.includeAllLocations && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search Radius</label>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="10"
                      value={trialLocation.searchRadius}
                      onChange={(e) => setTrialLocation({ ...trialLocation, searchRadius: e.target.value })}
                      className="w-full"
                    />
                    <div className="flex justify-between mt-2">
                      <span className="text-sm text-gray-600">10 miles</span>
                      <span className="text-lg font-bold text-green-600">{trialLocation.searchRadius} miles</span>
                      <span className="text-sm text-gray-600">500 miles</span>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-3">
                  <h5 className="text-sm font-semibold text-gray-800 mb-2">What databases will be searched?</h5>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-green-600 rounded-full"></div>
                      <span>ClinicalTrials.gov (US federal database)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-green-600 rounded-full"></div>
                      <span>NCI Clinical Trials Search</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-green-600 rounded-full"></div>
                      <span>Major cancer center databases</span>
                    </div>
                    {trialLocation.includeAllLocations && (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-green-600 rounded-full"></div>
                          <span className="font-medium">EU Clinical Trials Register</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-green-600 rounded-full"></div>
                          <span className="font-medium">WHO International Registry</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t p-4 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => setShowEditLocation(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowEditLocation(false);
                    alert('Location settings saved!');
                  }}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Patient Info Modal */}
        {showEditInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Edit Patient Information</h3>
                <button
                  onClick={() => setShowEditInfo(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      defaultValue="Mary Johnson"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
                      <input
                        type="number"
                        defaultValue="58"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        defaultValue="1966-03-15"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue="62"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                    <input
                      type="number"
                      defaultValue="165"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEditInfo(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowEditInfo(false);
                      alert('Patient information updated!');
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Update Status Modal */}
        {showUpdateStatus && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Update Current Status</h3>
                <button
                  onClick={() => setShowUpdateStatus(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                    <input
                      type="text"
                      defaultValue="OCCC Stage IIIC"
                      placeholder="e.g., OCCC Stage IIIC, HGSOC Stage IV"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Date</label>
                    <input
                      type="date"
                      defaultValue="2024-10-15"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Line</label>
                    <input
                      type="text"
                      defaultValue="2nd Line (Platinum-resistant)"
                      placeholder="e.g., 1st Line, 2nd Line, Maintenance"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Regimen</label>
                    <input
                      type="text"
                      defaultValue="Paclitaxel + Bevacizumab"
                      placeholder="e.g., Carboplatin + Paclitaxel"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Performance Status (ECOG)</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="0">ECOG 0 - Fully active</option>
                      <option value="1" selected>ECOG 1 - Restricted in strenuous activity</option>
                      <option value="2">ECOG 2 - Ambulatory, capable of self-care</option>
                      <option value="3">ECOG 3 - Limited self-care</option>
                      <option value="4">ECOG 4 - Completely disabled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disease Status</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="stable" selected>Stable Disease</option>
                      <option value="responding">Responding to Treatment</option>
                      <option value="progression">Progression Detected</option>
                      <option value="remission">Complete Remission</option>
                      <option value="partial">Partial Response</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Baseline CA-125 (U/mL)</label>
                    <input
                      type="number"
                      defaultValue="38"
                      placeholder="Initial CA-125 value"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUpdateStatus(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowUpdateStatus(false);
                      alert('Status updated successfully!');
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Genomic Profile Modal */}
        {showEditGenomic && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-2xl md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Edit Genomic Profile</h3>
                <button
                  onClick={() => setShowEditGenomic(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-900">Genomic Testing</p>
                      <p className="text-xs text-purple-700 mt-0.5">
                        Update your genomic test results to help match with relevant clinical trials
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Key Mutations</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">BRCA1</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                        <option>Positive</option>
                        <option>Negative</option>
                        <option>Unknown</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">BRCA2</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                        <option>Negative</option>
                        <option>Positive</option>
                        <option>Unknown</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">TP53</label>
                      <input
                        type="text"
                        defaultValue="Wild-type"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ARID1A</label>
                      <input
                        type="text"
                        defaultValue="Mutated"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Biomarkers</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">HRD Score</label>
                      <input
                        type="number"
                        defaultValue="62"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">HRD Status</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                        <option>Positive (≥42)</option>
                        <option>Negative (&lt;42)</option>
                        <option>Unknown</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">TMB</label>
                      <input
                        type="text"
                        defaultValue="Low (3.2 mut/Mb)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PD-L1</label>
                      <input
                        type="text"
                        defaultValue="Negative (<1%)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Test Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                        <option>Foundation One CDx</option>
                        <option>Guardant360</option>
                        <option>Tempus xT</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
                      <input
                        type="date"
                        defaultValue="2024-09-15"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 bg-white border-t p-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEditGenomic(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowEditGenomic(false);
                      alert('Genomic profile updated!');
                    }}
                    className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Emergency Contacts Modal */}
        {showEditContacts && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-2xl md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Edit Emergency Contacts</h3>
                <button
                  onClick={() => setShowEditContacts(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Quick Access</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Keep your emergency contacts up to date for quick access
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <User size={18} className="mr-2 text-blue-600" />
                    Oncologist
                  </h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue="Dr. Sarah Chen"
                      placeholder="Doctor's name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="tel"
                      defaultValue="(206) 555-0123"
                      placeholder="Phone number"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <User size={18} className="mr-2 text-green-600" />
                    Primary Care
                  </h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue="Dr. Michael Ross"
                      placeholder="Doctor's name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="tel"
                      defaultValue="(206) 555-0156"
                      placeholder="Phone number"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <Home size={18} className="mr-2 text-red-600" />
                    Hospital
                  </h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue="Seattle Cancer Center"
                      placeholder="Hospital name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      defaultValue="1234 Medical Plaza, Seattle, WA"
                      placeholder="Address"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="tel"
                      defaultValue="(206) 555-0199"
                      placeholder="Main phone"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <User size={18} className="mr-2 text-orange-600" />
                    Emergency Contact
                  </h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue="John (Husband)"
                      placeholder="Contact name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      defaultValue="Spouse"
                      placeholder="Relationship"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="tel"
                      defaultValue="(206) 555-0142"
                      placeholder="Phone number"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 bg-white border-t p-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEditContacts(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowEditContacts(false);
                      alert('Emergency contacts updated!');
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sign Out Section in Profile */}
        {activeTab === 'profile' && user && (
          <div className="p-4">
            <div className="bg-white rounded-lg shadow p-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Signed in as</p>
                  <p className="text-sm font-medium text-gray-900">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
}
