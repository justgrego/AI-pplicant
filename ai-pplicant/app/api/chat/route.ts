import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Function to generate mock feedback for development/when API key is missing
function getMockFeedback(userAnswer: string, question: string, category: string, company: string, difficulty: string = 'Technical Round', interviewMode: string = 'technical') {
  console.log(`Using mock ${interviewMode} feedback (API key missing or in development)`);
  
  // Basic analysis of answer length and completeness
  const answerLength = userAnswer.length;
  let score = 3; // Default average score
  
  if (answerLength < 50) {
    score = 2; // Too short
  } else if (answerLength > 300) {
    score = 4; // Detailed answer
  }
  
  if (interviewMode === 'technical') {
    // For technical interviews
    // Check for keywords that might indicate a good answer
    const positiveKeywords = ['algorithm', 'complexity', 'optimize', 'efficient', 'scale', 'tradeoff', 'example'];
    const positiveCount = positiveKeywords.filter(keyword => 
      userAnswer.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    if (positiveCount >= 3) {
      score = Math.min(5, score + 1);
    }
    
    return {
      feedback: `Your answer to the ${difficulty} question about ${category} shows some understanding of the core concepts. You provided ${answerLength < 100 ? 'a brief' : 'a detailed'} explanation and touched on some important points. For technical interviews at ${company || 'top companies'}, you'll want to ensure you provide concrete examples and discuss both theoretical concepts and practical implementations.`,
      strengths: [
        "Attempted to address the main question",
        positiveCount > 0 ? "Used some technical terminology correctly" : "Provided a structured response",
        answerLength > 200 ? "Gave a detailed explanation" : "Kept the answer concise"
      ],
      improvements: [
        "Consider discussing time and space complexity more explicitly",
        "Provide specific code examples where applicable",
        "Mention how your solution would scale in a production environment"
      ],
      score: score,
      follow_up: `Could you elaborate on how your solution would handle edge cases or performance constraints at scale?`
    };
  } else {
    // For behavioral interviews
    // Check for STAR method elements
    const starKeywords = ['situation', 'task', 'action', 'result', 'example', 'learned', 'outcome'];
    const starCount = starKeywords.filter(keyword => 
      userAnswer.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    if (starCount >= 3) {
      score = Math.min(5, score + 1);
    }
    
    return {
      feedback: `Your response to the ${category} question demonstrates some understanding of the STAR method. You provided ${answerLength < 150 ? 'a brief outline' : 'details'} of your experience, but could enhance your answer by clearly structuring it around the Situation, Task, Action, and Result framework. For behavioral interviews at ${company}, it's important to provide specific, measurable outcomes from your experiences.`,
      strengths: [
        "Shared a relevant personal experience",
        starCount > 2 ? "Included elements of the STAR method" : "Provided some context for your actions",
        answerLength > 200 ? "Gave a comprehensive answer" : "Kept your response focused"
      ],
      improvements: [
        "Clearly outline the situation, task, action, and result in your answer",
        "Quantify your achievements with specific metrics where possible",
        "Connect your experience more explicitly to the role at " + company
      ],
      score: score,
      follow_up: `Can you tell me more about what you personally learned from this experience and how it would apply to your potential role at ${company}?`
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userAnswer, question, category, company, difficulty = 'Technical Round', interviewMode = 'technical' } = await request.json();
    
    if (!userAnswer || !question) {
      return NextResponse.json(
        { error: 'User answer and question are required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key missing - using mock feedback');
      
      // Return mock feedback when no API key is available
      return NextResponse.json(
        getMockFeedback(userAnswer, question, category, company, difficulty, interviewMode)
      );
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate feedback based on interview mode
    const promptContent = interviewMode === 'technical' 
      ? `
        You are an expert technical interviewer for ${company || 'a top tech company'} specializing in computer science positions.
        You have extensive knowledge of ${company}'s specific interview process and evaluation criteria.
        
        The candidate was asked this question: "${question}" 
        Category: ${category || 'Technical'} 
        Interview Stage: ${difficulty || 'Technical Round'}
        
        The candidate responded: "${userAnswer}"
        
        Provide a detailed assessment of their answer that includes:
        1. A brief overview of what was good about their answer
        2. Specific areas for improvement with concrete examples, based on what ${company} specifically looks for
        3. What an optimal answer at ${company} would include that they might have missed
        4. An honest evaluation of whether this candidate would likely proceed to the next interview stage at ${company}
        5. A score from 1-5 (where 5 is excellent and would definitely pass this stage at ${company})
        
        Format your response as a JSON object with the following fields:
        - "feedback": Your detailed feedback (about 2-3 paragraphs)
        - "strengths": Array of specific strengths in the answer (2-3 points)
        - "improvements": Array of specific areas for improvement (2-3 points)
        - "score": Numerical score (1-5)
        - "follow_up": A follow-up question you would ask to dig deeper (what a real ${company} interviewer would ask next)
      `
      : `
        You are an expert behavioral interviewer for ${company || 'a top company'} specializing in assessing candidate fit.
        You have extensive knowledge of ${company}'s specific culture, values, and hiring criteria.
        
        The candidate was asked this behavioral question: "${question}" 
        Competency Being Assessed: ${category || 'General'} 
        Interview Stage: ${difficulty || 'Behavioral Round'}
        
        The candidate responded: "${userAnswer}"
        
        Provide a detailed assessment of their answer that includes:
        1. How well they used the STAR method (Situation, Task, Action, Result) in their response
        2. The clarity and relevance of the example they provided
        3. How well they demonstrated the competency being assessed
        4. Specific areas for improvement to make their answer more compelling
        5. A score from 1-5 (where 5 is excellent and would definitely pass this stage at ${company})
        
        Format your response as a JSON object with the following fields:
        - "feedback": Your detailed feedback (about 2-3 paragraphs)
        - "strengths": Array of specific strengths in the answer (2-3 points)
        - "improvements": Array of specific areas for improvement (2-3 points)
        - "score": Numerical score (1-5)
        - "follow_up": A follow-up question you would ask to dig deeper (what a real ${company} interviewer would ask next)
      `;

    try {
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
        
        // Return mock feedback on parsing error
        return NextResponse.json(
          getMockFeedback(userAnswer, question, category, company, difficulty, interviewMode)
        );
      }
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      
      // Return mock feedback on API error
      return NextResponse.json(
        getMockFeedback(userAnswer, question, category, company, difficulty, interviewMode)
      );
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