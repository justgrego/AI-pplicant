import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Function to generate mock questions for development/when API key is missing
function getMockInterviewQuestions(company: string, jobDescription: string) {
  console.log('Using mock questions (API key missing or in development)');
  
  // Extract some keywords from the job description to make questions somewhat relevant
  const techKeywords = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
    'AWS', 'cloud', 'database', 'SQL', 'NoSQL', 'API',
    'Docker', 'Kubernetes', 'CI/CD', 'microservices', 'scalability',
    'frontend', 'backend', 'fullstack', 'web', 'mobile'
  ];
  
  // Find keywords in the job description
  const relevantKeywords = techKeywords.filter(keyword => 
    jobDescription.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // Default keywords if none found
  const keywordsToUse = relevantKeywords.length > 0 
    ? relevantKeywords 
    : ['JavaScript', 'algorithms', 'system design'];
  
  // Create mock questions based on found keywords
  return [
    {
      question: `Can you explain how you would implement a cache system for a large-scale application at ${company}?`,
      category: "System Design",
      difficulty: "Phone Screen"
    },
    {
      question: `How would you optimize the performance of a ${keywordsToUse[0] || 'web'} application that's experiencing slow load times?`,
      category: "Performance Optimization",
      difficulty: "Technical Round 1"
    },
    {
      question: `Explain the difference between promises and async/await in JavaScript and when you would use each.`,
      category: "Language Specific",
      difficulty: "Technical Round 1"
    },
    {
      question: `How would you design a scalable microservice architecture for ${company}'s main product?`,
      category: "System Architecture",
      difficulty: "Technical Round 2"
    },
    {
      question: `Implement an algorithm to find the longest substring without repeating characters.`,
      category: "Algorithm",
      difficulty: "Final Round"
    }
  ];
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

    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key missing - using mock questions');
      
      // Return mock questions when no API key is available
      return NextResponse.json({
        success: true,
        questions: getMockInterviewQuestions(company, jobDescription),
        sessionId: Date.now().toString(),
        isMock: true
      });
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate computer science interview questions
    const promptContent = `
      You are creating a list of technical interview questions for a computer science position at ${company}.
      The job description is: "${jobDescription}"
      
      Based on this job description and public knowledge about ${company}'s interview process, generate 5 technical interview questions that:
      1. Reflect the ACTUAL interview questions commonly asked at ${company} for this type of role
      2. Follow the typical interview structure and difficulty progression at ${company}
      3. Include questions specific to the technologies and skills mentioned in the job description
      4. Cover data structures, algorithms, system design, and technical problem-solving in proportions typical for ${company}
      5. Range from screening-level to final round questions to simulate a complete interview experience
      
      Make these questions as authentic and company-specific as possible, mimicking the real interview experience at ${company}.
      
      Format the output as a JSON array of objects, where each object has:
      - "question": The interview question
      - "category": The category of the question (e.g., "Algorithm", "System Design", "Language Specific", "Behavioral", "Problem Solving")
      - "difficulty": The interview stage/difficulty (e.g., "Phone Screen", "Technical Round", "Final Round")
      
      Example format:
      [
        {
          "question": "How would you implement a distributed cache system for ${company}'s main product?",
          "category": "System Design",
          "difficulty": "Technical Round"
        },
        ...
      ]
    `;

    try {
      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: promptContent }],
        model: 'gpt-3.5-turbo',
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content || '{"questions":[]}';
      let questions = [];
      
      try {
        const parsedData = JSON.parse(content);
        questions = parsedData.questions || [];
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        
        // Try to extract the array directly
        try {
          questions = JSON.parse(content);
        } catch (secondError) {
          console.error('Error parsing array from OpenAI response:', secondError);
          // If all parsing fails, use mock questions as fallback
          questions = getMockInterviewQuestions(company, jobDescription);
        }
      }

      // If questions array is empty for any reason, use mock questions
      if (!questions || questions.length === 0) {
        questions = getMockInterviewQuestions(company, jobDescription);
      }

      return NextResponse.json({
        success: true,
        questions: questions,
        sessionId: Date.now().toString()
      });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      
      // Return mock questions on API error as fallback
      return NextResponse.json({
        success: true,
        questions: getMockInterviewQuestions(company, jobDescription),
        sessionId: Date.now().toString(),
        isMock: true
      });
    }
  } catch (error) {
    console.error('Interview initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize interview' },
      { status: 500 }
    );
  }
} 