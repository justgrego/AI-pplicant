'use client';

import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  text: string;
  messageId: number; // Unique ID for each message
  voiceId?: string;
  autoPlay?: boolean;
  hideControls?: boolean;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

// Keep track of which messages have been played globally
const playedMessages = new Set<number>();

export default function AudioPlayer({ 
  text, 
  messageId,
  voiceId, 
  autoPlay = false, 
  hideControls = false,
  onPlaybackStart,
  onPlaybackEnd
}: AudioPlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockMessage, setMockMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Check if already played
  const alreadyPlayed = playedMessages.has(messageId);

  // Play audio once function
  async function playAudioOnce() {
    // Don't play if already played or already loading
    if (alreadyPlayed || isLoading) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Mark as played immediately to prevent double execution
      playedMessages.add(messageId);
      
      // Get the audio from the API
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      // Handle mock responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const jsonData = await response.json();
        if (jsonData.mockData) {
          setMockMessage(jsonData.message || 'Using mock audio in development mode');
          setIsLoading(false);
          
          // Simulate playback for mock data
          if (onPlaybackStart) onPlaybackStart();
          const mockDuration = Math.min(Math.max(text.length * 50, 1000), 5000); // Cap at 5 seconds
          setTimeout(() => {
            if (onPlaybackEnd) onPlaybackEnd();
          }, mockDuration);
          
          return;
        }
      }

      // Play real audio
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        // Set up audio element
        audioRef.current.src = audioUrl;
        
        // Set event handlers directly on the element
        if (onPlaybackStart) {
          audioRef.current.onplay = onPlaybackStart;
        }
        
        if (onPlaybackEnd) {
          audioRef.current.onended = () => {
            // Clean up URL when done
            URL.revokeObjectURL(audioUrl);
            onPlaybackEnd();
          };
        }
        
        // Play audio
        try {
          await audioRef.current.play();
        } catch (playError) {
          console.error('Error playing audio:', playError);
          setError('Failed to play audio. Please try again.');
          if (onPlaybackEnd) onPlaybackEnd();
        }
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching audio:', err);
      setError('Error fetching audio');
      setIsLoading(false);
      if (onPlaybackEnd) onPlaybackEnd();
    }
  }

  // Auto-play on mount if needed
  useEffect(() => {
    // Only play if not already played and autoPlay is true
    if (autoPlay && !alreadyPlayed) {
      playAudioOnce();
    }
    
    return () => {
      // Clean up on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src) {
          try {
            URL.revokeObjectURL(audioRef.current.src);
          } catch (e) {
            // Ignore errors when revoking
          }
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Empty dependency array - run once on mount

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
        onClick={playAudioOnce}
        disabled={isLoading || alreadyPlayed}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 h-10 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isLoading ? (
          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
        ) : alreadyPlayed ? (
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
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
          </svg>
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
        {isLoading ? 'Loading...' : alreadyPlayed ? 'Played' : 'Listen'}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
} 