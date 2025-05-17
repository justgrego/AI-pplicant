'use client';

import { useState, useRef, useEffect } from 'react';

// Declare global types for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
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
  const recognitionRef = useRef<any>(null);
  
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
  }, [isListening]);
  
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
      recognition.onresult = (event: any) => {
        console.log("VoiceRecorder: Got speech result");
        
        // Get latest result
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        console.log("VoiceRecorder: Transcript:", transcript);
        
        // Update transcript
        setTranscript(transcript);
      };
      
      // Handle end event
      recognition.onend = () => {
        console.log("VoiceRecorder: Recognition ended, transcript:", transcript);
        
        // If we have a transcript, submit it
        if (transcript) {
          onTranscription(transcript);
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
      recognition.onerror = (event: any) => {
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
  
  // Simple UI
  return (
    <div className={recording ? "block" : "hidden"}>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <div className="flex items-center justify-center">
        <div className={`