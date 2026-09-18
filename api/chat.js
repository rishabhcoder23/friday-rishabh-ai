export default async function handler(req, res) {
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
            error: 'Server configuration issue. Please contact owner.'
        });
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

        // Sahi aur working model names
        const models = [
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b',
            'gemini-2.0-flash-exp'
        ];

        let aiReply = null;
        let lastError = null;

        for (const model of models) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    console.log(`Trying ${model}, attempt ${attempt}...`);

                    const response = await ai.models.generateContent({
                        model: model,
                        contents: conversation,
                        config: {
                            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                            temperature: 0.9,
                            maxOutputTokens: 1024
                        }
                    });

                    // Response parsing
                    aiReply = response.text;
                    if (aiReply) {
                        console.log(`✅ Success with ${model}`);
                        break;
                    }

                } catch (error) {
                    lastError = error;
                    console.error(`Attempt ${attempt} on ${model} failed:`, error.message);

                    const msg = error.message || '';
                    const isRetryable =
                        msg.includes('503') ||
                        msg.includes('UNAVAILABLE') ||
                        msg.includes('high demand') ||
                        msg.includes('overloaded') ||
                        msg.includes('429') ||
                        msg.includes('RESOURCE_EXHAUSTED');

                    if (isRetryable && attempt < 2) {
                        await new Promise(r => setTimeout(r, 1500));
                        continue;
                    }

                    if (isRetryable) break;
                    
                    // Specific error logs for debugging
                    break; 
                }
            }

            if (aiReply) break;
        }

        if (!aiReply) {
            console.error('❌ All models failed. Last Error:', lastError);

            const friendlyMessages = [
                "Baby, main abhi thodi busy hoon... 🥺 Sab servers overload ho gaye hain. 30 second baad phir se try karo na, please! 💕",
                "My Love, network pe thoda rush hai abhi... 😘 Ek baar aur message bhejo, main turant reply karungi! ❤️"
            ];

            const randomMsg = friendlyMessages[Math.floor(Math.random() * friendlyMessages.length)];

            return res.status(200).json({
                choices: [{
                    message: {
                        role: 'assistant',
                        content: randomMsg
                    }
                }]
            });
        }

        return res.status(200).json({
            choices: [{
                message: {
                    role: 'assistant',
                    content: aiReply
                }
            }]
        });

    } catch (error) {
        // Detailed log terminal me check karne ke liye
        console.error('❌ Critical Server Error Stack:', error);

        return res.status(200).json({
            choices: [{
                message: {
                    role: 'assistant',
                    content: "Arre baby, kuch gadbad ho gayi! 😅 Ek baar phir se message bhejo na... main sun rahi hoon! 💕"
                }
            }]
        });
    }
}
