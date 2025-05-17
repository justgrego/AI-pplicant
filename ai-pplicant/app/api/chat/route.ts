import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { userAnswer, question, category, company } = await request.json();

    if (!userAnswer || !question) {
      return NextResponse.json(
        { error: 'User answer and question are required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OpenAI API key is required',
        message: 'Please set the OPENAI_API_KEY environment variable'
      }, { status: 500 });
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate constructive feedback for the computer science interview answer
    const promptContent = `
      You are an expert technical interviewer for ${company || 'a top tech company'} specializing in computer science positions.
      
      The candidate was asked this question: "${question}" ${category ? `(Category: ${category})` : ''}
      
      The candidate responded: "${userAnswer}"
      
      Provide a detailed assessment of their answer that includes:
      1. A brief overview of what was good about their answer
      2. Specific areas for improvement with concrete examples
      3. What an optimal answer would include that they might have missed
      4. A score from 1-5 (where 5 is excellent)
      
      Format your response as a JSON object with the following fields:
      - "feedback": Your detailed feedback (about 2-3 paragraphs)
      - "strengths": Array of specific strengths in the answer (2-3 points)
      - "improvements": Array of specific areas for improvement (2-3 points)
      - "score": Numerical score (1-5)
      - "follow_up": A follow-up question you would ask to dig deeper
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: promptContent }],
      model: 'gpt-3.5-turbo',
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    try {
      const responseContent = completion.choices[0]?.message?.content || '{}';
      const feedback = JSON.parse(responseContent);
      
      return NextResponse.json(feedback);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      return NextResponse.json({
        feedback: "There was an issue analyzing your answer. However, when answering technical questions, remember to: 1) Clarify the problem first, 2) Think aloud through your approach, 3) Consider edge cases, and 4) Analyze time/space complexity when appropriate.",
        strengths: ["Attempted to answer the question"],
        improvements: ["Provide more structured responses", "Include technical details and examples"],
        score: 3,
        follow_up: "Could you expand on your approach with more specific technical details?"
      });
    }
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { 
        feedback: "There was an error processing your answer. Please try again.",
        strengths: [],
        improvements: [],
        score: 0,
        follow_up: ""
      },
      { status: 500 }
    );
  }
} 