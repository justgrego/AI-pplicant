import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Check if API key is missing (development mode without .env.local)
    if (!process.env.ELEVENLABS_API_KEY) {
      console.warn('ELEVENLABS_API_KEY is missing. Using mock audio response.');
      
      // Return a simple response for development
      return NextResponse.json(
        { message: 'Mock audio response - API key not configured locally. Add keys to your .env.local file or use the deployed version.' },
        { status: 200 }
      );
    }

    // Use default voice if not provided
    const selectedVoiceId = voiceId || 'CYw3kZ02Hs0563khs1Fj'; // Default voice: Jessica

    // Direct fetch to ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    // Get the audio data
    const audioArrayBuffer = await response.arrayBuffer();
    
    // Return the audio data as a response
    return new NextResponse(audioArrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioArrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Voice conversion error:', error);
    return NextResponse.json(
      { error: 'Failed to convert text to speech' },
      { status: 500 }
    );
  }
}

// Configure the API route for handling larger audio files
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
  },
}; 