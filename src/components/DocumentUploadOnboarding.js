import React, { useState } from 'react';
import { Upload, Activity, Dna, FileText, X, CheckCircle, ChevronRight } from 'lucide-react';

const DocumentUploadOnboarding = ({ onClose, onUploadClick, isOnboarding = true }) => {
  const [selectedType, setSelectedType] = useState(null);
  const [documentDate, setDocumentDate] = useState('');
  const [showDateInput, setShowDateInput] = useState(false);

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

  const handleContinue = () => {
    if (selectedType && !showDateInput) {
      // Show date input step
      setShowDateInput(true);
    } else if (selectedType && showDateInput) {
      // Proceed to upload with date (or null if skipped)
      onUploadClick(selectedType, documentDate || null);
    }
  };

  const handleSkipDate = () => {
    // Skip date and proceed to upload
    onUploadClick(selectedType, null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{isOnboarding ? 'Upload Your First File' : 'File Upload'}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {isOnboarding ? 'Choose the type of file you\'d like to upload' : 'Select document type or capture a file to upload'}
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
          {!showDateInput ? (
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

            return (
              <div
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`border-2 rounded-lg p-5 cursor-pointer transition-all ${
                  isSelected
                    ? `${colorClasses.selectedBorder} ${colorClasses.selectedBg} shadow-md`
                    : `${colorClasses.border} hover:${colorClasses.selectedBorder} hover:shadow-sm`
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
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
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
          ) : (
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
                    <input
                      type="date"
                      value={documentDate}
                      onChange={(e) => setDocumentDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className={`w-full border rounded-lg px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 ${
                        selectedType === 'genomic-profile'
                          ? 'border-purple-300 focus:ring-purple-500'
                          : selectedType === 'blood-test'
                          ? 'border-gray-300 focus:ring-blue-500'
                          : 'border-gray-300 focus:ring-green-500'
                      }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If you don't know the date, you can skip and we'll try to extract it from the document.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          {!showDateInput ? (
            <>
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleContinue}
                disabled={!selectedType}
                className={`px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 ${
                  selectedType
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowDateInput(false)}
                className="text-gray-600 hover:text-gray-900 font-medium transition flex items-center gap-2"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSkipDate}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition"
                >
                  Skip Date
                </button>
                <button
                  onClick={handleContinue}
                  className="px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 bg-green-600 text-white hover:bg-green-700"
                >
                  <Upload className="w-5 h-5" />
                  {isOnboarding ? 'Continue to Upload' : 'Upload'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentUploadOnboarding;
