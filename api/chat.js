export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { messages } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array required' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        console.error('❌ GEMINI_API_KEY is missing');
        return res.status(500).json({
            error: 'API key not configured. Add GEMINI_API_KEY in Vercel environment variables.'
        });
    }

    try {
        // Gemini SDK import
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: API_KEY });

        // Gemini format: system prompt alag, messages Contents me convert karo
        const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
        const conversation = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: conversation,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.9,
                maxOutputTokens: 1024
            }
        });

        const aiReply = response.text || 'Kuch samajh nahi aaya baby!';

        // OpenAI-compatible format return karo (frontend ke liye)
        return res.status(200).json({
            choices: [
                {
                    message: {
                        role: 'assistant',
                        content: aiReply
                    }
                }
            ]
        });

    } catch (error) {
        console.error('❌ Gemini Error:', error.message);
        return res.status(500).json({ error: `Server error: ${error.message}` });
    }
}
