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
  isFeedback?: boolean; // Flag to indicate this is feedback audio
}

// Keep track of which messages have been played globally
const playedMessages = new Set<number>();

// Global audio context for Safari
let globalAudioContext: AudioContext | null = null;

// Utility function to check if running in Safari
const isSafari = typeof navigator !== 'undefined' ? 
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent) : false;

export default function AudioPlayer({ 
  text, 
  messageId,
  voiceId, 
  autoPlay = false, 
  hideControls = false,
  onPlaybackStart,
  onPlaybackEnd,
  isFeedback = false // New prop to handle feedback specially
}: AudioPlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockMessage, setMockMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Check if already played
  const alreadyPlayed = playedMessages.has(messageId);
  
  // Initialize or retrieve global audio context for Safari
  const initSafariAudioContext = () => {
    if (isSafari && !globalAudioContext) {
      try {
        const AudioContextClass = window.AudioContext || 
          ((window as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext);
        
        if (AudioContextClass) {
          globalAudioContext = new AudioContextClass();
          // Create and play a silent sound to unlock audio
          const oscillator = globalAudioContext.createOscillator();
          const gainNode = globalAudioContext.createGain();
          gainNode.gain.value = 0.01; // Very low volume
          oscillator.connect(gainNode);
          gainNode.connect(globalAudioContext.destination);
          oscillator.start(0);
          oscillator.stop(0.1);
          
          console.log("AudioPlayer: Initialized global Safari audio context");
          
          // Resume the context if it's suspended
          if (globalAudioContext.state === 'suspended') {
            globalAudioContext.resume().then(() => {
              console.log("AudioPlayer: Global audio context resumed");
            });
          }
        }
      } catch (err) {
        console.error("AudioPlayer: Failed to initialize Safari audio context:", err);
      }
    }
  };

  // Enhanced audio play function with special handling for feedback
  async function playAudioOnce() {
    // For Safari, initialize global audio context
    if (isSafari) {
      initSafariAudioContext();
    }
    
    // Add more detailed logging for debugging
    console.log(`AudioPlayer: playAudioOnce called for message ${messageId}. Already played: ${alreadyPlayed}, isLoading: ${isLoading}, isFeedback: ${isFeedback}, isSafari: ${isSafari}`);

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
      
      // Process text to ensure reasonable length for audio synthesis
      let processedText = text;
      if (processedText.length > 300 && isFeedback) {
        console.log("AudioPlayer: Feedback text is long, truncating for better playback");
        // For feedback, try to keep just the most relevant parts
        processedText = processedText.split('.').slice(0, 3).join('.') + '.';
      }
      
      console.log("AudioPlayer: Fetching audio for text:", processedText.substring(0, 50) + "...");
      
      // Get the audio from the API with priority flag for feedback
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Safari-Audio': isSafari ? 'true' : 'false',
          'X-Is-Feedback': isFeedback ? 'true' : 'false'
        },
        body: JSON.stringify({ 
          text: processedText, 
          voiceId,
          priority: isFeedback, // Signal priority for feedback
          safari: isSafari // Let API know this is Safari
        }),
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
        
        // For Safari feedback, set properties before setting source
        if (isSafari && isFeedback) {
          audioRef.current.volume = 1.0;
          audioRef.current.autoplay = true;
          audioRef.current.preload = "auto";
          console.log("AudioPlayer: Set Safari-specific properties for feedback audio");
        }
        
        // Set the source
        audioRef.current.src = audioUrl;
        
        // Set event handlers directly on the element
        if (onPlaybackStart) {
          audioRef.current.onplay = () => {
            console.log(`AudioPlayer: Audio playback started for message ${messageId}, isFeedback: ${isFeedback}, isSafari: ${isSafari}`);
            onPlaybackStart();
          };
        }
        
        if (onPlaybackEnd) {
          audioRef.current.onended = () => {
            console.log(`AudioPlayer: Audio playback ended for message ${messageId}, isFeedback: ${isFeedback}, isSafari: ${isSafari}`);
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
          console.log(`AudioPlayer: Attempting to play audio for message ${messageId}, isFeedback: ${isFeedback}, isSafari: ${isSafari}`);
          
          if (isSafari) {
            console.log("AudioPlayer: Safari browser detected, using special handling");
            
            // For Safari, ensure the audio is fully loaded before attempting to play
            audioRef.current.load();
            
            // Special handling for feedback in Safari - add extra load event
            if (isFeedback) {
              audioRef.current.volume = 1.0; // Ensure max volume for feedback
              console.log("AudioPlayer: Using enhanced Safari handling for feedback audio");
              
              // Add direct media session activation for Safari feedback
              if (navigator.mediaSession) {
                try {
                  navigator.mediaSession.setActionHandler('play', () => {
                    audioRef.current?.play().catch(err => {
                      console.error("Safari Media Session play error:", err);
                    });
                  });
                } catch (err) {
                  console.log("Safari doesn't support media session API fully:", err);
                }
              }
            }
            
            // Use a promise to wait for canplaythrough event with a timeout
            const playPromise = new Promise((resolve, reject) => {
              let hasStartedPlaying = false;
              
              // Event listener for canplaythrough
              const canPlayHandler = () => {
                if (hasStartedPlaying) return;
                hasStartedPlaying = true;
                audioRef.current?.removeEventListener('canplaythrough', canPlayHandler);
                
                console.log(`AudioPlayer: canplaythrough event triggered for message ${messageId}`);
                
                // Double check we can actually play the audio
                if (audioRef.current) {
                  // For Safari, try playing multiple times if needed
                  const attemptPlay = (attempt = 1) => {
                    // For feedback messages, be even more aggressive
                    if (isFeedback && globalAudioContext && globalAudioContext.state === 'suspended') {
                      console.log("AudioPlayer: Resuming global audio context for feedback");
                      globalAudioContext.resume();
                    }
                    
                    console.log(`AudioPlayer: Attempt ${attempt} to play audio for message ${messageId} (${isFeedback ? 'feedback' : 'regular'})`);
                    
                    // For Safari feedback, use a specific play approach
                    if (isFeedback && attempt === 1) {
                      // Create a user gesture simulation for Safari
                      const simulateUserGesture = () => {
                        if (audioRef.current) {
                          const playPromise = audioRef.current.play();
                          if (playPromise !== undefined) {
                            playPromise
                              .then(() => {
                                console.log("AudioPlayer: Safari feedback play successful after gesture simulation");
                                resolve(true);
                              })
                              .catch(err => {
                                console.error("AudioPlayer: Safari feedback play failed after gesture simulation:", err);
                                if (attempt < 3) {
                                  setTimeout(() => attemptPlay(attempt + 1), 200);
                                } else {
                                  reject(err);
                                }
                              });
                          }
                        }
                      };
                      
                      // Execute with a small delay to let Safari prepare
                      setTimeout(simulateUserGesture, 50);
                    } else {
                      // Regular approach for subsequent attempts or non-feedback
                      audioRef.current?.play()
                        .then(resolve)
                        .catch(err => {
                          console.error(`AudioPlayer: Error on attempt ${attempt}:`, err);
                          if (attempt < 3) {
                            // Try again after a short delay with escalating intervals
                            setTimeout(() => attemptPlay(attempt + 1), 200 * attempt);
                          } else {
                            reject(err);
                          }
                        });
                    }
                  };
                  
                  attemptPlay();
                } else {
                  reject(new Error("Audio element no longer available"));
                }
              };
              
              // Add the event listener for canplaythrough
              audioRef.current?.addEventListener('canplaythrough', canPlayHandler, { once: true });
              
              // Set a timeout in case the event doesn't fire
              setTimeout(() => {
                if (!hasStartedPlaying) {
                  console.log(`AudioPlayer: canplaythrough timeout for message ${messageId}, trying to play anyway`);
                  audioRef.current?.removeEventListener('canplaythrough', canPlayHandler);
                  if (audioRef.current) {
                    // For feedback in Safari, be even more aggressive in timeout case
                    if (isFeedback && isSafari) {
                      console.log("AudioPlayer: Aggressive feedback audio recovery attempt for Safari");
                      // Try to force unlock audio context
                      if (globalAudioContext && globalAudioContext.state === 'suspended') {
                        globalAudioContext.resume();
                      }
                      
                      // Try multiple play attempts with escalating delays
                      const forcedPlay = (attempt = 1) => {
                        setTimeout(() => {
                          if (audioRef.current) {
                            console.log(`AudioPlayer: Forced play attempt ${attempt} for Safari feedback`);
                            audioRef.current.play()
                              .then(resolve)
                              .catch(err => {
                                console.error(`AudioPlayer: Forced play attempt ${attempt} failed:`, err);
                                if (attempt < 5) {
                                  forcedPlay(attempt + 1);
                                } else {
                                  reject(err);
                                }
                              });
                          }
                        }, attempt * 100); // Escalating delays
                      };
                      
                      forcedPlay();
                    } else {
                      audioRef.current.play().then(resolve).catch(reject);
                    }
                  } else {
                    reject(new Error("Audio element no longer available"));
                  }
                }
              }, isFeedback ? 1000 : 2000); // Shorter timeout for feedback
            });
            
            await playPromise;
          } else {
            // Standard approach for other browsers
            await audioRef.current.play();
          }
        } catch (playError) {
          console.error('AudioPlayer: Error playing audio:', playError);
          console.error('AudioPlayer: Browser:', navigator.userAgent);
          
          // Special recovery attempt for feedback in Safari
          if (isFeedback && isSafari) {
            console.log("AudioPlayer: Attempting Safari feedback recovery after error");
            try {
              // Wait a moment and try one more approach
              setTimeout(() => {
                if (audioRef.current) {
                  console.log("AudioPlayer: Last-ditch Safari feedback recovery attempt");
                  audioRef.current.play().catch(e => {
                    console.error("AudioPlayer: Recovery attempt failed:", e);
                  });
                }
              }, 500);
            } catch (recoveryError) {
              console.error("AudioPlayer: Recovery attempt error:", recoveryError);
            }
          }
          
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
    // For Safari, initialize audio context early
    if (isSafari) {
      initSafariAudioContext();
    }
    
    // Add more logging for debugging
    console.log(`AudioPlayer: Component mounted for message ${messageId}, autoPlay=${autoPlay}, alreadyPlayed=${alreadyPlayed}, isFeedback=${isFeedback}, isSafari=${isSafari}`);
    
    // Only play if not already played and autoPlay is true
    if (autoPlay && !alreadyPlayed) {
      console.log(`AudioPlayer: Will auto-play audio for message ${messageId} in 100ms`);
      // Use a small timeout to ensure the component is fully mounted
      setTimeout(() => {
        console.log(`AudioPlayer: Triggering auto-play for message ${messageId}, isFeedback: ${isFeedback}`);
        playAudioOnce();
      }, isFeedback && isSafari ? 10 : 100); // Much faster trigger for feedback in Safari
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
        onClick={() => {
          // For Safari, initialize audio context on button click
          if (isSafari) {
            initSafariAudioContext();
          }
          playAudioOnce();
        }}
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