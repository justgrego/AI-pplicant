'use client';

import { useState, useRef, useEffect } from 'react';

// Define type for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

// Declare global types for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isListening?: boolean;
  autoStopAfterSilence?: boolean;
}

export default function VoiceRecorder({ 
  onTranscription, 
  isListening = false,
  autoStopAfterSilence = false
}: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  
  // Initialize recognition as null
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  
  // Add refs for MediaRecorder fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [useFallbackRecorder, setUseFallbackRecorder] = useState(false);
  
  // Start speech recognition
  const startRecognition = () => {
    try {
      console.log("VoiceRecorder: Starting recognition");
      
      // Reset state
      setTranscript('');
      setError(null);
      
      // Get speech recognition constructor
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.error("VoiceRecorder: SpeechRecognition not supported by browser");
        setError("Speech recognition not supported by browser, using fallback recording");
        setUseFallbackRecorder(true);
        startMediaRecording();
        return;
      }
      
      // Create new recognition instance
      const recognition = new SpeechRecognition();
      
      // Configure recognition
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      
      // Save reference
      recognitionRef.current = recognition;
      
      // Handle results
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        console.log("VoiceRecorder: Got speech result");
        
        // Get latest result
        const result = event.results[event.results.length - 1];
        const currentTranscript = result[0].transcript;
        console.log("VoiceRecorder: Transcript:", currentTranscript);
        
        // Update transcript
        setTranscript(currentTranscript);
      };
      
      // Handle end event
      recognition.onend = () => {
        console.log("VoiceRecorder: Recognition ended, transcript:", transcript);
        
        // Auto-stop after silence if enabled
        if (autoStopAfterSilence) {
          // If we have a transcript, submit it
          if (transcript) {
            onTranscription(transcript);
          }
        } else {
          // If we have a transcript, submit it
          if (transcript) {
            onTranscription(transcript);
          }
        }
        
        // If still listening, restart recognition
        if (isListening) {
          try {
            recognition.start();
            console.log("VoiceRecorder: Recognition restarted");
          } catch (error) {
            console.error("VoiceRecorder: Failed to restart recognition", error);
          }
        }
        
        setRecording(false);
      };
      
      // Handle errors
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("VoiceRecorder: Recognition error:", event.error);
        setError(`Speech recognition error: ${event.error}`);
      };
      
      // Start recognition
      recognition.start();
      setRecording(true);
      console.log("VoiceRecorder: Recognition started");
      
    } catch (error) {
      console.error("VoiceRecorder: Failed to start recognition", error);
      setError("Failed to start voice recording, trying fallback method");
      setUseFallbackRecorder(true);
      startMediaRecording();
    }
  };
  
  // Start media recording (fallback)
  const startMediaRecording = async () => {
    try {
      console.log("VoiceRecorder: Starting media recording fallback");
      
      // Reset the audio chunks
      audioChunksRef.current = [];
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Setup event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log("VoiceRecorder: Media recording stopped");
        
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Create FormData to send to the server
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          
          try {
            console.log("VoiceRecorder: Sending audio to server for transcription");
            
            // Send recording to server for transcription via OpenAI
            const response = await fetch('/api/transcribe', {
              method: 'POST',
              body: formData,
            });
            
            if (!response.ok) {
              throw new Error('Failed to transcribe audio');
            }
            
            const data = await response.json();
            console.log("VoiceRecorder: Received transcription:", data.transcript);
            
            // Set transcript and call callback
            if (data.transcript) {
              setTranscript(data.transcript);
              onTranscription(data.transcript);
            }
          } catch (error) {
            console.error("VoiceRecorder: Transcription error:", error);
            setError("Failed to transcribe audio");
          }
        }
        
        // Release all media streams
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        setRecording(false);
      };
      
      // Start recording
      mediaRecorder.start();
      setRecording(true);
      console.log("VoiceRecorder: Media recording started");
      
    } catch (error) {
      console.error("VoiceRecorder: Failed to start media recording:", error);
      setError("Failed to access microphone or start recording");
      setRecording(false);
    }
  };
  
  // Stop speech recognition
  const stopRecognition = () => {
    console.log("VoiceRecorder: Stopping recognition");
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log("VoiceRecorder: Recognition stopped");
      } catch (error) {
        console.error("VoiceRecorder: Error stopping recognition", error);
      }
      
      // Clear reference
      recognitionRef.current = null;
    }
    
    // Also stop media recorder if it's active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
        console.log("VoiceRecorder: Media recorder stopped");
      } catch (error) {
        console.error("VoiceRecorder: Error stopping media recorder", error);
      }
    }
    
    setRecording(false);
  };
  
  // Handle changes to the isListening prop
  useEffect(() => {
    console.log("VoiceRecorder: isListening changed to", isListening);
    
    if (isListening) {
      if (useFallbackRecorder) {
        startMediaRecording();
      } else {
        startRecognition();
      }
    } else {
      stopRecognition();
    }
    
    // Clean up on unmount
    return () => {
      stopRecognition();
    };
  }, [isListening, useFallbackRecorder]); 
  
  // Simple UI
  return (
    <div className={recording ? "block" : "hidden"}>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <div className="flex items-center justify-center">
        <div className={`w-4 h-4 rounded-full ${recording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}>
        </div>
        <span className="ml-2 text-sm text-gray-300">
          {recording ? 'Recording voice...' : 'Voice recorder ready'}
        </span>
      </div>
    </div>
  );
}