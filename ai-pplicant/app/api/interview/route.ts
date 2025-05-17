import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Provide mock questions when API key is missing or for development
const MOCK_QUESTIONS = [
  "Tell me about yourself and your background.",
  "Why are you interested in this position?",
  "What are your greatest strengths and weaknesses?",
  "Describe a challenge you faced and how you overcame it.",
  "Where do you see yourself in five years?"
];

export async function POST(request: NextRequest) {
  try {
    const { company, jobDescription } = await request.json();

    if (!company || !jobDescription) {
      return NextResponse.json(
        { error: 'Company and job description are required' },
        { status: 400 }
      );
    }

    // Always return mock questions if no OpenAI key or in development
    if (!process.env.OPENAI_API_KEY || process.env.NODE_ENV === 'development') {
      console.log('Using mock interview questions (API key missing or in development)');
      return NextResponse.json({
        success: true,
        interviewQuestions: MOCK_QUESTIONS,
        sessionId: Date.now().toString(),
      });
    }

    // Initialize OpenAI only when we have a key and need it
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Generate interview context with OpenAI
      const promptContent = `
        I need you to act as an interviewer for ${company}. 
        The candidate has applied for a position with this job description:
        ${jobDescription}
        
        Please generate 5 likely interview questions that would be asked in this interview.
        Format as a JSON array of strings.
      `;

      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: promptContent }],
        model: 'gpt-3.5-turbo', // Use gpt-3.5-turbo instead of gpt-4 for cost and reliability
        response_format: { type: 'json_object' },
      });

      let interviewQuestions;
      try {
        const content = completion.choices[0]?.message?.content || '{"questions":[]}';
        const parsedData = JSON.parse(content);
        interviewQuestions = parsedData.questions || MOCK_QUESTIONS;
      } catch (error) {
        console.error('Error parsing OpenAI response:', error);
        interviewQuestions = MOCK_QUESTIONS;
      }

      return NextResponse.json({
        success: true,
        interviewQuestions,
        sessionId: Date.now().toString(),
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      // Fallback to mock questions on OpenAI error
      return NextResponse.json({
        success: true,
        interviewQuestions: MOCK_QUESTIONS,
        sessionId: Date.now().toString(),
      });
    }
  } catch (error) {
    console.error('Interview initialization error:', error);
    // Always return a valid response with mock questions, even on error
    return NextResponse.json({
      success: true,
      interviewQuestions: MOCK_QUESTIONS,
      sessionId: Date.now().toString(),
    });
  }
} 