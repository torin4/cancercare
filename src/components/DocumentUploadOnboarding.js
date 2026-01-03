import React, { useState } from 'react';
import { Upload, Activity, Dna, FileText, X, CheckCircle, ChevronRight } from 'lucide-react';
import DatePicker from './DatePicker';

const DocumentUploadOnboarding = ({ onClose, onUploadClick, isOnboarding = true }) => {
  const [selectedType, setSelectedType] = useState(null);
  const [documentDate, setDocumentDate] = useState('');
  const [documentNote, setDocumentNote] = useState('');
  const [currentStep, setCurrentStep] = useState(1); // 1 = document type, 2 = date, 3 = notes

  const documentTypes = [
    {
      id: 'blood-test',
      title: 'Blood Test / Lab Results',
      icon: Activity,
      description: 'Upload lab results including tumor markers, CBC, metabolic panel',
      examples: [
        'CA-125, CA 19-9, CEA tumor markers',
        'Complete Blood Count (CBC)',
        'Comprehensive Metabolic Panel (CMP)',
        'Liver function tests (AST, ALT)',
        'Kidney function (Creatinine, eGFR)'
      ],
      color: 'blue',
      helpText: 'We\'ll automatically extract lab values, track trends, and alert you to concerning changes.'
    },
    {
      id: 'genomic-profile',
      title: 'Genomic Test Report',
      icon: Dna,
      description: 'Upload genomic testing results for precision treatment matching',
      examples: [
        'Foundation One CDx report',
        'Guardant360 liquid biopsy',
        'Tempus xT or Tempus TOP',
        'BRCA1/BRCA2 testing',
        'MSI/TMB testing',
        'Any NGS panel report'
      ],
      color: 'purple',
      helpText: 'We\'ll extract mutations, biomarkers (TMB, MSI, HRD), and match you with targeted therapies and clinical trials.'
    },
    {
      id: 'other',
      title: 'Other Medical Document',
      icon: FileText,
      description: 'Imaging reports, pathology, treatment notes, etc.',
      examples: [
        'CT/MRI/PET scan reports',
        'Pathology reports',
        'Oncology progress notes',
        'Treatment plans',
        'Surgical reports'
      ],
      color: 'green',
      helpText: 'We\'ll extract relevant medical information and keep everything organized in one place.'
    }
  ];

  const totalSteps = 3;
  const progressPercentage = (currentStep / totalSteps) * 100;

  const handleContinueFromStep1 = () => {
    if (selectedType) {
      setCurrentStep(2); // Go to date step
    }
  };

  const handleSkipDate = () => {
    // Skip date and go to notes step
    setCurrentStep(3);
  };

  const handleContinueWithDate = () => {
    // Continue with date to notes step
    setCurrentStep(3);
  };

  const handleSkipNote = () => {
    // Skip note and proceed to file picker - open file picker directly from user click
    // Normalize empty strings to null
    const normalizedDate = documentDate && documentDate.trim() !== '' ? documentDate : null;
    openFilePicker(selectedType, normalizedDate, null);
  };

  const handleContinueWithNote = () => {
    // Continue with note and proceed to file picker - open file picker directly from user click
    // Normalize empty strings to null
    const normalizedDate = documentDate && documentDate.trim() !== '' ? documentDate : null;
    const normalizedNote = documentNote && documentNote.trim() !== '' ? documentNote : null;
    openFilePicker(selectedType, normalizedDate, normalizedNote);
  };

  const openFilePicker = (docType, date, note) => {
    // Create file input and trigger it immediately (must be in user interaction context)
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls,image/*';
    
    // Check if mobile device and enable camera option
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      input.capture = 'environment'; // Enable camera option on mobile
    }
    
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        // Use the parameters passed to openFilePicker, but fall back to component state if needed
        const dateToUse = date || documentDate || null;
        const noteToUse = note || documentNote || null;
        
        // Normalize empty strings to null before passing
        const normalizedDate = (dateToUse && typeof dateToUse === 'string' && dateToUse.trim() !== '') 
          ? dateToUse.trim() 
          : null;
        const normalizedNote = (noteToUse && typeof noteToUse === 'string' && noteToUse.trim() !== '') 
          ? noteToUse.trim() 
          : null;
          
        // Pass the file directly to onUploadClick so it can handle the upload
        onUploadClick(docType, normalizedDate, normalizedNote, file);
      }
      // Clean up
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };
    
    // Append to body and click immediately (must be in user interaction context)
    document.body.appendChild(input);
    input.click();
  };

  const handleBack = () => {
    if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-white w-full h-full md:h-auto md:rounded-xl md:max-w-4xl md:max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Progress Bar */}
        <div className="px-6 pt-6 pb-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step {currentStep} of {totalSteps}</span>
            <span className="text-sm font-medium text-gray-600">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{isOnboarding ? 'Upload Your First File' : 'File Upload'}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentStep === 1 && (isOnboarding ? 'Choose the type of file you\'d like to upload' : 'Select document type')}
              {currentStep === 2 && 'When was this document created or when were these tests performed?'}
              {currentStep === 3 && 'Add any context about this document (optional)'}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 transition"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {currentStep === 1 && (
            // Document type selection
            documentTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;
            const colorClasses = {
              blue: {
                border: 'border-medical-primary-200',
                bg: 'bg-medical-primary-50',
                selectedBorder: 'border-medical-primary-500',
                selectedBg: 'bg-medical-primary-50',
                icon: 'text-medical-primary-600',
                badge: 'bg-medical-primary-100 text-medical-primary-700'
              },
              purple: {
                border: 'border-purple-200',
                bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
                selectedBorder: 'border-purple-500',
                selectedBg: 'bg-gradient-to-br from-purple-50 to-pink-50',
                icon: 'text-purple-600',
                badge: 'bg-purple-100 text-purple-700'
              },
              green: {
                border: 'border-medical-accent-200',
                bg: 'bg-medical-accent-50',
                selectedBorder: 'border-medical-accent-500',
                selectedBg: 'bg-medical-accent-50',
                icon: 'text-medical-accent-600',
                badge: 'bg-medical-accent-100 text-medical-accent-700'
              }
            }[type.color];

            // Hover classes for each color type
            const hoverClasses = {
              blue: 'hover:border-medical-primary-500',
              purple: 'hover:border-purple-500',
              green: 'hover:border-medical-accent-500'
            }[type.color];

            return (
              <div
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`border-2 rounded-lg p-5 cursor-pointer transition-all ${
                  isSelected
                    ? `${colorClasses.selectedBorder} ${colorClasses.selectedBg} shadow-md`
                    : `${colorClasses.border} ${hoverClasses} hover:shadow-sm`
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`${colorClasses.bg} p-3 rounded-lg`}>
                    <Icon className={`w-8 h-8 ${colorClasses.icon}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{type.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-medical-primary-600 flex-shrink-0" />
                      )}
                    </div>

                    {/* Examples */}
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Examples:</p>
                      <div className="flex flex-wrap gap-2">
                        {type.examples.map((example, idx) => (
                          <span
                            key={idx}
                            className={`text-xs px-2 py-1 rounded-full ${colorClasses.badge}`}
                          >
                            {example}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Help Text */}
                    {isSelected && (
                      <div className={`mt-3 p-3 ${colorClasses.bg} rounded-lg border ${colorClasses.border}`}>
                        <p className="text-sm text-gray-700">
                          <strong>What we'll do:</strong> {type.helpText}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
          )}
          
          {currentStep === 2 && (
            // Date input step
            <div className="space-y-4">
              <div className={`rounded-lg p-4 border ${
                selectedType === 'genomic-profile'
                  ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                  : selectedType === 'blood-test'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Document Date</h3>
                <p className="text-sm text-gray-700 mb-4">
                  When was this document created or when were these tests performed? This helps us accurately track your health data over time.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Document Date <span className="text-gray-500 text-xs">(optional)</span>
                    </label>
                    <DatePicker
                      value={documentDate}
                      onChange={(e) => setDocumentDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      placeholder="YYYY-MM-DD"
                      showClear={true}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If you don't know the date, you can skip and we'll try to extract it from the document.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {currentStep === 3 && (
            // Note input step
            <div className="space-y-4">
              <div className={`rounded-lg p-4 border ${
                selectedType === 'genomic-profile'
                  ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                  : selectedType === 'blood-test'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Context Note</h3>
                <p className="text-sm text-gray-700 mb-4">
                  {selectedType === 'blood-test' 
                    ? 'Add any context about this lab report that might be helpful for understanding the values (e.g., "Before starting treatment", "After cycle 2", "Post-surgery"). This note will be attached to all lab and vital values extracted from this document.'
                    : selectedType === 'genomic-profile'
                    ? 'Add any context about this genomic test that might be helpful (e.g., "Baseline before treatment", "After progression", "Post-biopsy"). This note will help the AI provide more contextualized insights when analyzing your genomic data.'
                    : 'Add any context about this document that might be helpful (e.g., "Before treatment", "Follow-up visit", "Emergency department"). This note will help the AI provide more contextualized insights when analyzing your medical records.'
                  }
                </p>
                <div className={`rounded-lg p-3 mb-4 border ${
                  selectedType === 'genomic-profile'
                    ? 'bg-purple-100 border-purple-300'
                    : selectedType === 'blood-test'
                    ? 'bg-blue-100 border-blue-300'
                    : 'bg-green-100 border-green-300'
                }`}>
                  <p className={`text-xs font-medium mb-1 ${
                    selectedType === 'genomic-profile'
                      ? 'text-purple-800'
                      : selectedType === 'blood-test'
                      ? 'text-blue-800'
                      : 'text-green-800'
                  }`}>How this helps the AI:</p>
                  <p className={`text-xs ${
                    selectedType === 'genomic-profile'
                      ? 'text-purple-700'
                      : selectedType === 'blood-test'
                      ? 'text-blue-700'
                      : 'text-green-700'
                  }`}>
                    When you ask questions about your health data, the AI will see this context note and use it to provide more relevant and contextualized insights. For example, if you note "After cycle 2", the AI will understand that values were taken after a specific treatment cycle when analyzing trends or explaining results.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Context Note <span className="text-gray-500 text-xs">(optional)</span>
                    </label>
                    <textarea
                      value={documentNote}
                      onChange={(e) => setDocumentNote(e.target.value)}
                      placeholder="e.g., Before starting treatment, After cycle 2, Post-surgery..."
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This note will be saved with the document and all extracted values, helping the AI provide better context-aware responses.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          {currentStep === 1 && (
            <>
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleContinueFromStep1}
                disabled={!selectedType}
                className={`px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 ${
                  selectedType
                    ? 'bg-medical-primary-500 text-white hover:bg-medical-primary-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          
          {currentStep === 2 && (
            <>
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900 font-medium transition flex items-center gap-2"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back
              </button>
              <button
                onClick={documentDate && documentDate.trim() !== '' ? handleContinueWithDate : handleSkipDate}
                className="px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 bg-medical-primary-500 text-white hover:bg-medical-primary-600"
              >
                {documentDate && documentDate.trim() !== '' ? 'Continue' : 'Skip without date'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          
          {currentStep === 3 && (
            <>
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900 font-medium transition flex items-center gap-2"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back
              </button>
              <button
                onClick={documentNote && documentNote.trim() !== '' ? handleContinueWithNote : handleSkipNote}
                className="px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 bg-medical-primary-500 text-white hover:bg-medical-primary-600"
              >
                {documentNote && documentNote.trim() !== '' ? 'Continue to upload' : 'Skip with no notes'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentUploadOnboarding;
