// Cancer types (matching onboarding)
export const CANCER_TYPES = [
  // Gynecological Cancers
  'Ovarian Cancer',
  'Endometrial Cancer',
  'Cervical Cancer',
  'Uterine Cancer',
  'Vaginal Cancer',
  'Vulvar Cancer',
  'Fallopian Tube Cancer',
  // Breast Cancer
  'Breast Cancer',
  'Male Breast Cancer',
  'Inflammatory Breast Cancer',
  'Triple-Negative Breast Cancer',
  // Lung Cancer
  'Lung Cancer',
  'Non-Small Cell Lung Cancer',
  'Small Cell Lung Cancer',
  'Mesothelioma',
  // Gastrointestinal Cancers
  'Colorectal Cancer',
  'Colon Cancer',
  'Rectal Cancer',
  'Stomach Cancer',
  'Esophageal Cancer',
  'Pancreatic Cancer',
  'Liver Cancer',
  'Gallbladder Cancer',
  'Bile Duct Cancer',
  'Anal Cancer',
  'Gastrointestinal Stromal Tumor (GIST)',
  // Blood Cancers
  'Leukemia',
  'Acute Lymphoblastic Leukemia (ALL)',
  'Acute Myeloid Leukemia (AML)',
  'Chronic Lymphocytic Leukemia (CLL)',
  'Chronic Myeloid Leukemia (CML)',
  'Lymphoma',
  'Hodgkin Lymphoma',
  'Non-Hodgkin Lymphoma',
  'Multiple Myeloma',
  'Myelodysplastic Syndrome',
  // Skin Cancer
  'Melanoma',
  'Basal Cell Carcinoma',
  'Squamous Cell Carcinoma',
  'Merkel Cell Carcinoma',
  // Genitourinary Cancers
  'Prostate Cancer',
  'Bladder Cancer',
  'Kidney Cancer',
  'Renal Cell Carcinoma',
  'Testicular Cancer',
  'Penile Cancer',
  // Head and Neck Cancers
  'Head and Neck Cancer',
  'Thyroid Cancer',
  'Oral Cancer',
  'Throat Cancer',
  'Laryngeal Cancer',
  'Nasopharyngeal Cancer',
  'Salivary Gland Cancer',
  // Brain and Nervous System
  'Brain Cancer',
  'Glioblastoma',
  'Astrocytoma',
  'Oligodendroglioma',
  'Meningioma',
  'Neuroblastoma',
  'Spinal Cord Tumor',
  // Bone and Soft Tissue
  'Bone Cancer',
  'Osteosarcoma',
  'Ewing Sarcoma',
  'Soft Tissue Sarcoma',
  'Rhabdomyosarcoma',
  // Endocrine Cancers
  'Adrenal Cancer',
  'Pituitary Tumor',
  'Parathyroid Cancer',
  'Neuroendocrine Tumor',
  'Carcinoid Tumor',
  // Pediatric Cancers
  'Wilms Tumor',
  'Retinoblastoma',
  // Other Cancers
  'Thymoma',
  'Carcinoma of Unknown Primary',
  'Other (Please Specify)'
].sort();

// Common subtype mapping (same options as onboarding)
export const CANCER_SUBTYPES = {
  'Ovarian Cancer': ['High-grade serous', 'Low-grade serous', 'Clear Cell Carcinoma', 'Clear Cell Sarcoma', 'Endometrioid', 'Mucinous', 'Other (specify)'],
  'Breast Cancer': ['Invasive ductal (IDC)', 'Invasive lobular (ILC)', 'Triple-negative', 'HER2+', 'ER+/PR+', 'Other (specify)'],
  'Lung Cancer': ['Adenocarcinoma', 'Squamous cell carcinoma', 'Small cell lung cancer', 'Large cell carcinoma', 'Other (specify)'],
  'Colorectal Cancer': ['Adenocarcinoma', 'Mucinous adenocarcinoma', 'Signet ring cell carcinoma', 'Other (specify)'],
  'Endometrial Cancer': ['Endometrioid', 'Serous (Type II)', 'Clear cell', 'Carcinosarcoma', 'Other (specify)'],
  'Pancreatic Cancer': ['Pancreatic ductal adenocarcinoma', 'Pancreatic neuroendocrine tumor (PNET)', 'Other (specify)'],
  'Kidney Cancer': ['Clear cell RCC', 'Papillary RCC', 'Chromophobe RCC', 'Other (specify)'],
  'Cervical Cancer': ['Squamous cell carcinoma', 'Adenocarcinoma', 'Adenosquamous', 'Other (specify)'],
  'Uterine Cancer': ['Endometrial (endometrioid)', 'Serous', 'Carcinosarcoma', 'Other (specify)'],
  'Brain Cancer': ['Glioblastoma', 'Astrocytoma', 'Oligodendroglioma', 'Other (specify)'],
  'Skin Cancer': ['Melanoma', 'Basal cell carcinoma', 'Squamous cell carcinoma', 'Other (specify)'],
  'Thyroid Cancer': ['Papillary', 'Follicular', 'Medullary', 'Anaplastic', 'Other (specify)'],
  'Bladder Cancer': ['Urothelial (transitional) carcinoma', 'Squamous cell carcinoma', 'Adenocarcinoma', 'Other (specify)'],
  'Prostate Cancer': ['Adenocarcinoma', 'Neuroendocrine', 'Other (specify)']
};

// Options matching onboarding Step 2
export const STAGE_OPTIONS = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Not Applicable', 'Unknown'];
export const PERFORMANCE_OPTIONS = ['0', '1', '2', '3', '4'];
export const DISEASE_STATUS_OPTIONS = ['Newly Diagnosed', 'In Remission', 'Stable Disease', 'Progressive Disease', 'Recurrent Disease', 'Unknown'];
export const TREATMENT_STATUS_OPTIONS = ['First-line', 'Second-line', 'Third-line', 'Fourth-line or later', 'Maintenance', 'Adjuvant', 'Neoadjuvant', 'Palliative', 'Other (specify)'];

