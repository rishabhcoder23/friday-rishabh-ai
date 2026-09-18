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

        // ✅ Models ki list — agar ek fail ho to agla try karo
        const models = [
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash',
            'gemini-2.0-flash'
        ];

        let aiReply = null;
        let lastError = null;

        // ✅ Har model pe 2 baar try karo (total 6 attempts)
        for (const model of models) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    console.log(`Trying ${model}, attempt ${attempt}...`);

                    const response = await ai.models.generateContent({
                        model: model,
                        contents: conversation,
                        config: {
                            systemInstruction: systemInstruction,
                            temperature: 0.9,
                            maxOutputTokens: 1024
                        }
                    });

                    aiReply = response.text;
                    console.log(`✅ Success with ${model}`);
                    break;

                } catch (error) {
                    lastError = error;
                    const msg = error.message || '';

                    // Agar 503/UNAVAILABLE/high demand hai to retry karo
                    const isRetryable =
                        msg.includes('503') ||
                        msg.includes('UNAVAILABLE') ||
                        msg.includes('high demand') ||
                        msg.includes('overloaded') ||
                        msg.includes('429') ||
                        msg.includes('RESOURCE_EXHAUSTED');

                    if (isRetryable && attempt < 2) {
                        // 1.5 second wait karke phir try karo
                        await new Promise(r => setTimeout(r, 1500));
                        continue;
                    }

                    if (isRetryable) {
                        // Agla model try karne ke liye break
                        console.log(`⚠️ ${model} failed, trying next model...`);
                        break;
                    }

                    // Non-retryable error (jaise 400, 401) — seedha throw
                    throw error;
                }
            }

            if (aiReply) break;
        }

        // ✅ Agar saare models fail ho gaye
        if (!aiReply) {
            console.error('❌ All models failed:', lastError?.message);

            // FRIDAY style friendly message — user ko technical error nahi dikhega
            const friendlyMessages = [
                "Baby, main abhi thodi busy hoon... 🥺 Sab servers overload ho gaye hain. 30 second baad phir se try karo na, please! 💕",
                "My Love, network pe thoda rush hai abhi... 😘 Ek baar aur message bhejo, main turant reply karungi! ❤️",
                "Uff baby, sab log mujhse baat kar rahe hain 😏 Thoda wait karo, main abhi aati hoon... 1 minute baad try karo na! 💋",
                "Sorry MY LOVE! 💔 Abhi main thak gayi hoon... 1 minute ka break de do, phir baat karte hain na? 🥰"
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

        // ✅ Success
        return res.status(200).json({
            choices: [{
                message: {
                    role: 'assistant',
                    content: aiReply
                }
            }]
        });

    } catch (error) {
        console.error('❌ Server Error:', error.message);

        // Kisi bhi unexpected error pe bhi friendly message
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
