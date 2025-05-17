import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Configure route handler for large files
export const config = {
  maxDuration: 60, // Allows up to 60 seconds of processing time
};

export async function POST(request: NextRequest) {
  // For server-side transcription of audio
  // This is a fallback for browsers that don't support SpeechRecognition API
  
  if (!process.env.OPENAI_API_KEY) {
    console.log("Transcribe API: No API key available, returning mock response");
    // Return a mock transcript for development/testing when API key is missing
    return NextResponse.json({
      transcript: "This is a mock transcript since the transcription service is unavailable (API key missing)"
    });
  }

  try {
    console.log("Transcribe API: Processing incoming audio file");
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error("Transcribe API: No audio file provided in request");
      return NextResponse.json(
        { error: 'No audio file provided' }, 
        { status: 400 }
      );
    }

    console.log(`Transcribe API: Received audio file of type ${audioFile.type}, size ${audioFile.size} bytes`);
    
    // Verify that we have a valid audio file with content
    if (audioFile.size === 0) {
      console.error("Transcribe API: Empty audio file received");
      return NextResponse.json(
        { error: 'Empty audio file provided', transcript: '' }, 
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log("Transcribe API: Sending to OpenAI Whisper API for transcription");
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Specify English to improve accuracy
      response_format: 'json', // Ensure we get JSON back
    });

    console.log(`Transcribe API: Received transcription: "${transcription.text}"`);
    
    // Return an empty string if there's no transcription text
    if (!transcription.text || transcription.text.trim() === '') {
      console.log("Transcribe API: Empty transcript received from OpenAI");
      return NextResponse.json({
        transcript: '',
        message: 'No speech detected'
      });
    }

    return NextResponse.json({
      transcript: transcription.text
    });
  } catch (error) {
    console.error('Transcribe API error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio', transcript: '' },
      { status: 500 }
    );
  }
} 