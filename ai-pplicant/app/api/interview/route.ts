import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { ElevenLabsClient } from 'elevenlabs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize ElevenLabs client
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { company, jobDescription } = await request.json();

    if (!company || !jobDescription) {
      return NextResponse.json(
        { error: 'Company and job description are required' },
        { status: 400 }
      );
    }

    // Step 1: Generate interview context with OpenAI
    const promptContent = `
      I need you to act as an interviewer for ${company}. 
      The candidate has applied for a position with this job description:
      ${jobDescription}
      
      Please generate 5 likely interview questions that would be asked in this interview.
      Format as a JSON array of strings.
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: promptContent }],
      model: 'gpt-4',
      response_format: { type: 'json_object' },
    });

    let interviewQuestions;
    try {
      interviewQuestions = JSON.parse(completion.choices[0].message.content || '{"questions": []}').questions;
    } catch (e) {
      interviewQuestions = ["Tell me about yourself?", "Why do you want to work at our company?"];
    }

    // Return the generated questions and session token
    return NextResponse.json({
      success: true,
      interviewQuestions,
      sessionId: Date.now().toString(), // Simple session ID for now
    });
  } catch (error) {
    console.error('Interview initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize interview' },
      { status: 500 }
    );
  }
} 