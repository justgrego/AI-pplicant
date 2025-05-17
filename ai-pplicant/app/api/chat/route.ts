import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Mock responses when API key is missing or for development
const MOCK_RESPONSES = [
  "That's an interesting answer. Could you elaborate a bit more?",
  "Thank you for sharing that. Your experience sounds valuable.",
  "I see your point. That's a good perspective on the matter.",
  "Great response! I appreciate your thoughtful answer.",
  "I understand your approach. That makes sense given the context."
];

export async function POST(request: NextRequest) {
  try {
    const { userAnswer, question, company } = await request.json();

    if (!userAnswer) {
      return NextResponse.json(
        { error: 'User answer is required' },
        { status: 400 }
      );
    }

    // Return a random mock response if no OpenAI key or in development
    if (!process.env.OPENAI_API_KEY || process.env.NODE_ENV === 'development') {
      const randomIndex = Math.floor(Math.random() * MOCK_RESPONSES.length);
      return NextResponse.json({
        response: MOCK_RESPONSES[randomIndex]
      });
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate a response from the interviewer
    const promptContent = `
      You are an interviewer at ${company}.
      You just asked the candidate: "${question}"
      The candidate responded: "${userAnswer}"
      
      As the interviewer, provide a brief, encouraging response (2-3 sentences max) 
      to acknowledge their answer and possibly provide a follow-up comment.
      Be professional but friendly and natural in your tone.
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: promptContent }],
      model: 'gpt-3.5-turbo',
      max_tokens: 100,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content?.trim() || 
      "Thank you for your response. Let's move on to the next question.";

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { 
        response: "I appreciate your answer. Let's continue with the interview." 
      },
      { status: 200 }
    );
  }
} 