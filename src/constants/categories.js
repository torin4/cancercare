import { Target, Activity, Heart, Droplet, AlertCircle, Zap, Plus, Filter, Beaker } from 'lucide-react';

export const categoryDescriptions = {
  'Disease-Specific Markers': 'Tumor markers and cancer-specific biomarkers used to monitor disease progression and treatment response',
  'Liver Function': 'Enzymes and proteins that assess liver health and detect liver damage or dysfunction',
  'Kidney Function': 'Markers that evaluate kidney health and filtration capacity',
  'Blood Counts': 'Complete blood count (CBC) components including white cells, red cells, and platelets',
  'Thyroid Function': 'Hormones and markers that assess thyroid gland function and metabolism',
  'Cardiac Markers': 'Biomarkers used to detect heart damage, heart failure, or cardiac events',
  'Inflammation': 'Markers that indicate inflammation, infection, or immune system activity',
  'Electrolytes': 'Essential minerals and salts that maintain fluid balance and cellular function',
  'Coagulation': 'Tests that evaluate blood clotting function and bleeding risk',
  'Custom Values': 'User-added lab values not in standard categories',
  'Others': 'Additional lab values that don\'t fit into other categories'
};

export const categoryIcons = {
  'Disease-Specific Markers': Target,
  'Liver Function': Beaker,
  'Kidney Function': Filter,
  'Blood Counts': Droplet,
  'Thyroid Function': Activity,
  'Cardiac Markers': Heart,
  'Inflammation': AlertCircle,
  'Electrolytes': Zap,
  'Coagulation': Droplet,
  'Custom Values': Plus,
  'Others': Activity
};

