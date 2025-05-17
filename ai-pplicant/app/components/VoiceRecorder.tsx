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
        setError("Speech recognition not supported by your browser");
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
      setError("Failed to start voice recording");
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
    
    setRecording(false);
  };
  
  // Handle changes to the isListening prop
  useEffect(() => {
    console.log("VoiceRecorder: isListening changed to", isListening);
    
    if (isListening) {
      startRecognition();
    } else {
      stopRecognition();
    }
    
    // Clean up on unmount
    return () => {
      stopRecognition();
    };
  }, [isListening]); // startRecognition and stopRecognition don't depend on props so they don't need to be in deps array
  
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