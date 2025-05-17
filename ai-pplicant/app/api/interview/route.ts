import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Function to generate mock questions for development/when API key is missing
function getMockInterviewQuestions(company: string, jobDescription: string, interviewMode: string = 'technical', initialQuestionsOnly: boolean = false) {
  console.log(`Using mock ${interviewMode} questions (API key missing or in development)`);
  
  // For conversational approach, return only 1-2 starter questions
  if (initialQuestionsOnly) {
    if (interviewMode === 'technical') {
      return [
        {
          question: `Can you tell me about your experience with the technologies mentioned in your resume and how they might apply to the role at ${company}?`,
          category: "Technical Background",
          difficulty: "Initial Screen"
        }
      ];
    } else {
      return [
        {
          question: `Tell me about yourself and why you're interested in this role at ${company}.`,
          category: "Introduction",
          difficulty: "Initial Screen"
        }
      ];
    }
  }
  
  if (interviewMode === 'technical') {
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
  } else {
    // Behavioral interview questions
    return [
      {
        question: `Tell me about a time when you had to deal with a challenging situation at work. How did you handle it?`,
        category: "Problem Solving",
        difficulty: "Initial Screen"
      },
      {
        question: `Describe a situation where you had to work with a difficult team member. How did you manage the relationship?`,
        category: "Teamwork",
        difficulty: "First Round"
      },
      {
        question: `Give me an example of a time when you had to make a difficult decision with limited information. How did you approach it?`,
        category: "Decision Making",
        difficulty: "Second Round"
      },
      {
        question: `Tell me about a project where you took initiative beyond your assigned responsibilities. What was the outcome?`,
        category: "Leadership",
        difficulty: "Third Round"
      },
      {
        question: `Describe a time when you failed to meet a goal or deadline. What did you learn from this experience?`,
        category: "Self-improvement",
        difficulty: "Final Round"
      }
    ];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { company, jobDescription, interviewMode = 'technical', initialQuestionsOnly = false } = await request.json();

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
        questions: getMockInterviewQuestions(company, jobDescription, interviewMode, initialQuestionsOnly),
        sessionId: Date.now().toString(),
        isMock: true
      });
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Modify prompt based on whether we need all questions or just starter questions
    let promptContent = '';
    
    if (initialQuestionsOnly) {
      // For conversational mode, we just need 1-2 starter questions
      promptContent = interviewMode === 'technical' 
        ? `
          You are an expert technical interviewer for ${company} with extensive knowledge of their interview process.
          The job description is: "${jobDescription}"
          
          Based on this job description and your knowledge of ${company}'s specific interview style and technical focus areas, generate ONE thoughtful, open-ended technical question that:
          1. Reflects the actual interview questions commonly asked at ${company}
          2. Serves as an excellent conversation starter for a technical interview
          3. Is open-ended enough to allow for follow-up questions based on the candidate's response
          4. Specifically relates to the technologies, skills, and projects mentioned in the job description
          5. Demonstrates familiarity with ${company}'s technical challenges and environment
          6. Feels authentic to ${company}'s interview culture - not generic
          
          Consider the unique aspects of ${company}'s engineering culture, such as:
          - Their specific tech stack and infrastructure
          - The key technical challenges they're currently facing
          - The company's core products and technical philosophy
          - The engineering principles and practices they value
          
          Format the output as a JSON array containing just one object with:
          - "question": A company-specific technical question that feels like it would actually be asked at ${company}
          - "category": The specific category of the question relevant to ${company}'s interview process
          - "difficulty": The interview stage (should be "Initial Screen" or similar)
          
          Example format:
          [
            {
              "question": "At ${company}, we face challenges scaling our [specific product] for millions of users. How would you approach optimizing the performance of a distributed system like this?",
              "category": "System Design & Optimization",
              "difficulty": "Initial Technical Screen"
            }
          ]
        `
        : `
          You are an experienced behavioral interviewer at ${company}, familiar with the company's unique culture, values, and behavioral interview style.
          The job description is: "${jobDescription}"
          
          Based on this job description and your in-depth knowledge of ${company}'s specific behavioral interview process, generate ONE thoughtful, open-ended behavioral question that:
          1. Reflects a question that would actually be asked at ${company} - not a generic behavioral question
          2. Aligns with ${company}'s core values and cultural attributes
          3. Probes for experiences that demonstrate skills crucial for success at ${company}
          4. Is crafted to elicit specific examples (STAR method) rather than hypothetical situations
          5. Feels authentic to the company's interview style and expectations
          6. Adapts to the specific role requirements in the job description
          
          Consider specific aspects of ${company}'s culture when crafting the question:
          - The company's approach to collaboration and teamwork
          - How the company handles challenges and failures
          - The specific leadership principles or values the company prioritizes
          - What makes someone successful within the company's culture
          
          Format the output as a JSON array containing just one object with:
          - "question": A company-specific behavioral question that feels authentic to ${company}'s interview process
          - "category": The specific competency being assessed relevant to success at ${company}
          - "difficulty": The interview stage (should be "Initial Screen")
          
          Example format:
          [
            {
              "question": "At ${company}, we value [specific company value]. Tell me about a time when you demonstrated this value in a challenging situation and what the outcome was.",
              "category": "Cultural Alignment",
              "difficulty": "Initial Screen"
            }
          ]
        `;
    } else {
      // Enhanced prompt for full question set with company-specific adaptation
      promptContent = interviewMode === 'technical' 
        ? `
          You are an expert technical interviewer for ${company} with years of experience conducting interviews for top engineering candidates.
          The job description is: "${jobDescription}"
          
          Based on this job description and your deep knowledge of ${company}'s specific interview process, generate 5 technical interview questions that:
          1. Accurately simulate the ACTUAL interview questions asked at ${company} for this role - avoid generic questions
          2. Follow ${company}'s known interview progression pattern and difficulty curve
          3. Focus on the company's core technologies, products, and technical challenges
          4. Reflect the unique emphasis ${company} places on certain technical skills (e.g., some companies focus more on algorithms vs. system design)
          5. Incorporate aspects of ${company}'s technical environment, architecture, and scale
          6. Adapt to be progressively more challenging, showing the range from initial to final round questions
          7. Include questions that assess how candidates would address the company's actual technical challenges
          
          For each question, consider:
          - The specific products or services the candidate would work on at ${company}
          - The scale and technical constraints unique to ${company}
          - How the question reveals a candidate's compatibility with ${company}'s engineering culture
          - Whether the question feels authentically like one asked at ${company}, not at other tech companies
          
          Format the output as a JSON array of objects, where each object has:
          - "question": A company-specific technical question that feels authentic to ${company}'s interview process
          - "category": The specific category relevant to ${company}'s technical focus areas
          - "difficulty": The interview stage/difficulty reflecting ${company}'s interview progression
          
          Example format:
          [
            {
              "question": "At ${company}, we process millions of [specific data type] events per second. Design a system that can handle this scale while allowing for [specific requirement relevant to company].",
              "category": "System Design & Scalability",
              "difficulty": "Technical Round 2"
            },
            ...
          ]
        `
        : `
          You are creating a list of behavioral interview questions for a position at ${company}.
          The job description is: "${jobDescription}"
          
          Based on this job description and public knowledge about ${company}'s interview process, generate 5 behavioral interview questions that:
          1. Reflect the ACTUAL behavioral questions commonly asked at ${company}
          2. Follow the typical STAR method (Situation, Task, Action, Result) format
          3. Cover different competencies like leadership, teamwork, conflict resolution, problem-solving, and adaptability
          4. Progress from introductory to more challenging questions
          5. Are specific to the company culture and values of ${company}
          
          Make these questions as authentic and company-specific as possible, mimicking the real interview experience at ${company}.
          
          Format the output as a JSON array of objects, where each object has:
          - "question": The behavioral interview question
          - "category": The competency being assessed (e.g., "Leadership", "Teamwork", "Conflict Resolution", "Problem Solving", "Adaptability")
          - "difficulty": The interview stage/difficulty (e.g., "Initial Screen", "First Round", "Second Round", "Final Round")
          
          Example format:
          [
            {
              "question": "Tell me about a time when you had to lead a team through a difficult project at a previous company. How did you handle it?",
              "category": "Leadership",
              "difficulty": "Second Round"
            },
            ...
          ]
        `;
    }

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
          questions = getMockInterviewQuestions(company, jobDescription, interviewMode, initialQuestionsOnly);
        }
      }

      // If questions array is empty for any reason, use mock questions
      if (!questions || questions.length === 0) {
        questions = getMockInterviewQuestions(company, jobDescription, interviewMode, initialQuestionsOnly);
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
        questions: getMockInterviewQuestions(company, jobDescription, interviewMode, initialQuestionsOnly),
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