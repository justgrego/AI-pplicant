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
    return NextResponse.json({
      transcript: "Sorry, transcription service is unavailable (API key missing)"
    });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' }, 
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    return NextResponse.json({
      transcript: transcription.text
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
} 