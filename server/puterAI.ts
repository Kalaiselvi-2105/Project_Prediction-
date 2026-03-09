/**
 * OpenRouter AI Client for chat completions
 * Uses OpenRouter's unified API to access multiple AI models
 */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  stream?: boolean;
  model?: string;
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Create a chat completion using OpenRouter
 */
export async function createChatCompletion(options: ChatCompletionOptions): Promise<string> {
  const { messages, model = 'google/gemini-flash-1.5' } = options;
  
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'Predictive Project Insight'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenRouter AI error:', error);
    throw new Error('Failed to get AI response from OpenRouter');
  }
}

/**
 * Create a streaming chat completion using OpenRouter
 */
export async function* createStreamingChatCompletion(
  options: ChatCompletionOptions
): AsyncGenerator<string, void, unknown> {
  const { messages, model = 'google/gemini-flash-1.5' } = options;
  
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'Predictive Project Insight'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2048,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('OpenRouter AI streaming error:', error);
    throw new Error('Failed to stream AI response from OpenRouter');
  }
}

/**
 * Parse JSON response from AI with error handling
 */
export function parseAIJsonResponse(content: string): any {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Try to parse directly
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse AI JSON response:', error);
    // Return a default structure if parsing fails
    return {
      successProbability: 50,
      failureProbability: 50,
      riskLevel: "Medium",
      recommendations: ["Unable to generate detailed analysis. Please try again."]
    };
  }
}
