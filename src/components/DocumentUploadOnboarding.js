import React, { useState } from 'react';
import { Upload, Activity, Dna, FileText, X, CheckCircle } from 'lucide-react';

const DocumentUploadOnboarding = ({ onClose, onUploadClick, isOnboarding = true }) => {
  const [selectedType, setSelectedType] = useState(null);

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
    if (selectedType) {
      onUploadClick(selectedType);
    }
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
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {documentTypes.map((type) => {
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
                border: 'border-medical-secondary-200',
                bg: 'bg-medical-secondary-50',
                selectedBorder: 'border-medical-secondary-500',
                selectedBg: 'bg-medical-secondary-50',
                icon: 'text-medical-secondary-600',
                badge: 'bg-medical-secondary-100 text-medical-secondary-700'
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
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 font-medium transition"
          >
            Skip for Now
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
            <Upload className="w-5 h-5" />
            {isOnboarding ? 'Continue to Upload' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentUploadOnboarding;
