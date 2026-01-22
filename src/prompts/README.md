# Prompts Directory

This directory contains all AI prompts used by the CancerCare chatbot, organized for easy editing and maintenance.

## Structure

```
prompts/
├── chat/              # Main chat prompts
│   ├── mainPrompt.js      # Core chat prompt template
│   └── taskDescriptions.js # Task descriptions for different query types
├── context/           # Context section prompts
│   ├── healthContext.js      # Health data context instructions
│   ├── trialContext.js        # Clinical trial context instructions
│   ├── notebookContext.js     # Health history/timeline context instructions
│   └── patientDemographics.js # Patient demographics template
└── responses/         # Response messages
    └── noDataResponses.js     # Messages when data is not available
```

## Editing Prompts

### Main Chat Prompt
Edit `chat/mainPrompt.js` to modify the core AI assistant behavior, instructions, and response formatting.

### Task Descriptions
Edit `chat/taskDescriptions.js` to change how the AI interprets different types of queries (data entry, comparison, retrieval, etc.).

### Context Instructions
- **Health Context** (`context/healthContext.js`): Instructions for how to use health data (labs, vitals, symptoms)
- **Trial Context** (`context/trialContext.js`): Instructions for discussing clinical trials
- **Notebook Context** (`context/notebookContext.js`): Instructions for health history/timeline queries
- **Patient Demographics** (`context/patientDemographics.js`): Template for patient demographic information

### Response Messages
Edit `responses/noDataResponses.js` to customize messages shown when data is not available.

## Benefits of This Structure

1. **Easy Editing**: Prompts are in separate files, making them easy to find and modify
2. **Version Control**: Changes to prompts are clearly visible in git diffs
3. **Testing**: Can easily test different prompt variations
4. **Collaboration**: Non-developers can edit prompts without touching business logic
5. **Maintainability**: Clear separation of concerns

## Notes

- All prompts use template literals for dynamic content
- Functions that build prompts accept parameters for dynamic data
- Prompts are imported and used in `src/services/chatProcessor.js`
- Changes to prompts take effect immediately (no build step needed for prompt changes)
