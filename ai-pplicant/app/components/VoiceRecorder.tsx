'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// Define interface for speech recognition
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: (event: Event) => void;
  onerror: (event: Event) => void;
  onend: () => void;
}

// Add type definitions for the WebSpeechAPI
declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognitionInstance };
    webkitSpeechRecognition: { new(): SpeechRecognitionInstance };
  }
}

// Define types for the speech recognition events
interface SpeechRecognitionEvent extends Event {
  results: {
    transcript: string;
  }[][];
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isListening?: boolean;
  autoStopAfterSilence?: boolean; // Add option to disable automatic stopping
}

export default function VoiceRecorder({ 
  onTranscription, 
  isListening = false, 
  autoStopAfterSilence = false // Default to not auto-stopping
}: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSilent, setIsSilent] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Process audio blob to get transcription
  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      // Only needed for the MediaRecorder fallback path
      // Create FormData to send the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }
      
      const data = await response.json();
      onTranscription(data.transcript);
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Failed to process audio');
    }
  }, [onTranscription]);

  // Auto-stop recording after silence (only if enabled)
  const resetSilenceTimer = useCallback(() => {
    if (!autoStopAfterSilence) return; // Skip if auto-stop is disabled
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    // Stop recording after 2 seconds of silence
    silenceTimerRef.current = setTimeout(() => {
      if (recording && transcript) {
        console.log("Detected silence, stopping recording");
        setIsSilent(true);
        stopRecording();
      }
    }, 2000);
  }, [recording, transcript, autoStopAfterSilence]); // added dependency

  // Stop recording and process audio
  const stopRecording = useCallback(() => {
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping speech recognition:", e);
      }
    }
    
    if (mediaRecorderRef.current && recording) {
      // If it's a MediaRecorder object with recording state
      if (
        'state' in (mediaRecorderRef.current as unknown as {state?: string}) && 
        (mediaRecorderRef.current as unknown as {state: string}).state === 'recording'
      ) {
        mediaRecorderRef.current.stop();
      }
      
      setRecording(false);
      
      // Submit the transcript we've collected so far
      if (transcript) {
        onTranscription(transcript);
      }
    }
  }, [recording, onTranscription, transcript]);

  // Request microphone permission
  useEffect(() => {
    const requestMicrophonePermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setPermissionGranted(true);
        // Clean up the stream when component unmounts
        return () => {
          stream.getTracks().forEach(track => track.stop());
        };
      } catch (err) {
        console.error('Error accessing microphone:', err);
        setError('Microphone access denied. Please enable microphone permissions.');
        setPermissionGranted(false);
      }
    };

    requestMicrophonePermission();
  }, []);

  const startRecording = useCallback(async () => {
    if (!permissionGranted) {
      setError('Microphone permission not granted');
      return;
    }

    try {
      setError(null);
      setTranscript("");
      setIsSilent(false);
      
      // Try using the browser's SpeechRecognition API first (more seamless)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        // If browser supports SpeechRecognition, use it directly
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true; // Keep listening
        recognition.interimResults = true; // Get results as user speaks
        
        // Store recognition instance for later stopping
        recognitionRef.current = recognition;
        
        recognition.onresult = (event: Event) => {
          const speechEvent = event as unknown as SpeechRecognitionEvent;
          let currentTranscript = '';
          
          // Collect all results to build a full transcript
          for (let i = 0; i < speechEvent.results.length; i++) {
            currentTranscript += speechEvent.results[i][0].transcript + ' ';
          }
          
          setTranscript(currentTranscript.trim());
          
          if (autoStopAfterSilence) {
            resetSilenceTimer(); // Reset silence timer when speech is detected
          }
        };
        
        recognition.onerror = (event: Event) => {
          const errorEvent = event as unknown as SpeechRecognitionErrorEvent;
          if (errorEvent.error !== 'no-speech') { // Ignore no-speech errors
            console.error('Speech recognition error', errorEvent.error);
            setError('Speech recognition error: ' + errorEvent.error);
          }
        };
        
        recognition.onend = () => {
          // If auto-stop is enabled and we have silence
          if (autoStopAfterSilence && isSilent && transcript) {
            onTranscription(transcript);
          } else if (recording) {
            // If recognition ended but we're still supposed to be recording, restart it
            try {
              recognition.start();
            } catch (e) {
              console.error("Error restarting speech recognition:", e);
            }
          }
        };
        
        recognition.start();
        setRecording(true);
      } else {
        // Fallback to MediaRecorder approach
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          await processAudio(audioBlob);
          // Release microphone
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setRecording(true);
        
        // Set up the silence timer if auto-stop is enabled
        if (autoStopAfterSilence) {
          resetSilenceTimer();
        }
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording');
    }
  }, [permissionGranted, onTranscription, resetSilenceTimer, transcript, isSilent, processAudio, autoStopAfterSilence, recording]);

  // Handle automatic listening mode
  useEffect(() => {
    if (isListening && permissionGranted && !recording) {
      startRecording();
    } else if (!isListening && recording) {
      stopRecording();
    }
  }, [isListening, permissionGranted, recording, startRecording, stopRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      if (mediaRecorderRef.current && recording) {
        stopRecording();
      }
    };
  }, [recording, stopRecording]);

  // Simplified UI just for visual feedback (mostly hidden in main UI)
  return (
    <div className={recording ? "block" : "hidden"}>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <div className="flex items-center justify-center">
        <div className={`w-3 h-3 rounded-full ${recording ? 'bg-red-600 animate-ping' : 'bg-gray-400'}`}></div>
      </div>
    </div>
  );
} 