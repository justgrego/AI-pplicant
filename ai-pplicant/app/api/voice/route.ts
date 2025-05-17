import { NextRequest, NextResponse } from 'next/server';

// Configure the API route for longer processing time
export const config = {
  maxDuration: 30, // 30 seconds timeout
};

// Create a mock audio response for development or when API key is missing
async function getMockAudioResponse() {
  console.log('Voice API: Returning mock audio response');
  return NextResponse.json(
    {
      mockData: true,
      message: 'Using mock audio in development mode. Real audio would play here in production.',
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();

    if (!text) {
      console.error('Voice API: Text is required');
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Check if API key is missing
    if (!process.env.ELEVENLABS_API_KEY) {
      console.log('Voice API: Using mock voice response (API key missing)');
      return getMockAudioResponse();
    }

    // Use default voice if not provided
    const selectedVoiceId = voiceId || 'CYw3kZ02Hs0563khs1Fj'; // Default voice: Jessica
    console.log(`Voice API: Using voice ID ${selectedVoiceId} for text: "${text.substring(0, 50)}..."`);

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
        console.error(`Voice API: ElevenLabs API error: ${response.status}`);
        // Try to get more detailed error info from the response
        try {
          const errorData = await response.json();
          console.error('Voice API: Error details:', errorData);
        } catch {
          // Ignore if we can't parse the error response
        }
        return getMockAudioResponse();
      }

      // Get the audio data
      const audioArrayBuffer = await response.arrayBuffer();
      console.log(`Voice API: Successfully generated audio (${audioArrayBuffer.byteLength} bytes)`);
      
      // Return the audio data as a response
      return new NextResponse(audioArrayBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioArrayBuffer.byteLength.toString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
      });
    } catch (apiError) {
      console.error('Voice API: ElevenLabs API error:', apiError);
      return getMockAudioResponse();
    }
  } catch (error) {
    console.error('Voice API: Voice conversion error:', error);
    return getMockAudioResponse();
  }
} 