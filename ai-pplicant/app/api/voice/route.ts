import { NextRequest, NextResponse } from 'next/server';

// Create a mock audio response for development or when API key is missing
async function getMockAudioResponse() {
  return NextResponse.json({
    message: "Mock audio response - API key not configured or in development mode",
    mockData: true
  });
}

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
    if (!process.env.ELEVENLABS_API_KEY || process.env.NODE_ENV === 'development') {
      console.log('Using mock voice response (API key missing or in development)');
      return getMockAudioResponse();
    }

    // Use default voice if not provided
    const selectedVoiceId = voiceId || 'CYw3kZ02Hs0563khs1Fj'; // Default voice: Jessica

    try {
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
        console.error(`ElevenLabs API error: ${response.status}`);
        return getMockAudioResponse();
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
    } catch (apiError) {
      console.error('ElevenLabs API error:', apiError);
      return getMockAudioResponse();
    }
  } catch (error) {
    console.error('Voice conversion error:', error);
    return getMockAudioResponse();
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