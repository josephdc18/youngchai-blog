/**
 * Translation API endpoint using OpenAI GPT-4o-mini
 * Translates content between English and Korean for the CMS
 */

export async function onRequestPost(context) {
    const { request, env } = context;
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { text, targetLang, fieldType } = await request.json();

        if (!text || !targetLang) {
            return new Response(JSON.stringify({ 
                error: 'Missing required fields: text and targetLang' 
            }), { 
                status: 400, 
                headers: corsHeaders 
            });
        }

        if (!env.OPENAI_API_KEY) {
            return new Response(JSON.stringify({ 
                error: 'OpenAI API key not configured' 
            }), { 
                status: 500, 
                headers: corsHeaders 
            });
        }

        // Build the prompt based on field type
        let systemPrompt = `You are a professional translator. Translate the following text to ${targetLang === 'ko' ? 'Korean' : 'English'}. 
        
Rules:
- Return ONLY the translation, no explanations or notes
- Preserve all markdown formatting (headers, bold, italic, links, etc.)
- Preserve any HTML tags exactly as they are
- Keep proper nouns and brand names unchanged
- Maintain the same tone and style
- For Korean: Use polite/formal speech style (존댓말)`;

        if (fieldType === 'title') {
            systemPrompt += '\n- This is a title, keep it concise and impactful';
        } else if (fieldType === 'description') {
            systemPrompt += '\n- This is a description/summary, keep it engaging';
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                temperature: 0.3, // Lower temperature for more consistent translations
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('OpenAI API error:', errorData);
            return new Response(JSON.stringify({ 
                error: 'Translation service error' 
            }), { 
                status: 500, 
                headers: corsHeaders 
            });
        }

        const data = await response.json();
        const translation = data.choices[0]?.message?.content?.trim();

        if (!translation) {
            return new Response(JSON.stringify({ 
                error: 'No translation received' 
            }), { 
                status: 500, 
                headers: corsHeaders 
            });
        }

        return new Response(JSON.stringify({ 
            translation,
            usage: data.usage // Include token usage for monitoring
        }), { 
            headers: corsHeaders 
        });

    } catch (error) {
        console.error('Translation error:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal server error' 
        }), { 
            status: 500, 
            headers: corsHeaders 
        });
    }
}

// Handle OPTIONS for CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

