import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Initialize OpenAI client with safer error handling
let openai: OpenAI;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build',
  });
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

export async function POST(request: NextRequest) {
  try {
    const { company, jobDescription } = await request.json();

    if (!company || !jobDescription) {
      return NextResponse.json(
        { error: 'Company and job description are required' },
        { status: 400 }
      );
    }

    // Check if running during build time with dummy key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy_key_for_build') {
      // Return mock data for build time
      return NextResponse.json({
        success: true,
        interviewQuestions: [
          "Tell me about yourself?",
          "Why do you want to work at our company?",
          "What are your greatest strengths?",
          "What are your weaknesses?",
          "Where do you see yourself in 5 years?"
        ],
        sessionId: Date.now().toString(),
      });
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
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
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