'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// Add type definitions for the WebSpeechAPI
declare global {
  interface Window {
    SpeechRecognition: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isListening?: boolean;
}

export default function VoiceRecorder({ onTranscription, isListening = false }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSilent, setIsSilent] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Auto-stop recording after silence
  const resetSilenceTimer = useCallback(() => {
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
  }, [recording, transcript]);

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
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: Event) => {
          const speechEvent = event as unknown as { results: { transcript: string }[][]; resultIndex: number };
          const newTranscript = speechEvent.results[speechEvent.resultIndex][0].transcript;
          setTranscript(prev => prev ? `${prev} ${newTranscript}` : newTranscript);
          resetSilenceTimer(); // Reset silence timer when speech is detected
        };
        
        recognition.onerror = (event: Event) => {
          const errorEvent = event as unknown as { error: string };
          if (errorEvent.error !== 'no-speech') { // Ignore no-speech errors
            console.error('Speech recognition error', errorEvent.error);
            setError('Speech recognition error: ' + errorEvent.error);
          }
        };
        
        recognition.onend = () => {
          // If we have a transcript and silence was detected, submit it
          if (transcript && isSilent) {
            onTranscription(transcript);
          } else if (!transcript) {
            // If recognition ended but no transcript, restart it
            recognition.start();
          }
        };
        
        recognition.start();
        setRecording(true);
        
        // Store recognition object in ref for cleanup
        mediaRecorderRef.current = recognition as unknown as MediaRecorder;
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
        
        // Set up the silence timer
        resetSilenceTimer();
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording');
    }
  }, [permissionGranted, onTranscription, resetSilenceTimer, transcript, isSilent]);

  const stopRecording = useCallback(() => {
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current && recording) {
      // If it's a SpeechRecognition object (has stop method)
      if (typeof (mediaRecorderRef.current as any).stop === 'function') {
        try {
          (mediaRecorderRef.current as any).stop();
        } catch (e) {
          console.error("Error stopping recorder:", e);
        }
      } 
      // If it's a MediaRecorder object with recording state
      else if (
        'state' in (mediaRecorderRef.current as unknown as {state?: string}) && 
        (mediaRecorderRef.current as unknown as {state: string}).state === 'recording'
      ) {
        mediaRecorderRef.current.stop();
      }
      
      setRecording(false);
      
      // If using direct speech recognition and we have a transcript
      if (transcript && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
        onTranscription(transcript);
      }
    }
  }, [recording, onTranscription, transcript]);

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
      if (mediaRecorderRef.current && recording) {
        stopRecording();
      }
    };
  }, [recording, stopRecording]);

  const processAudio = async (audioBlob: Blob) => {
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
  };

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