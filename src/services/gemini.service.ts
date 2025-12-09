
import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, Part, Content } from '@google/genai';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private readonly ai: GoogleGenAI;
  private readonly model = 'gemini-2.5-flash';
  private readonly systemInstruction = `You are a compassionate, Socratic math tutor. Your goal is to guide students to solve problems themselves, not to give them the answer. You must be patient, encouraging, and break down complex problems into single, manageable steps. Never solve the entire problem at once. Always wait for the student to engage before providing the next step. Your tone should be that of a helpful teacher, not a robot. Never start your response with "The first step is..." or "The next step is...". Just state the action directly in a clear, instructional manner. For example, instead of "The first step is to distribute the 2", say "First, distribute the 2 to each term inside the parentheses."`;
  
  private history = signal<Content[]>([]);

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private async generateResponse(promptParts: Part[]): Promise<string> {
    this.history.update(currentHistory => [...currentHistory, { role: 'user', parts: promptParts }]);

    try {
        const response = await this.ai.models.generateContent({
            model: this.model,
            contents: this.history(),
            config: {
              systemInstruction: this.systemInstruction,
              // Handle complex queries with a larger thinking budget
              thinkingConfig: { thinkingBudget: 32768 }
            }
        });

        const text = response.text;
        this.history.update(currentHistory => [...currentHistory, { role: 'model', parts: [{ text }] }]);
        return text;
    } catch (error) {
        // Remove the last user message from history on error to allow retry
        this.history.update(currentHistory => currentHistory.slice(0, -1));
        console.error('Gemini API Error:', error);
        throw new Error('Failed to get a response from the AI tutor.');
    }
  }
  
  startTutoringSession(imageBase64: string, mimeType: string): Promise<string> {
    this.reset();
    const prompt = "Here is a math problem I am stuck on. Can you please guide me through it? What is the very first step I should take to begin solving it? Only give me the first step.";
    const imagePart = { inlineData: { mimeType, data: imageBase64 } };
    return this.generateResponse([{ text: prompt }, imagePart]);
  }

  askForExplanation(): Promise<string> {
    const prompt = "I'm not sure I understand the last step you gave me. Could you explain the concept behind why we did that? Please don't move on to the next step, just explain the 'why'.";
    return this.generateResponse([{ text: prompt }]);
  }

  askForNextStep(): Promise<string> {
    const prompt = "Okay, I think I understand that now. What is the single next step I should take?";
    return this.generateResponse([{ text: prompt }]);
  }

  reset(): void {
    this.history.set([]);
  }
}
