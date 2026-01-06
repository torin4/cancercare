import { Thermometer, BarChart, Heart, Pill, Info, FileText, TrendingUp, AlertCircle, Activity, MessageSquare, Check, Clock, MapPin, Calendar, BookOpen } from 'lucide-react';

// General suggestions (shown when no context is active) - general questions, not data-specific
export const generalSuggestions = [
  { text: "Tell me about my diagnosis", populateText: "Tell [patient] about [patient] diagnosis", icon: Info, color: "bg-anchor-900/80" },
  { text: "What treatment options are available?", populateText: "What treatment options are available for [condition]?", icon: Pill, color: "bg-anchor-900/80" },
  { text: "What are common side effects?", populateText: "What are common side effects of [medication]?", icon: AlertCircle, color: "bg-anchor-900/80" },
  { text: "What questions should I ask my doctor?", populateText: "What questions should [patient] ask [patient] doctor about?", icon: MessageSquare, color: "bg-anchor-900/80" },
  { text: "Tell me about my condition", populateText: "Tell [patient] about [patient] condition", icon: Info, color: "bg-anchor-900/80" },
  { text: "What should I expect from treatment?", populateText: "What should [patient] expect from treatment?", icon: TrendingUp, color: "bg-anchor-900/80" },
];

// Chat suggestions for adding data (shown when no context, but these are action-oriented)
// These are kept separate and can be added to general suggestions if needed
export const chatSuggestions = [
  { text: "Log a symptom", populateText: "[patient] had [symptom] yesterday", icon: Thermometer, color: "bg-medical-primary-500/80" },
  { text: "Add lab value", populateText: "[Patient] CA-125 was [value] on [date]", icon: BarChart, color: "bg-medical-primary-500/80" },
  { text: "Add vital sign", populateText: "[Patient] blood pressure is [value] this morning", icon: Heart, color: "bg-medical-primary-500/80" },
  { text: "Add medication", populateText: "[patient] started taking [medication] [dosage]", icon: Pill, color: "bg-medical-primary-500/80" },
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

// Health data-specific suggestions (shown when health context is active)
export const healthSuggestions = [
  { text: "Explain my lab results", populateText: "Explain [patient] latest lab results", icon: FileText, color: "bg-medical-primary-500/80" },
  { text: "What does my CA-125 mean?", populateText: "What does [patient] CA-125 mean?", icon: Info, color: "bg-medical-primary-500/80" },
  { text: "Analyze my health trends", populateText: "Show me trends in [patient] health data", icon: TrendingUp, color: "bg-medical-primary-500/80" },
  { text: "How is my treatment progressing?", populateText: "How is [patient] treatment progressing?", icon: TrendingUp, color: "bg-medical-primary-500/80" },
  { text: "What do my vitals mean?", populateText: "What do [patient] vitals mean?", icon: Heart, color: "bg-medical-primary-500/80" },
  { text: "Explain my symptoms", populateText: "Explain [patient] symptoms", icon: Activity, color: "bg-medical-primary-500/80" },
];

// Timeline/notebook-specific suggestions (shown when notebook context is active)
export const timelineSuggestions = [
  { text: "What happened on [date]?", populateText: "What happened on [date]?", icon: Calendar, color: "bg-yellow-500/80" },
  { text: "Tell me about my timeline", populateText: "Tell me about [patient] health timeline", icon: BookOpen, color: "bg-yellow-500/80" },
  { text: "Show me my journal entries", populateText: "Show me [patient] journal entries", icon: BookOpen, color: "bg-yellow-500/80" },
  { text: "What notes do I have?", populateText: "What notes does [patient] have?", icon: FileText, color: "bg-yellow-500/80" },
  { text: "What documents did I upload?", populateText: "What documents did [patient] upload?", icon: FileText, color: "bg-yellow-500/80" },
];

