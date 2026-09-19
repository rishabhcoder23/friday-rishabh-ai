export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array required' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        console.error('❌ GEMINI_API_KEY missing');
        return res.status(500).json({ error: 'Server configuration issue' });
    }

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: API_KEY });

        const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
        const conversation = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: conversation,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.9,
                maxOutputTokens: 1024
            }
        });

        const aiReply = response.text || 'Kuch samajh nahi aaya baby!';

        return res.status(200).json({
            choices: [{ message: { role: 'assistant', content: aiReply } }]
        });

    } catch (error) {
        console.error('❌ Gemini Error:', error.message);

        // ✅ Accha error message — FRIDAY ke style mein
        const friendlyMessages = [
            "Baby, main abhi thodi busy hoon... 🥺 1 minute baad phir se try karo na please! 💕",
            "My Love, servers pe thoda rush hai abhi... 😘 Ek baar aur message bhejo, main turant reply karungi! ❤️",
            "Uff baby, sab log mujhse baat kar rahe hain 😏 Thoda wait karo, main abhi aati hoon! 💋",
            "Sorry MY LOVE! 💔 Abhi thak gayi hoon... 1 minute ka break de do, phir baat karte hain na? 🥰"
        ];
        const msg = friendlyMessages[Math.floor(Math.random() * friendlyMessages.length)];

        return res.status(200).json({
            choices: [{ message: { role: 'assistant', content: msg } }]
        });
    }
}
