import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Function to generate mock feedback for development/when API key is missing
function getMockFeedback(userAnswer: string, question: string, category: string, company: string, difficulty: string = 'Technical Round', interviewMode: string = 'technical', generateFollowUp: boolean = false) {
  console.log(`Using mock ${interviewMode} feedback (API key missing or in development)`);
  
  // Basic analysis of answer length and completeness
  const answerLength = userAnswer.length;
  let score = 3; // Default average score
  
  if (answerLength < 50) {
    score = 2; // Too short
  } else if (answerLength > 300) {
    score = 4; // Detailed answer
  }
  
  // Generate a more conversational follow-up if requested
  let follow_up_question = '';
  const follow_up_category = category;
  
  if (generateFollowUp) {
    if (interviewMode === 'technical') {
      const technicalFollowUps = [
        `That's interesting. Can you elaborate on how you would implement this in a distributed system?`,
        `How would your approach change if the requirements scaled by 10x?`,
        `Let's dive deeper into the optimization aspect. How would you improve the efficiency?`,
        `Could you walk me through how you'd test this solution?`,
        `If you had to implement this at ${company}, what existing technologies might you leverage?`
      ];
      follow_up_question = technicalFollowUps[Math.floor(Math.random() * technicalFollowUps.length)];
    } else {
      const behavioralFollowUps = [
        `That's a good example. Can you tell me about another situation where you demonstrated similar skills?`,
        `If you were to face that situation again at ${company}, what would you do differently?`,
        `How do you think that experience prepared you for the role at ${company}?`,
        `What was the most challenging aspect of that situation, and how did you overcome it?`,
        `How did that experience change your approach to teamwork or problem-solving?`
      ];
      follow_up_question = behavioralFollowUps[Math.floor(Math.random() * behavioralFollowUps.length)];
    }
  }
  
  let feedbackResponse;
  
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
    
    feedbackResponse = {
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
      follow_up: `Could you elaborate on how your solution would handle edge cases or performance constraints at scale?`,
      follow_up_question: follow_up_question,
      follow_up_category: follow_up_category
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
    
    feedbackResponse = {
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
      follow_up: `Can you tell me more about what you personally learned from this experience and how it would apply to your potential role at ${company}?`,
      follow_up_question: follow_up_question,
      follow_up_category: follow_up_category
    };
  }
  
  console.log("Mock feedback response (summarized):", {
    score: feedbackResponse.score,
    hasFollowUp: !!feedbackResponse.follow_up_question,
    followUpCategory: feedbackResponse.follow_up_category
  });
  
  return feedbackResponse;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      userAnswer, 
      question, 
      category, 
      company, 
      difficulty = 'Technical Round', 
      interviewMode = 'technical',
      conversationHistory = [],
      generateFollowUp = false
    } = await request.json();
    
    if (!userAnswer || !question) {
      return NextResponse.json(
        { error: 'User answer and question are required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key missing - using mock feedback');
      
      // Return mock feedback when no API key is available
      const mockFeedback = getMockFeedback(userAnswer, question, category, company, difficulty, interviewMode, generateFollowUp);
      return NextResponse.json(mockFeedback);
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate feedback based on interview mode
    let promptContent = '';
    
    // Create a more conversational prompt for any type of interview with improved feedback guidelines
    promptContent = `
      You are an experienced ${interviewMode} interviewer for ${company || 'a leading company'}, helping a candidate prepare.
      
      The candidate is practicing for an interview at ${company}.
      You need to evaluate their answer to a question and provide helpful, conversational feedback, then generate a natural follow-up question.
      
      Here's the recent conversation context:
      ${conversationHistory.map((msg: {role: string, content: string}) => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`).join('\n\n')}
      
      Latest question: "${question}"
      Latest answer: "${userAnswer}"
      
      IMPORTANT GUIDELINES FOR YOUR FEEDBACK:
      1. Be concise, conversational, and human-like - avoid overly formal language
      2. Give specific, actionable feedback like a helpful coach would
      3. Balance positive reinforcement with constructive criticism 
      4. Use a friendly but professional tone
      5. If the answer is missing key elements, briefly mention what an ideal answer should include
      
      ${interviewMode === 'behavioral' ? `
      For behavioral questions:
      - Check if they used the STAR format (Situation, Task, Action, Result)
      - If they didn't use STAR, point this out directly and give a quick 1-2 sentence example
      - Focus on storytelling effectiveness and relevance to the role
      ` : `
      For technical questions:
      - Evaluate technical accuracy, problem-solving approach, and clarity
      - Comment on their communication of complex ideas
      - Note any missing optimizations or alternative approaches
      `}
      
      Then, create a natural follow-up question that:
      1. Builds organically from their answer
      2. Feels like a natural conversation, not an interrogation
      3. Helps them demonstrate more skills relevant to ${company}
      
      Format your response as a JSON object with:
      - "feedback": Conversational feedback (3-5 sentences at most, direct and helpful)
      - "strengths": Array of 2-3 specific strengths (short phrases)
      - "improvements": Array of 2-3 specific actionable improvements (short phrases) 
      - "score": Rating from 1-5
      - "follow_up_question": The next question you would naturally ask (one sentence)
      - "follow_up_category": The category this follow-up fits into
    `;

    try {
      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: promptContent }],
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      try {
        const responseContent = completion.choices[0]?.message?.content || '{}';
        const feedback = JSON.parse(responseContent);
        
        console.log("OpenAI feedback response (summarized):", {
          score: feedback.score,
          hasFollowUp: !!feedback.follow_up_question,
          followUpCategory: feedback.follow_up_category,
          feedbackPreview: feedback.feedback?.substring(0, 50) + '...'
        });
        
        // Ensure the follow_up field exists for compatibility
        if (!feedback.follow_up && feedback.follow_up_question) {
          feedback.follow_up = feedback.follow_up_question;
        }
        
        return NextResponse.json(feedback);
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        
        // Return mock feedback on parsing error
        return NextResponse.json(
          getMockFeedback(userAnswer, question, category, company, difficulty, interviewMode, generateFollowUp)
        );
      }
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      
      // Return mock feedback on API error
      return NextResponse.json(
        getMockFeedback(userAnswer, question, category, company, difficulty, interviewMode, generateFollowUp)
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
        follow_up: "",
        follow_up_question: "Let's move on to another topic. Can you tell me about your background?"
      },
      { status: 500 }
    );
  }
} 