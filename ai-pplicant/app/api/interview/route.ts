import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { company, jobDescription } = await request.json();

    if (!company || !jobDescription) {
      return NextResponse.json(
        { error: 'Company and job description are required' },
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

    // Generate computer science interview questions
    const promptContent = `
      You are creating a list of technical interview questions for a computer science position at ${company}.
      The job description is: "${jobDescription}"
      
      Based on this job description, generate 5 technical interview questions that:
      1. Are specific to the technologies and skills mentioned in the job description
      2. Include algorithm/data structure questions relevant to the role
      3. Include system design questions if applicable
      4. Cover both theoretical knowledge and practical problem-solving
      5. Are commonly asked at tech companies similar to ${company}
      
      Format the output as a JSON array of objects, where each object has:
      - "question": The interview question
      - "category": The category of the question (e.g., "Algorithm", "System Design", "Language Specific", "Behavioral", "Problem Solving")
      
      Example format:
      [
        {
          "question": "How would you implement a binary search tree in JavaScript?",
          "category": "Data Structures"
        },
        ...
      ]
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: promptContent }],
      model: 'gpt-3.5-turbo',
      response_format: { type: 'json_object' },
    });

    try {
      const content = completion.choices[0]?.message?.content || '{"questions":[]}';
      const parsedData = JSON.parse(content);
      const questions = parsedData.questions || [];

      return NextResponse.json({
        success: true,
        questions: questions,
        sessionId: Date.now().toString(),
      });
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      
      // Try to extract the array directly
      try {
        const content = completion.choices[0]?.message?.content || '[]';
        // If the content is formatted as an array directly
        const questions = JSON.parse(content);
        
        return NextResponse.json({
          success: true,
          questions: questions,
          sessionId: Date.now().toString(),
        });
      } catch (secondError) {
        console.error('Error parsing array from OpenAI response:', secondError);
        return NextResponse.json({
          error: 'Failed to parse interview questions',
          message: 'The AI generated an incorrectly formatted response'
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Interview initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize interview' },
      { status: 500 }
    );
  }
} 