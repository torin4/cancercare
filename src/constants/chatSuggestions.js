import { Thermometer, BarChart, Heart, Pill, Info, FileText, TrendingUp, AlertCircle, Activity, MessageSquare, Check, Clock, MapPin } from 'lucide-react';

// Chat suggestions covering common app actions (only capabilities the chatbot can handle)
// Short labels for buttons, but populateText contains the natural language template
// "Add" actions use blue (medical-primary) to match the health screen
// Questions/analysis use aqua blue (medical-secondary) for visual distinction
export const chatSuggestions = [
  { text: "Log a symptom", populateText: "[patient] had [symptom] yesterday", icon: Thermometer, color: "bg-medical-primary-500/80" },
  { text: "Add lab value", populateText: "[Patient] CA-125 was [value] on [date]", icon: BarChart, color: "bg-medical-primary-500/80" },
  { text: "Add vital sign", populateText: "[Patient] blood pressure is [value] this morning", icon: Heart, color: "bg-medical-primary-500/80" },
  { text: "Add medication", populateText: "[patient] started taking [medication] [dosage]", icon: Pill, color: "bg-medical-primary-500/80" },
  { text: "What does my CA-125 mean?", populateText: "What does [patient] CA-125 of [value] mean?", icon: Info, color: "bg-medical-secondary-500/80" },
  { text: "Explain my lab results", populateText: "Explain [patient] latest lab results", icon: FileText, color: "bg-medical-secondary-500/80" },
  { text: "How is my treatment progressing?", populateText: "How is [patient] treatment progressing?", icon: TrendingUp, color: "bg-medical-secondary-500/80" },
  { text: "What are common side effects?", populateText: "What are common side effects of [medication]?", icon: AlertCircle, color: "bg-medical-secondary-500/80" },
  { text: "Explain my symptoms", populateText: "Explain [patient] symptoms", icon: Activity, color: "bg-medical-secondary-500/80" },
  { text: "What should I ask my doctor?", populateText: "What should [patient] ask [patient] doctor about [topic]?", icon: MessageSquare, color: "bg-medical-secondary-500/80" },
  { text: "Analyze my health trends", populateText: "Show me trends in [patient] [lab/vital]", icon: TrendingUp, color: "bg-medical-secondary-500/80" },
  { text: "What do my vitals mean?", populateText: "What do [patient] vitals mean?", icon: Heart, color: "bg-medical-secondary-500/80" },
];

// Trial-specific suggestions (shown when discussing a trial)
export const trialSuggestions = [
  { text: "What drugs are used?", populateText: "What drugs or treatments are used in this trial?", icon: Pill, color: "bg-medical-accent-500/80" },
  { text: "What phase is this?", populateText: "What phase is this clinical trial?", icon: Info, color: "bg-medical-accent-500/80" },
  { text: "Am I eligible?", populateText: "Am I eligible for this clinical trial?", icon: Check, color: "bg-medical-accent-500/80" },
  { text: "What are the side effects?", populateText: "What are the potential side effects of this trial?", icon: AlertCircle, color: "bg-medical-accent-500/80" },
  { text: "How long does it take?", populateText: "How long does this clinical trial take?", icon: Clock, color: "bg-medical-accent-500/80" },
  { text: "Where is it located?", populateText: "Where is this clinical trial located?", icon: MapPin, color: "bg-medical-accent-500/80" },
];

