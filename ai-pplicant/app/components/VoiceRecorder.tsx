'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

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
    webkitAudioContext: typeof AudioContext;
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
  const [audioLevel, setAudioLevel] = useState(0); // To visualize audio level
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  
  // Initialize recognition as null
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  
  // Add refs for MediaRecorder fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioTestRef = useRef<HTMLAudioElement | null>(null);
  const [useFallbackRecorder, setUseFallbackRecorder] = useState(false);
  
  // Helper function to get supported MIME type for audio recording
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    // Default to audio/webm which is widely supported
    return 'audio/webm';
  };
  
  // Check for browser compatibility immediately
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("VoiceRecorder: SpeechRecognition not supported, using fallback");
      setUseFallbackRecorder(true);
    }
    
    // Clean up on unmount
    return () => {
      stopRecognition();
    };
  }, []);
  
  // Setup audio visualization when recording
  const setupAudioVisualization = useCallback((stream: MediaStream) => {
    try {
      // Store stream reference for cleanup
      streamRef.current = stream;
      
      // Create AudioContext
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create analyzer node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Connect the stream to the analyzer
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Setup audio level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (recording && analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          
          // Set audio level (0-100)
          setAudioLevel(Math.min(100, average * 2));
          
          // Continue monitoring while recording
          requestAnimationFrame(updateAudioLevel);
        }
      };
      
      // Start monitoring
      updateAudioLevel();
    } catch (err) {
      console.error("Failed to setup audio visualization:", err);
      // Non-critical error, so just log it
    }
  }, [recording]);
  
  // Cleanup audio context and stream
  const cleanupAudio = useCallback(() => {
    // Close AudioContext if open
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      audioContextRef.current = null;
    }
    
    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
      streamRef.current = null;
    }
    
    // Clear analyzer reference
    analyserRef.current = null;
    
    // Reset audio level
    setAudioLevel(0);
    
    // Revoke any test audio URLs
    if (audioTestRef.current && audioTestRef.current.src) {
      URL.revokeObjectURL(audioTestRef.current.src);
    }
  }, []);
  
  // Stop speech recognition
  const stopRecognition = useCallback(() => {
    if (!recording) return; // Don't do anything if not recording
    
    console.log("VoiceRecorder: Stopping recognition");
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (error) {
        console.error("VoiceRecorder: Error stopping recognition", error);
      }
    }
    
    // Also stop media recorder if it's active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("VoiceRecorder: Error stopping media recorder", error);
      }
      mediaRecorderRef.current = null;
    }
    
    // Clean up audio resources
    cleanupAudio();
    setRecording(false);
  }, [cleanupAudio, recording]);
  
  // Start media recording (fallback) - memoized with useCallback
  const startMediaRecording = useCallback(async () => {
    if (recording) return; // Don't start if already recording
    
    try {
      console.log("VoiceRecorder: Starting media recording fallback");
      
      // Reset the audio chunks
      audioChunksRef.current = [];
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio visualization
      setupAudioVisualization(stream);
      
      // Create media recorder with optimal settings
      const options = { 
        mimeType: getSupportedMimeType(),
        audioBitsPerSecond: 128000
      };
      
      const mediaRecorder = new MediaRecorder(stream, options);
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
          const audioBlob = new Blob(audioChunksRef.current, { type: getSupportedMimeType() });
          
          // Create a test URL for local playback to verify the recording worked
          const testUrl = URL.createObjectURL(audioBlob);
          setTestAudioUrl(testUrl);
          
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
            } else {
              setError("No speech detected. Please try again.");
            }
          } catch (error) {
            console.error("VoiceRecorder: Transcription error:", error);
            setError("Failed to transcribe audio. Please try again.");
          }
        } else {
          setError("No audio recorded. Please try again.");
        }
        
        // Clean up
        cleanupAudio();
        setRecording(false);
      };
      
      // Handle recorder errors
      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setError("Recording error occurred. Please try again.");
        cleanupAudio();
        setRecording(false);
      };
      
      // Start recording with 10 ms timeslices to get frequent data chunks
      mediaRecorder.start(10);
      setRecording(true);
      console.log("VoiceRecorder: Media recording started");
      
    } catch (error) {
      console.error("VoiceRecorder: Failed to start media recording:", error);
      setError("Failed to access microphone or start recording");
      setRecording(false);
    }
  }, [onTranscription, setupAudioVisualization, cleanupAudio, recording]);
  
  // Start speech recognition - memoized with useCallback
  const startRecognition = useCallback(() => {
    if (recording) return; // Don't start if already recording
    
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
      
      // Also get microphone access for visualization
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(setupAudioVisualization)
        .catch(err => console.error("Couldn't access microphone for visualization:", err));
      
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
        
        // Submit the transcript if available
        if (transcript) {
          onTranscription(transcript);
        }
        
        // If still listening but not recording, restart recognition
        if (isListening && recording) {
          try {
            recognition.start();
            console.log("VoiceRecorder: Recognition restarted");
          } catch (error) {
            console.error("VoiceRecorder: Failed to restart recognition", error);
          }
        } else {
          cleanupAudio();
          setRecording(false);
        }
      };
      
      // Handle errors
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("VoiceRecorder: Recognition error:", event.error);
        
        // If "no-speech" error, we don't need to show it to the user
        if (event.error !== 'no-speech') {
          setError(`Speech recognition error: ${event.error}`);
          
          // For network errors or permission errors, switch to fallback
          if (event.error === 'network' || event.error === 'not-allowed') {
            setUseFallbackRecorder(true);
            startMediaRecording();
            return;
          }
        }
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
  }, [autoStopAfterSilence, isListening, onTranscription, transcript, setupAudioVisualization, cleanupAudio, startMediaRecording, recording]);
  
  // Handle changes to the isListening prop
  useEffect(() => {
    console.log("VoiceRecorder: isListening changed to", isListening);
    
    if (isListening && !recording) {
      if (useFallbackRecorder) {
        startMediaRecording();
      } else {
        startRecognition();
      }
    } else if (!isListening && recording) {
      stopRecognition();
    }
  }, [isListening, useFallbackRecorder, startRecognition, startMediaRecording, stopRecognition, recording]); 
  
  // Enhanced UI with audio visualization and test playback
  return (
    <div className={recording || error || testAudioUrl ? "block" : "hidden"}>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <div className="flex flex-col items-center justify-center">
        <div className="flex items-center justify-center mb-2">
          <div className={`w-4 h-4 rounded-full ${recording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="ml-2 text-sm text-gray-300">
            {recording ? 'Recording voice...' : 'Voice recorder ready'}
          </span>
        </div>
        
        {/* Audio level visualization */}
        {recording && (
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
            <div 
              className="h-full bg-red-500 transition-all duration-100"
              style={{ width: `${audioLevel}%` }}
            ></div>
          </div>
        )}
        
        {/* Test audio playback - helps users verify their mic is working */}
        {testAudioUrl && !recording && (
          <div className="mt-2 mb-2 text-center">
            <audio ref={audioTestRef} src={testAudioUrl} controls className="w-full max-w-[200px] h-8" />
            <p className="text-xs text-gray-400 mt-1">Recorded audio preview</p>
          </div>
        )}
        
        {transcript && (
          <p className="text-xs text-gray-400 max-w-full overflow-hidden mb-2">{transcript}</p>
        )}
      </div>
    </div>
  );
}