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
    // Add more logging for debugging
    console.log(`AudioPlayer: playAudioOnce called for message ${messageId}. Already played: ${alreadyPlayed}, isLoading: ${isLoading}`);

    // Don't play if already played or already loading
    if (alreadyPlayed || isLoading) {
      console.log(`AudioPlayer: Skipping playback for message ${messageId} - already played: ${alreadyPlayed}, isLoading: ${isLoading}`);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Mark as played immediately to prevent double execution
      playedMessages.add(messageId);
      
      console.log("AudioPlayer: Fetching audio for text:", text.substring(0, 50) + "...");
      
      // Get the audio from the API
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      });

      if (!response.ok) {
        console.error(`AudioPlayer: Failed to generate audio - status ${response.status}`);
        throw new Error(`Failed to generate audio (status ${response.status})`);
      }

      // Handle mock responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const jsonData = await response.json();
        console.log("AudioPlayer: Received mock data response:", jsonData);
        if (jsonData.mockData) {
          setMockMessage(jsonData.message || 'Using mock audio in development mode');
          setIsLoading(false);
          
          // Simulate playback for mock data
          if (onPlaybackStart) {
            console.log(`AudioPlayer: Calling onPlaybackStart for mock audio, message ${messageId}`);
            onPlaybackStart();
          }
          const mockDuration = Math.min(Math.max(text.length * 50, 1000), 5000); // Cap at 5 seconds
          setTimeout(() => {
            if (onPlaybackEnd) {
              console.log(`AudioPlayer: Calling onPlaybackEnd for mock audio, message ${messageId}`);
              onPlaybackEnd();
            }
          }, mockDuration);
          
          return;
        }
      }

      console.log("AudioPlayer: Got audio response, creating blob");
      // Play real audio
      const audioBlob = await response.blob();
      
      // Create a URL from the blob with a specific MIME type for better Safari compatibility
      const audioUrl = URL.createObjectURL(
        new Blob([await audioBlob.arrayBuffer()], { type: 'audio/mpeg' })
      );
      
      if (audioRef.current) {
        console.log("AudioPlayer: Setting up audio element with URL");
        // Set up audio element - for Safari, ensure we reset any previous state
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = audioUrl;
        
        // Set event handlers directly on the element
        if (onPlaybackStart) {
          audioRef.current.onplay = () => {
            console.log(`AudioPlayer: Audio playback started for message ${messageId}`);
            onPlaybackStart();
          };
        }
        
        if (onPlaybackEnd) {
          audioRef.current.onended = () => {
            console.log(`AudioPlayer: Audio playback ended for message ${messageId}`);
            // Clean up URL when done
            URL.revokeObjectURL(audioUrl);
            onPlaybackEnd();
          };
        }
        
        // Add error event handler
        audioRef.current.onerror = (e) => {
          const errorEvent = e as ErrorEvent;
          console.error('AudioPlayer: Error playing audio:', errorEvent);
          setError(`Audio playback error: ${errorEvent.message || 'Unknown error'}`);
          if (onPlaybackEnd) onPlaybackEnd();
        };
        
        // Play audio with Safari-specific handling
        try {
          console.log(`AudioPlayer: Attempting to play audio for message ${messageId}`);
          
          // Check if this is Safari
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          if (isSafari) {
            console.log("AudioPlayer: Safari browser detected, using special handling");
            
            // For Safari, ensure the audio is fully loaded before attempting to play
            audioRef.current.load();
            
            // Use a promise to wait for canplaythrough event
            const playPromise = new Promise((resolve, reject) => {
              const canPlayHandler = () => {
                audioRef.current?.removeEventListener('canplaythrough', canPlayHandler);
                audioRef.current?.play().then(resolve).catch(reject);
              };
              
              audioRef.current?.addEventListener('canplaythrough', canPlayHandler, { once: true });
              
              // Set a timeout in case the event doesn't fire
              setTimeout(() => {
                audioRef.current?.removeEventListener('canplaythrough', canPlayHandler);
                audioRef.current?.play().then(resolve).catch(reject);
              }, 1000);
            });
            
            await playPromise;
          } else {
            // Standard approach for other browsers
            await audioRef.current.play();
          }
        } catch (playError) {
          console.error('AudioPlayer: Error playing audio:', playError);
          console.error('AudioPlayer: Browser:', navigator.userAgent);
          setError('Failed to play audio. Please try again.');
          if (onPlaybackEnd) onPlaybackEnd();
        }
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('AudioPlayer: Error fetching audio:', err);
      setError('Error fetching audio');
      setIsLoading(false);
      if (onPlaybackEnd) onPlaybackEnd();
    }
  }

  // Auto-play on mount if needed
  useEffect(() => {
    // Add more logging for debugging
    console.log(`AudioPlayer: Component mounted for message ${messageId}, autoPlay=${autoPlay}, alreadyPlayed=${alreadyPlayed}`);
    
    // Only play if not already played and autoPlay is true
    if (autoPlay && !alreadyPlayed) {
      console.log(`AudioPlayer: Will auto-play audio for message ${messageId} in 100ms`);
      // Use a small timeout to ensure the component is fully mounted
      setTimeout(() => {
        console.log(`AudioPlayer: Triggering auto-play for message ${messageId}`);
        playAudioOnce();
      }, 100);
    }
    
    // Store current audio ref for cleanup
    const currentAudioRef = audioRef.current;
    
    return () => {
      // Clean up on unmount
      if (currentAudioRef) {
        currentAudioRef.pause();
        if (currentAudioRef.src) {
          try {
            URL.revokeObjectURL(currentAudioRef.src);
          } catch {
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
        <audio 
          ref={audioRef} 
          preload="auto"
          crossOrigin="anonymous"
          playsInline
        />
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <audio 
        ref={audioRef} 
        controls 
        preload="auto"
        crossOrigin="anonymous"
        playsInline
        className={mockMessage ? "hidden" : "w-full mt-2"} 
      />
      
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