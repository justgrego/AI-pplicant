'use client';

import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  text: string;
  voiceId?: string;
  autoPlay?: boolean;
  hideControls?: boolean;
}

export default function AudioPlayer({ text, voiceId, autoPlay = false, hideControls = false }: AudioPlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockMessage, setMockMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Play audio immediately on mount if autoPlay is true
  useEffect(() => {
    if (autoPlay && text) {
      console.log("AudioPlayer: Auto-playing audio for:", text.substring(0, 30) + "...");
      playAudio();
    }
  }, []);

  async function playAudio() {
    if (!text) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setMockMessage(null);

      console.log("AudioPlayer: Requesting audio for:", text.substring(0, 30) + "...");

      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voiceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      // Check if response is JSON (mock response) or binary (audio)
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        // This is a mock response for development without API keys
        const jsonData = await response.json();
        if (jsonData.mockData) {
          setMockMessage(jsonData.message || 'Using mock audio in development mode');
          setIsLoading(false);
          return;
        }
      }

      // It's a real audio response
      const audioBlob = await response.blob();
      
      // Create a URL for the blob
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Update the audio element with the new source
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        
        // Play the audio immediately
        try {
          console.log("AudioPlayer: Playing audio");
          await audioRef.current.play();
        } catch (playError) {
          console.error('Error playing audio:', playError);
          setError('Browser blocked audio playback. Please interact with the page first.');
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error playing audio:', err);
      setError('Error playing audio');
      setIsLoading(false);
    }
  }

  if (hideControls) {
    return (
      <div className="hidden">
        <audio ref={audioRef} />
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <audio ref={audioRef} controls className={mockMessage ? "hidden" : "w-full mt-2"} />
      
      {mockMessage && (
        <div className="p-3 bg-yellow-100/20 text-yellow-200 rounded-md mt-2 mb-2">
          <p>{mockMessage}</p>
        </div>
      )}

      <button
        onClick={playAudio}
        disabled={isLoading || !text}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isLoading ? (
          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
        ) : (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="mr-2"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
        {isLoading ? 'Generating Audio...' : 'Listen'}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
} 