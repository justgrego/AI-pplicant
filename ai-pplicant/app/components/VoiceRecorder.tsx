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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording');
    }
  }, [permissionGranted]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  // Handle automatic listening mode
  useEffect(() => {
    if (isListening && permissionGranted && !recording) {
      startRecording();
    } else if (!isListening && recording) {
      stopRecording();
    }
  }, [isListening, permissionGranted, recording, startRecording, stopRecording]);

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Use native browser SpeechRecognition API
      // Note: For production, consider using a more robust service like Google Speech-to-Text
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        // If browser supports SpeechRecognition
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        // Create audio from the blob and play it to the recognition API
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
        
        recognition.onresult = (event: Event) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const speechEvent = event as unknown as { results: { transcript: string }[][] };
          const transcript = speechEvent.results[0][0].transcript;
          onTranscription(transcript);
        };
        
        recognition.onerror = (event: Event) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const errorEvent = event as unknown as { error: string };
          console.error('Speech recognition error', errorEvent.error);
          setError('Speech recognition error: ' + errorEvent.error);
        };
        
        recognition.start();
      } else {
        // Fallback to sending the audio to a server-side API
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
      }
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Failed to process audio');
    }
  };

  return (
    <div className="mt-4">
      {error && <p className="text-red-500 mb-2">{error}</p>}
      
      <button
        onClick={recording ? stopRecording : startRecording}
        disabled={!permissionGranted}
        className={`flex items-center justify-center rounded-full w-12 h-12 ${
          recording 
            ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        title={recording ? 'Stop recording' : 'Start recording'}
      >
        {recording ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </button>
      
      <p className="text-xs mt-2 text-gray-300">
        {recording ? 'Recording... Click to stop' : 'Click to record your voice'}
      </p>
    </div>
  );
} 