"use client";

import { useState, useRef, useEffect } from 'react';
import AudioPlayer from './components/AudioPlayer';
import VoiceRecorder from './components/VoiceRecorder';

interface Question {
  question: string;
  category: string;
  difficulty?: string;
}

interface FeedbackResponse {
  feedback: string;
  strengths: string[];
  improvements: string[];
  score: number;
  follow_up: string;
  follow_up_question?: string;
  follow_up_category?: string;
}

interface ConversationMessage {
  role: 'interviewer' | 'candidate' | 'feedback';
  content: string;
  question?: Question;
  feedback?: FeedbackResponse;
  summarizedContent?: string;
  needsAudioPlay?: boolean;
  messageId?: string;
  timestamp?: number;
}

// Interview mode type
type InterviewMode = 'technical' | 'behavioral';

export default function Home() {
  const [jobDescription, setJobDescription] = useState('');
  const [company, setCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listeningForVoice, setListeningForVoice] = useState(false);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('technical');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const lastAudioMessageIdRef = useRef<number | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  // Handle changes to the conversation array and trigger audio playback for the newest messages
  useEffect(() => {
    console.log("Conversation updated:", conversation.length, "messages");
    
    // Auto-play audio for messages that need it if not already playing
    if (conversation.length > 0 && !isSpeaking) {
      // Find the last message that needs audio playback
      let foundAudioMessage = false;
      
      // Search from the most recent message backwards
      for (let i = conversation.length - 1; i >= 0; i--) {
        if (conversation[i].needsAudioPlay) {
          console.log("Found message needing audio playback:", i);
          lastAudioMessageIdRef.current = i;
          foundAudioMessage = true;
          break;
        }
      }
      
      // If no message is already set to play and we found one, set it
      if (!foundAudioMessage) {
        console.log("No messages need audio playback");
      }
    }
    
    // Scroll to bottom
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, isSpeaking]);

  // Helper function to safely add messages to conversation with deduplication
  const addMessageToConversation = (message: ConversationMessage) => {
    // Generate a unique ID for the message if not provided
    const messageId = message.messageId || 
      `${message.role}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Add timestamp if not present
    const timestamp = message.timestamp || Date.now();
    
    // Create the complete message
    const completeMessage = {
      ...message,
      messageId,
      timestamp
    };
    
    // Check if we've already processed this exact message
    if (lastMessageId === messageId) {
      console.log(`Duplicate message detected and skipped: ${messageId}`);
      return;
    }
    
    // Add the message to conversation
    setConversation(prev => {
      // Check for existing identical message to prevent duplicates
      const messageExists = prev.some(
        m => m.messageId === messageId || 
           (m.role === message.role && 
            m.content === message.content)
      );
      
      if (messageExists) {
        console.log(`Message already exists in conversation, skipping: ${messageId}`);
        return prev;
      }
      
      // Add the new message
      const newConversation = [...prev, completeMessage];
      
      // Sort by timestamp to ensure proper ordering
      return newConversation.sort((a, b) => 
        (a.timestamp || 0) - (b.timestamp || 0)
      );
    });
    
    // Update the latest message ID
    setLastMessageId(messageId);
  };

  const handleStartInterview = async () => {
    if (!jobDescription || !company) {
      setError('Please enter both job description and company name');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setConversation([]);
    lastAudioMessageIdRef.current = null; // Reset any audio playback state
    setLastMessageId(null); // Reset the last message ID tracker
    
    try {
      // Prime audio for Safari - creates a silent audio context on user interaction
      const AudioContextClass = window.AudioContext || 
        ((window as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext);
      
      if (AudioContextClass) {
        const audioContext = new AudioContextClass();
        const silentBuffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(audioContext.destination);
        source.start();
        console.log("Audio context primed for Safari");
      }
      
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company,
          jobDescription,
          interviewMode,
          initialQuestionsOnly: true // Signal that we only need 1-2 starter questions
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setCurrentQuestionIndex(0);
        
        // Create a more conversational welcome message with adaptive interview explanation
        const welcomeMessage = `Welcome to your ${interviewMode} interview preparation for ${company}. I'll adapt my questions based on your answers to create a natural conversation, just like in a real interview. This will help you improve your interviewing skills for the ${company} position. Let's start with the first question.`;
        const summarizedWelcome = `Welcome to your ${interviewMode} interview with ${company}. This interview will adapt to your responses. Let's begin.`;
        
        console.log("Starting interview with initial messages");
        
        // First add just the welcome message with proper ID and timestamp
        const welcomeMessageId = `interviewer-welcome-${Date.now()}`;
        addMessageToConversation({
          role: 'interviewer',
          content: welcomeMessage,
          summarizedContent: summarizedWelcome,
          needsAudioPlay: true,
          messageId: welcomeMessageId,
          timestamp: Date.now()
        });
        
        // Start the interview
        setStarted(true);
        
        // Add the first question after a brief delay to allow the welcome message to be processed
        setTimeout(() => {
          const firstQuestionMessageId = `interviewer-question-0-${Date.now()}`;
          const firstQuestionTimestamp = Date.now() + 500; // Ensure it appears after welcome
          
          addMessageToConversation({
            role: 'interviewer',
            content: data.questions[0].question,
            question: data.questions[0],
            summarizedContent: data.questions[0].question,
            needsAudioPlay: true,
            messageId: firstQuestionMessageId,
            timestamp: firstQuestionTimestamp
          });
          
          console.log("Added first question with ID:", firstQuestionMessageId);
        }, 500);
      } else {
        setError('Failed to generate interview questions. Please try again.');
      }
    } catch (error) {
      console.error('Error starting interview:', error);
      setError('Failed to start interview. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update how summarized feedback is created to be more concise
  // Create a shorter, more concise version of the feedback for speech
  const createSummarizedFeedback = (feedback: FeedbackResponse) => {
    const score = feedback.score;
    const strength = feedback.strengths[0] || '';
    const improvement = feedback.improvements[0] || '';
    
    // Keep it very concise for better audio playback
    return `${score >= 4 ? 'Good answer! ' : 'Thanks. '}${strength.split('.')[0]}. ${improvement.split('.')[0]}. Score: ${score}/5.`;
  };

  // Update handleSubmitAnswer to use the concise feedback summary and directly play audio
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      setError('Please provide an answer before submitting');
      return;
    }

    // Save the current answer before clearing it to prevent double submission
    const currentAnswer = userAnswer;
    
    // Generate a unique message ID for this submission
    const candidateMessageId = `candidate-${Date.now()}`;
    
    // Clear the answer immediately to prevent duplicate submissions
    setUserAnswer('');
    setIsSubmittingAnswer(true);
    setError(null);

    // Add user's answer to conversation using the safe method
    addMessageToConversation({
      role: 'candidate',
      content: currentAnswer,
      messageId: candidateMessageId,
      timestamp: Date.now()
    });

    try {
      // Get the current question if available
      const currentQuestion = currentQuestionIndex < questions.length 
        ? questions[currentQuestionIndex] 
        : null;
      
      // Log the current state for debugging
      console.log(`Submitting answer for question ${currentQuestionIndex}, company: ${company}`);
      
      // Prepare conversation history for the API
      const conversationHistory = conversation
        .map(msg => ({
          role: msg.role === 'candidate' ? 'user' : 'assistant',
          content: msg.content
        }))
        .slice(-6); // Include last 6 messages for context
      
      // Add current answer to history to avoid duplicates
      if (!conversationHistory.some(msg => msg.content === currentAnswer)) {
        conversationHistory.push({
          role: 'user',
          content: currentAnswer
        });
      }
      
      // Get feedback on the answer and generate a dynamic follow-up question
      const feedbackResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAnswer: currentAnswer,
          question: currentQuestion?.question || "Tell me about yourself",
          category: currentQuestion?.category || "General",
          difficulty: currentQuestion?.difficulty || "Medium",
          company,
          interviewMode,
          conversationHistory,
          generateFollowUp: true // Signal that we want a dynamic follow-up question
        }),
      });

      if (!feedbackResponse.ok) {
        throw new Error('Failed to get feedback on answer');
      }

      const feedback = await feedbackResponse.json();
      console.log("Received feedback response:", feedback);

      // Create a concise summarized version of the feedback for speech
      const summarizedFeedback = createSummarizedFeedback(feedback);
      console.log("Summarized feedback for audio:", summarizedFeedback);

      // Create a unique ID for this feedback message
      const feedbackMessageId = `feedback-${Date.now()}`;
      const feedbackTimestamp = Date.now() + 100; // Add small offset for ordering
      
      // Add feedback to conversation
      addMessageToConversation({
        role: 'feedback',
        content: feedback.feedback,
        feedback: feedback,
        summarizedContent: summarizedFeedback,
        needsAudioPlay: true,
        messageId: feedbackMessageId,
        timestamp: feedbackTimestamp
      });
      
      console.log("Added feedback with ID:", feedbackMessageId);
      
      // *** Force audio playback for feedback immediately ***
      // Wait a moment for the conversation state to update
      setTimeout(() => {
        // Find the index of the feedback message to play
        const feedbackIndex = conversation.findIndex(msg => msg.messageId === feedbackMessageId);
        if (feedbackIndex !== -1) {
          console.log("Directly playing feedback audio at index:", feedbackIndex);
          // Force playing this message directly
          lastAudioMessageIdRef.current = feedbackIndex;
          // Stop any current playback
          setIsSpeaking(false);
        } else {
          console.warn("Could not find feedback message to play audio for:", feedbackMessageId);
        }
      }, 500);
      
      // Check if we have a follow-up question from the API
      if (feedback.follow_up_question) {
        // Increment question counter
        setCurrentQuestionIndex(prevIndex => prevIndex + 1);
        
        // Set timeout to add the follow-up question after feedback is processed
        setTimeout(() => {
          // Add the dynamic follow-up question to conversation with proper sequencing
          const followUpMessageId = `interviewer-follow-up-${Date.now()}`;
          const followUpTimestamp = Date.now() + 1000; // Ensure it appears after feedback
          
          addMessageToConversation({
            role: 'interviewer',
            content: feedback.follow_up_question,
            question: {
              question: feedback.follow_up_question,
              category: feedback.follow_up_category || currentQuestion?.category || "Follow-up",
              difficulty: currentQuestion?.difficulty || "Medium"
            },
            summarizedContent: feedback.follow_up_question,
            needsAudioPlay: true,
            messageId: followUpMessageId,
            timestamp: followUpTimestamp
          });
          
          console.log("Added follow-up question with ID:", followUpMessageId);
        }, 1500); // Longer delay for better conversation flow
      } else if (currentQuestionIndex >= questions.length - 1) {
        // Interview completed
        setTimeout(() => {
          const concludingMessage = "That concludes our interview. Thank you for your thoughtful responses. I hope this practice helps you in your actual interview with " + company + ".";
          
          const concludingMessageId = `interviewer-conclusion-${Date.now()}`;
          const concludingTimestamp = Date.now() + 1500; // Ensure it appears after other messages
          
          addMessageToConversation({
            role: 'interviewer',
            content: concludingMessage,
            summarizedContent: "That's all for today. Thanks for participating in this interview simulation.",
            needsAudioPlay: true,
            messageId: concludingMessageId,
            timestamp: concludingTimestamp
          });
          
          console.log("Added concluding message with ID:", concludingMessageId);
        }, 2000);
      }
      
      // Answer has already been cleared at the beginning of this function
      // to prevent duplicate submissions
    } catch (error) {
      console.error('Error submitting answer:', error);
      setError('Failed to submit answer. Please try again.');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Request microphone permission before starting recording
  const handleVoiceButtonClick = async () => {
    // If already recording, stop it and reset error state
    if (listeningForVoice) {
      console.log("Stopping voice recording");
      setListeningForVoice(false);
      // Reset any error state that might have been set
      setError(null);
      return;
    }
    
    // Don't activate recording if AI is currently speaking
    if (isSpeaking) {
      setError("Please wait for the interviewer to finish speaking.");
      return;
    }
    
    // Also reset error state when starting recording
    setError(null);

    try {
      // Check if we already have permission
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setMicPermissionState(permissionStatus.state);
      
      // If permission is denied, show a message
      if (permissionStatus.state === 'denied') {
        setError('Microphone permission is required for voice recording. Please enable it in your browser settings.');
        return;
      }
      
      // Try to access the microphone to trigger the permission prompt
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // If we reach here, permission was granted
      setMicPermissionState('granted');
      console.log("Voice recording activated");
      setListeningForVoice(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Failed to access microphone. Please check your browser permissions.');
    }
  };

  // Also update handleVoiceInput with the same pattern for feedback audio
  const handleVoiceInput = (transcript: string) => {
    console.log("Received voice transcript:", transcript);
    
    // Stop recording immediately to prevent double submissions
    setListeningForVoice(false);
    
    if (transcript.trim()) {
      // Set answer in state
      setUserAnswer(transcript);
      
      // Generate a unique message ID for this voice input
      const voiceMessageId = `candidate-voice-${Date.now()}`;
      
      // Add user's voice answer to conversation with deduplication
      addMessageToConversation({
        role: 'candidate',
        content: transcript,
        messageId: voiceMessageId,
        timestamp: Date.now()
      });
      
      // Use the transcript directly rather than relying on the state update
      const submitAnswer = async (answerText: string) => {
        if (!answerText.trim()) return;
        
        console.log("Submitting voice answer to OpenAI:", answerText);
        setIsSubmittingAnswer(true);
        setError(null);
        
        try {
          // Get the current question if available
          const currentQuestion = currentQuestionIndex < questions.length 
            ? questions[currentQuestionIndex] 
            : null;
          
          // Prepare conversation history for the API
          const conversationHistory = conversation
            .map(msg => ({
              role: msg.role === 'candidate' ? 'user' : 'assistant',
              content: msg.content
            }))
            .slice(-6); // Include last 6 messages for context
          
          // Add current answer to history to avoid duplicates
          if (!conversationHistory.some(msg => msg.content === answerText)) {
            conversationHistory.push({
              role: 'user',
              content: answerText
            });
          }
          
          // Get feedback on the answer and generate a dynamic follow-up question
          const feedbackResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userAnswer: answerText,
              question: currentQuestion?.question || "Tell me about yourself",
              category: currentQuestion?.category || "General",
              difficulty: currentQuestion?.difficulty || "Medium",
              company,
              interviewMode,
              conversationHistory,
              generateFollowUp: true
            }),
          });

          if (!feedbackResponse.ok) {
            throw new Error('Failed to get feedback on answer');
          }

          const feedback = await feedbackResponse.json();
          console.log("Voice input: Received feedback response:", feedback);

          // Create a more concise summarized version of the feedback for speech
          const summarizedFeedback = createSummarizedFeedback(feedback);
          console.log("Voice input: Summarized feedback for audio:", summarizedFeedback);

          // Add feedback to conversation with unique ID and timestamp
          const feedbackMessageId = `feedback-voice-${Date.now()}`;
          const feedbackTimestamp = Date.now() + 100; // Add small offset for ordering
          
          addMessageToConversation({
            role: 'feedback',
            content: feedback.feedback,
            feedback: feedback,
            summarizedContent: summarizedFeedback,
            needsAudioPlay: true,
            messageId: feedbackMessageId,
            timestamp: feedbackTimestamp
          });
          
          console.log("Voice input: Added feedback with ID:", feedbackMessageId);
          
          // *** Force feedback audio playback directly ***
          setTimeout(() => {
            // Find the index of the feedback message to play
            const feedbackIndex = conversation.findIndex(msg => msg.messageId === feedbackMessageId);
            if (feedbackIndex !== -1) {
              console.log("Voice input: Directly playing feedback audio at index:", feedbackIndex);
              // Force playing this message directly
              lastAudioMessageIdRef.current = feedbackIndex;
              // Stop any current playback
              setIsSpeaking(false);
            } else {
              console.warn("Voice input: Could not find feedback message to play audio for:", feedbackMessageId);
            }
          }, 500);
          
          // Check if we have a follow-up question from the API
          if (feedback.follow_up_question) {
            // Increment question counter
            setCurrentQuestionIndex(prevIndex => prevIndex + 1);
            
            // Set timeout to add the follow-up question after feedback is processed
            setTimeout(() => {
              // Add the dynamic follow-up question to conversation
              const followUpMessageId = `interviewer-follow-up-voice-${Date.now()}`;
              const followUpTimestamp = Date.now() + 1000; // Ensure it appears after feedback
              
              addMessageToConversation({
                role: 'interviewer',
                content: feedback.follow_up_question,
                question: {
                  question: feedback.follow_up_question,
                  category: feedback.follow_up_category || currentQuestion?.category || "Follow-up",
                  difficulty: currentQuestion?.difficulty || "Medium"
                },
                summarizedContent: feedback.follow_up_question,
                needsAudioPlay: true,
                messageId: followUpMessageId,
                timestamp: followUpTimestamp
              });
              
              console.log("Voice input: Added follow-up question with ID:", followUpMessageId);
            }, 1500); // Longer delay for better conversation flow
          } else if (currentQuestionIndex >= questions.length - 1) {
            // Interview completed
            setTimeout(() => {
              const concludingMessage = "That concludes our interview. Thank you for your thoughtful responses. I hope this practice helps you in your actual interview with " + company + ".";
              
              const concludingMessageId = `interviewer-conclusion-voice-${Date.now()}`;
              const concludingTimestamp = Date.now() + 1500; // Ensure it appears after other messages
              
              addMessageToConversation({
                role: 'interviewer',
                content: concludingMessage,
                summarizedContent: "That's all for today. Thanks for participating in this interview simulation.",
                needsAudioPlay: true,
                messageId: concludingMessageId,
                timestamp: concludingTimestamp
              });
              
              console.log("Voice input: Added concluding message with ID:", concludingMessageId);
            }, 2000);
          }

          // Clear the answer
          setUserAnswer('');
        } catch (error) {
          console.error('Error submitting answer:', error);
          setError('Failed to submit answer. Please try again.');
        } finally {
          setIsSubmittingAnswer(false);
        }
      };
      
      // Process the transcript immediately
      submitAnswer(transcript);
    }
  };

  const handleRestart = () => {
    setStarted(false);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswer('');
    setConversation([]);
    setError(null);
    lastAudioMessageIdRef.current = null;
  };

  // Handle audio playback started and ended
  const handleAudioPlaybackStarted = () => {
    setIsSpeaking(true);
  };

  const handleAudioPlaybackEnded = () => {
    const currentAudioIndex = lastAudioMessageIdRef.current;
    console.log(`Audio playback ended for message ${currentAudioIndex}, message type: ${currentAudioIndex !== null ? conversation[currentAudioIndex]?.role : 'none'}`);
    setIsSpeaking(false);
    
    // Clear the current message that just finished playing
    lastAudioMessageIdRef.current = null;
    
    // Wait a moment before processing next playback to ensure state updates
    setTimeout(() => {
      // Check if there are any messages that need audio playback
      if (conversation.length > 0) {
        // Get the timestamp of the current message
        const currentMessageTime = currentAudioIndex !== null && conversation[currentAudioIndex] 
          ? conversation[currentAudioIndex].timestamp || 0 
          : 0;
        
        // Find the next message in sequence that needs audio playback
        // We prioritize messages that come after the current one in the conversation
        let nextMessageIndex = -1;
        let earliestTimestamp = Number.MAX_SAFE_INTEGER;
        
        for (let i = 0; i < conversation.length; i++) {
          const msg = conversation[i];
          const msgTimestamp = msg.timestamp || 0;
          
          if (msg.needsAudioPlay) {
            // If this message comes after the current one and is earlier than any we've found so far
            if (msgTimestamp > currentMessageTime && msgTimestamp < earliestTimestamp) {
              nextMessageIndex = i;
              earliestTimestamp = msgTimestamp;
            }
          }
        }
        
        // If no "next" message, look for any message that needs audio
        if (nextMessageIndex === -1) {
          for (let i = 0; i < conversation.length; i++) {
            if (conversation[i].needsAudioPlay) {
              nextMessageIndex = i;
              break;
            }
          }
        }
        
        if (nextMessageIndex !== -1) {
          console.log(`Found message ${nextMessageIndex} that needs audio playback next`);
          lastAudioMessageIdRef.current = nextMessageIndex;
          return;
        }
      }
      
      console.log("No more messages need audio playback");
    }, 300);
  };

  // Use effect to check microphone permission on component mount
  useEffect(() => {
    // Function to check microphone permission status
    const checkMicrophonePermission = async () => {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicPermissionState(permissionStatus.state);
        
        // Listen for permission changes
        permissionStatus.onchange = () => {
          setMicPermissionState(permissionStatus.state);
        };
      } catch (err) {
        console.error('Error checking microphone permission:', err);
        // If can't check permission status, we'll assume unknown
        setMicPermissionState('unknown');
      }
    };
    
    // Prime audio for Safari - creates a silent audio context on component mount
    const primeAudioForSafari = () => {
      try {
        const AudioContextClass = window.AudioContext || 
          ((window as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext);
        
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();
          const silentBuffer = audioContext.createBuffer(1, 1, 22050);
          const source = audioContext.createBufferSource();
          source.buffer = silentBuffer;
          source.connect(audioContext.destination);
          source.start();
          console.log("Audio context primed for Safari on component mount");
        }
      } catch (err) {
        console.error('Error priming audio context:', err);
      }
    };
    
    checkMicrophonePermission();
    primeAudioForSafari();
  }, []);

  // Monitor conversation changes to ensure audio playback 
  useEffect(() => {
    console.log("Conversation changed, checking for pending audio messages");
    
    // If no message is currently playing audio and there's no current audio index
    if (!isSpeaking && lastAudioMessageIdRef.current === null && conversation.length > 0) {
      // First check for any feedback messages that need audio playback
      // We prioritize feedback messages since those might be getting missed
      for (let i = conversation.length - 1; i >= 0; i--) {
        if (conversation[i].role === 'feedback' && conversation[i].needsAudioPlay) {
          console.log(`Found feedback message ${i} that needs audio playback:`, 
            conversation[i].content.substring(0, 30) + "...");
          
          // Trigger audio playback with a small delay
          setTimeout(() => {
            console.log(`Setting lastAudioMessageIdRef to ${i} (feedback message)`);
            lastAudioMessageIdRef.current = i;
          }, 500);
          
          return; // Exit after finding first message to play
        }
      }
      
      // If no feedback messages need playing, check any message type
      for (let i = 0; i < conversation.length; i++) {
        if (conversation[i].needsAudioPlay) {
          console.log(`Found message ${i} that needs audio playback:`, 
            conversation[i].role, 
            conversation[i].content.substring(0, 30) + "...");
          
          // Trigger audio playback with a small delay
          setTimeout(() => {
            console.log(`Setting lastAudioMessageIdRef to ${i}`);
            lastAudioMessageIdRef.current = i;
          }, 500);
          
          break;
        }
      }
    }
    
    // Debug log the current conversation state with audio needs
    const audioMessages = conversation
      .map((msg, idx) => ({ index: idx, role: msg.role, needsAudio: !!msg.needsAudioPlay }))
      .filter(m => m.needsAudio);
    
    if (audioMessages.length > 0) {
      console.log("Messages needing audio playback:", audioMessages);
    }
  }, [conversation, isSpeaking]);

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center mt-8 mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">AI-pplicant</h1>
        <h2 className="text-xl md:text-2xl text-center mb-8 text-gray-300">Interview Simulator</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 text-red-300 rounded-md border border-red-500/20">
            <p>{error}</p>
          </div>
        )}
        
        {!started ? (
          <div className="bg-gray-800/50 p-6 rounded-xl shadow-xl backdrop-blur-sm border border-gray-700/50 w-full max-w-2xl mx-auto">
            <div className="mb-6">
              <label htmlFor="company" className="block text-sm font-medium mb-2 text-gray-300">
                Company Name
              </label>
              <input
                type="text"
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full p-3 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900/70 text-white"
                placeholder="Enter company name (e.g., Google, Amazon, Microsoft)"
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="jobDescription" className="block text-sm font-medium mb-2 text-gray-300">
                Job Description
              </label>
              <textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full p-3 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900/70 text-white"
                rows={6}
                placeholder="Paste the job description here (include technical requirements, responsibilities, etc.)"
              />
            </div>

            {/* Interview Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Interview Type
              </label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setInterviewMode('technical')}
                  className={`flex-1 py-3 px-4 rounded-lg transition-colors ${
                    interviewMode === 'technical' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Technical
                  </div>
                </button>
                <button
                  onClick={() => setInterviewMode('behavioral')}
                  className={`flex-1 py-3 px-4 rounded-lg transition-colors ${
                    interviewMode === 'behavioral' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.35-.041-.69-.101-1.021A5 5 0 0010 11z" clipRule="evenodd" />
                    </svg>
                    Behavioral
                  </div>
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {interviewMode === 'technical' 
                  ? 'Focus on coding, algorithms, and technical knowledge' 
                  : 'Focus on soft skills, experience, and situational questions'}
              </p>
            </div>
            
            <button
              onClick={handleStartInterview}
              disabled={isLoading || !company || !jobDescription}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-150 ease-in-out disabled:opacity-50 shadow-lg"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  <span>Preparing Interview...</span>
                </div>
              ) : (
                `Start ${interviewMode === 'technical' ? 'Technical' : 'Behavioral'} Interview`
              )}
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col md:flex-row gap-4">
            {/* Interviewer avatar section */}
            <div className="w-full md:w-1/3 mb-4 md:mb-0">
              <div className="sticky top-4 bg-gray-800/30 p-4 rounded-xl border border-gray-700/50 shadow-lg backdrop-blur-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-medium text-blue-400">
                    {company} Interviewer
                  </h3>
                  <button 
                    onClick={handleRestart}
                    className="py-1 px-3 bg-gray-700 hover:bg-gray-600 text-sm text-white rounded-md transition"
                  >
                    Restart
                  </button>
                </div>
                
                {/* Interview mode indicator */}
                <div className="mb-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                    interviewMode === 'technical' ? 'bg-blue-600/30 text-blue-300' : 'bg-indigo-600/30 text-indigo-300'
                  }`}>
                    {interviewMode === 'technical' ? 'Technical Interview' : 'Behavioral Interview'}
                  </span>
                </div>
                
                {/* Interview progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{currentQuestionIndex + 1}/{questions.length} Questions</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${((currentQuestionIndex) / (questions.length)) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Animated interviewer image */}
                <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-b from-gray-700 to-gray-900 mb-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Interactive animated avatar instead of unreliable GIFs */}
                    <div className={`w-4/5 h-4/5 ${isSpeaking ? 'animate-subtle-bounce' : ''}`}>
                      <svg viewBox="0 0 200 200" className="w-full h-full">
                        {/* Background gradient */}
                        <defs>
                          <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={interviewMode === 'technical' ? '#3b82f6' : '#6366f1'} stopOpacity="0.6" />
                            <stop offset="100%" stopColor={interviewMode === 'technical' ? '#1e40af' : '#4338ca'} stopOpacity="0.9" />
                          </linearGradient>
                          <clipPath id="avatarClip">
                            <circle cx="100" cy="85" r="70" />
                          </clipPath>
                        </defs>
                        
                        {/* Background circle with subtle pulse animation */}
                        <circle cx="100" cy="85" r="70" fill="url(#avatarGradient)" className="animate-pulse" />
                        
                        {/* Head shape */}
                        <circle cx="100" cy="70" r="45" fill="#f8fafc" />
                        
                        {/* Eyes with blink animation */}
                        <g className={isSpeaking ? 'animate-blink' : ''}>
                          <circle cx="80" cy="65" r="6" fill="#1e293b" />
                          <circle cx="120" cy="65" r="6" fill="#1e293b" />
                        </g>
                        
                        {/* Eyebrows - raise when speaking */}
                        <g transform={isSpeaking ? 'translate(0, -2)' : 'translate(0, 0)'} 
                           className="transition-transform duration-300">
                          <path d="M70,55 Q80,50 90,55" stroke="#1e293b" strokeWidth="2" fill="transparent" />
                          <path d="M110,55 Q120,50 130,55" stroke="#1e293b" strokeWidth="2" fill="transparent" />
                        </g>
                        
                        {/* Mouth - animates when speaking */}
                        <g className={isSpeaking ? 'animate-talk' : ''}>
                          <path 
                            d={isSpeaking ? 'M75,95 Q100,110 125,95' : 'M75,95 Q100,95 125,95'} 
                            stroke="#1e293b" 
                            strokeWidth="3" 
                            fill="transparent"
                            transform-origin="center"
                          />
                        </g>
                        
                        {/* Suit/clothes */}
                        <path d="M55,135 L100,160 L145,135 V180 H55 Z" fill={interviewMode === 'technical' ? '#1d4ed8' : '#4f46e5'} />
                        <rect x="85" y="115" width="30" height="40" fill="white" />
                        <rect x="97" y="115" width="6" height="40" fill={interviewMode === 'technical' ? '#1d4ed8' : '#4f46e5'} />
                        
                        {/* Company badge */}
                        <g transform="translate(80, 125)">
                          <rect x="0" y="0" width="40" height="15" rx="3" fill="white" stroke="#64748b" strokeWidth="1" />
                          <text x="5" y="11" fontSize="9" fill="#334155" className="font-semibold">{company ? company.substring(0, 8) : 'AI'}</text>
                        </g>
                        
                        {/* Status indicator light */}
                        <circle 
                          cx="165" 
                          cy="30" 
                          r="8" 
                          fill={isSpeaking ? "#10b981" : "#6b7280"} 
                          className={isSpeaking ? "animate-pulse" : ""}
                        />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Speaking indicator */}
                  {isSpeaking && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                        Speaking...
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Current question info */}
                {currentQuestionIndex < questions.length && (
                  <div className="bg-gray-900/50 p-3 rounded-lg text-sm mb-4">
                    <div className="text-gray-400 mb-1">Current Question:</div>
                    <div className="font-medium">
                      {questions[currentQuestionIndex].category} 
                      {questions[currentQuestionIndex].difficulty && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded-md text-xs">
                          {questions[currentQuestionIndex].difficulty}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Voice control */}
                <button 
                  onClick={handleVoiceButtonClick}
                  className={`w-full flex items-center justify-center py-3 px-4 rounded-lg transition duration-150 ease-in-out shadow-lg ${
                    listeningForVoice 
                      ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                      : isSpeaking
                        ? 'bg-gray-600 cursor-not-allowed'
                        : micPermissionState === 'denied'
                          ? 'bg-gray-600'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  disabled={micPermissionState === 'denied' || isSpeaking}
                >
                  {listeningForVoice ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                      </svg>
                      Stop Recording
                    </>
                  ) : isSpeaking ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                      Please wait...
                    </>
                  ) : micPermissionState === 'denied' ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                        <line x1="12" x2="12" y1="19" y2="23" />
                        <line x1="8" x2="16" y1="23" y2="23" />
                      </svg>
                      Microphone Access Denied
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                      Start Speaking
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Conversation thread */}
            <div className="w-full md:w-2/3">
              <div className="bg-gray-800/20 rounded-xl shadow-lg p-4 mb-4 min-h-[60vh] max-h-[80vh] overflow-y-auto backdrop-blur-sm border border-gray-700/50">
                {conversation.map((message, index) => (
                  <div key={index} className={`mb-6`}>
                    {message.role === 'interviewer' && (
                      <div className="flex space-x-3 items-start">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">I</span>
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-700/40 p-3 rounded-lg rounded-tl-none">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-blue-300">
                                Interviewer {message.question && `(${message.question.category}${message.question.difficulty ? `, ${message.question.difficulty}` : ''})`}
                              </span>
                            </div>
                            <p className="text-white">{message.content}</p>
                            
                            {index === lastAudioMessageIdRef.current && (
                              <>
                                <div className="text-xs text-blue-300 mb-1">Playing interviewer audio...</div>
                                <AudioPlayer 
                                  text={message.summarizedContent || message.content}
                                  messageId={index}
                                  autoPlay={true}
                                  hideControls={true}
                                  onPlaybackStart={handleAudioPlaybackStarted}
                                  onPlaybackEnd={handleAudioPlaybackEnded}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {message.role === 'candidate' && (
                      <div className="flex space-x-3 items-start justify-end">
                        <div className="flex-1">
                          <div className="bg-blue-900/30 p-3 rounded-lg rounded-tr-none border border-blue-700/30">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-blue-300">You</span>
                            </div>
                            <p>{message.content}</p>
                          </div>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">Y</span>
                        </div>
                      </div>
                    )}
                    
                    {message.role === 'feedback' && message.feedback && (
                      <div className="flex space-x-3 items-start">
                        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">F</span>
                        </div>
                        <div className="flex-1">
                          <div className="bg-indigo-900/20 p-3 rounded-lg rounded-tl-none border border-indigo-800/20">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-indigo-300">Feedback</span>
                              <span className="px-2 py-0.5 bg-indigo-700/70 rounded-md text-xs ml-2">
                                Score: {message.feedback.score}/5
                              </span>
                            </div>
                            <p className="mb-2">{message.feedback.feedback}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <div>
                                <h4 className="text-sm font-medium mb-1 text-green-300">Strengths:</h4>
                                <ul className="list-disc pl-5 text-sm text-gray-200">
                                  {message.feedback.strengths.map((strength, idx) => (
                                    <li key={idx}>{strength}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium mb-1 text-yellow-300">Areas for Improvement:</h4>
                                <ul className="list-disc pl-5 text-sm text-gray-200">
                                  {message.feedback.improvements.map((improvement, idx) => (
                                    <li key={idx}>{improvement}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            
                            {message.feedback.follow_up && (
                              <div className="mt-3 pt-2 border-t border-indigo-700/30">
                                <p className="text-sm italic">
                                  <span className="font-semibold">Follow-up question:</span> {message.feedback.follow_up}
                                </p>
                              </div>
                            )}
                            
                            {index === lastAudioMessageIdRef.current && (
                              <>
                                <div className="text-xs text-indigo-300 mt-3 mb-1">Playing feedback audio...</div>
                                <AudioPlayer 
                                  text={message.summarizedContent || message.feedback.feedback}
                                  messageId={index}
                                  autoPlay={true}
                                  hideControls={true}
                                  onPlaybackStart={handleAudioPlaybackStarted}
                                  onPlaybackEnd={handleAudioPlaybackEnded}
                                  isFeedback={true}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={conversationEndRef} />
                
                {/* Voice recording indicator */}
                {listeningForVoice && (
                  <div className="fixed bottom-4 right-4 bg-red-600 py-2 px-4 rounded-full shadow-lg text-white animate-pulse">
                    <div className="flex items-center">
                      <div className="mr-2 w-2 h-2 bg-white rounded-full animate-ping"></div>
                      Recording...
                    </div>
                  </div>
                )}
              </div>
              
              {/* Hidden recorder component */}
              <div className={listeningForVoice ? "block" : "hidden"}>
                <VoiceRecorder 
                  onTranscription={handleVoiceInput} 
                  isListening={listeningForVoice}
                  autoStopAfterSilence={false} // Never auto-stop
                />
              </div>
              
              {/* Text input fallback */}
              {!listeningForVoice && currentQuestionIndex < questions.length && (
                <div className="bg-gray-800/30 p-4 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm">
                  <h3 className="text-lg font-medium mb-2 text-white">Your Answer</h3>
                  <p className="text-sm text-gray-300 mb-4">
                    {isSpeaking ? 
                      "Please wait for the interviewer to finish speaking..." : 
                      "Type your answer below or click 'Start Speaking' to use voice input."
                    }
                  </p>
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="w-full p-3 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900/70 text-white"
                    rows={5}
                    placeholder="Type your answer here..."
                    disabled={isSpeaking}
                  />
                  
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={isSubmittingAnswer || !userAnswer.trim() || isSpeaking}
                      className="py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 shadow-lg"
                    >
                      {isSubmittingAnswer ? 'Submitting...' : 'Submit Answer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}