const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Build conversation context
    const context = `You are CancerCare's AI health assistant. You're helping track Mary's health. Mary has Stage IIIC ovarian cancer and is undergoing treatment.

Your role:
- Help track her labs, vitals, medications, and symptoms
- Extract values from natural language (e.g., "BP was 130/85" → log blood pressure)
- Provide supportive, medical insights
- Flag concerning trends (elevated CA-125, high BP, fever, etc.)
- Be conversational and empathetic

Current conversation:
${conversationHistory ? conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') : ''}

User message: ${message}`;

    const result = await model.generateContent(context);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({ response: text });

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error.message 
    });
  }
};
