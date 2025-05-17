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
    const { text, voiceId, priority = false, safari = false } = await request.json();
    
    // Get Safari information from headers as well
    const safariHeader = request.headers.get('x-safari-audio') === 'true';
    const isFeedbackHeader = request.headers.get('x-is-feedback') === 'true';
    
    // Combine info sources
    const isSafari = safari || safariHeader;
    const isFeedback = priority || isFeedbackHeader;

    if (!text) {
      console.error('Voice API: Text is required');
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }
    
    // Log special handling cases
    if (isFeedback) {
      console.log('Voice API: Processing PRIORITY feedback audio request');
    }
    
    if (isSafari) {
      console.log('Voice API: Processing request for Safari browser');
    }

    // Check if API key is missing
    if (!process.env.ELEVENLABS_API_KEY) {
      console.log('Voice API: Using mock voice response (API key missing)');
      return getMockAudioResponse();
    }

    // Use default voice if not provided
    const selectedVoiceId = voiceId || 'aEO01A4wXwd1O8GPgGlF'; // Custom voice ID
    console.log(`Voice API: Using voice ID ${selectedVoiceId} for ${isFeedback ? 'FEEDBACK' : 'regular'} text: "${text.substring(0, 50)}..."`);

    // Optimize text for audio if it's a feedback message
    let processedText = text;
    
    // More aggressive text processing for Safari feedback
    if (isFeedback) {
      if (isSafari && text.length > 100) {
        // For Safari feedback, keep it very short and simple
        processedText = text.split('.').filter((s: string) => s.trim().length > 0).slice(0, 2).join('.') + '.';
        console.log(`Voice API: Shortened Safari feedback text for better playback: "${processedText}"`);
      } else if (text.length > 150) {
        // For feedback in other browsers, still shorten but less aggressively
        processedText = text.split('.').filter((s: string) => s.trim().length > 0).slice(0, 3).join('.') + '.';
        console.log(`Voice API: Shortened feedback text for better playback: "${processedText}"`);
      }
    }

    try {
      // Direct fetch to ElevenLabs API with optimized settings for feedback
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
            text: processedText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: isFeedback ? 0.80 : 0.5, // Higher stability for feedback
              similarity_boost: isFeedback ? 0.85 : 0.75, // Better clarity for feedback
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
      console.log(`Voice API: Successfully generated ${isFeedback ? 'FEEDBACK' : 'regular'} audio (${audioArrayBuffer.byteLength} bytes)`);
      
      // Safari-specific headers if needed
      const safariSpecificHeaders: Record<string, string> = {};
      if (isSafari) {
        Object.assign(safariSpecificHeaders, {
          'X-Content-Type-Options': 'nosniff',
          'X-Audio-Type': isFeedback ? 'feedback' : 'regular',
          'Content-Disposition': 'inline; filename="audio.mp3"',
          'X-Safari-Compatible': 'true'
        });
      }
      
      // Feedback-specific headers
      const feedbackSpecificHeaders: Record<string, string> = {};
      if (isFeedback) {
        Object.assign(feedbackSpecificHeaders, {
          'X-Feedback-Audio': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        });
      }
      
      // Return the audio data as a response with headers optimized for the browser
      return new NextResponse(audioArrayBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioArrayBuffer.byteLength.toString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range, X-Safari-Audio, X-Is-Feedback',
          'Accept-Ranges': 'bytes',
          ...safariSpecificHeaders,
          ...feedbackSpecificHeaders
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