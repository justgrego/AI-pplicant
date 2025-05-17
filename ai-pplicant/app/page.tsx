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

// Add this function near the top of the file to check if using Safari
const isSafari = typeof navigator !== 'undefined' ? 
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent) : false;

// Update the primeSafariAudioContext function to be more robust
const primeSafariAudioContext = () => {
  try {
    // Check if this is Safari
    if (isSafari) {
      console.log("Priming Safari audio context");
      const AudioContextClass = window.AudioContext || 
        ((window as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext);
      
      if (AudioContextClass) {
        // Create a shared audio context that's always active
        const audioCtx = new AudioContextClass();
        
        // For Safari, we need to create an actual sound
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.01; // Very low volume
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(0);
        oscillator.stop(0.1); // Very short duration
        
        // Resume audio context if it's suspended
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        
        // Create a user gesture simulation by a tiny interaction
        document.addEventListener('DOMContentLoaded', function() {
          document.body.click();
        });
        
        console.log("Safari audio context primed successfully", audioCtx.state);
        return audioCtx;
      }
    }
    return null;
  } catch (err) {
    console.error('Failed to prime Safari audio context:', err);
    return null;
  }
};

// Add the constant for the voice ID at the top level
const VOICE_ID = 'aEO01A4wXwd1O8GPgGlF';

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
  const [processingFeedback, setProcessingFeedback] = useState(false);
  const totalQuestions = 10; // Fixed number of questions for the progress bar

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

  // Create a simpler, more direct feedback formatter that preserves improvement suggestions
  const createAudioFriendlyFeedback = (feedback: FeedbackResponse) => {
    // Extract core content from feedback
    const score = feedback.score;
    const strengths = feedback.strengths[0] || '';
    const improvement = feedback.improvements[0] || '';
    
    // Direct conversational format
    let message = feedback.feedback; // Use the original feedback first
    
    // If the original feedback is too long, create a condensed version
    if (message.length > 200) {
      // Create a simpler message that's still conversational but shorter
      if (interviewMode === 'behavioral' && message.toLowerCase().includes('star')) {
        // For behavioral with STAR method feedback
        message = `Here's my feedback. ${strengths}. For improvement, remember to use the STAR method - Situation, Task, Action, Result. ${improvement}. Score: ${score}/5.`;
      } else {
        // For general and technical feedback
        message = `Here's what I think. ${strengths}. To improve, ${improvement}. Your score is ${score}/5.`;
      }
    }
    
    // Ensure the message isn't too long for audio
    if (message.length > 300) {
      message = message.substring(0, 300) + '...';
    }
    
    return message;
  };

  // Completely revised message deduplication system
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
    
    // Check if we're trying to add another message while processing feedback
    if (processingFeedback && (message.role === 'interviewer' || message.role === 'feedback')) {
      console.log(`Delaying message while feedback is processing: ${messageId} (${message.role})`);
      
      // Delay this message until feedback processing is complete
      setTimeout(() => {
        console.log(`Retrying delayed message: ${messageId} (${message.role})`);
        addMessageToConversation(completeMessage);
      }, 3000);
      
      return;
    }
    
    // Add the message to conversation with proper sequence checks
    setConversation(prev => {
      // 1. Check for exact duplicate messages
      const exactDuplicate = prev.some(m => 
        m.messageId === messageId || 
        (m.role === message.role && m.content === message.content)
      );
      
      if (exactDuplicate) {
        console.log(`Exact duplicate message rejected: ${messageId} (${message.role})`);
        return prev;
      }
      
      // 2. For interviewer messages (questions), check if we already have an active question
      if (message.role === 'interviewer' && message.question) {
        // Find the most recent candidate message
        let lastCandidateIndex = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === 'candidate') {
            lastCandidateIndex = i;
            break;
          }
        }
        
        // Find the most recent interviewer message
        let lastInterviewerIndex = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === 'interviewer' && prev[i].question) {
            lastInterviewerIndex = i;
            break;
          }
        }
        
        // If we have an interviewer question with no candidate response, reject this new question
        if (lastInterviewerIndex > lastCandidateIndex) {
          console.log(`Rejecting question - previous question not yet answered: ${messageId}`);
          return prev;
        }
        
        // If the last message is feedback, make sure this question comes after
        if (prev.length > 0 && prev[prev.length-1].role === 'feedback') {
          // Ensure this question comes after the feedback in sequence
          const newTimestamp = Math.max(timestamp, (prev[prev.length-1].timestamp || 0) + 2000);
          if (newTimestamp > timestamp) {
            console.log(`Adjusting question timestamp to come after feedback: ${messageId}`);
            completeMessage.timestamp = newTimestamp;
          }
        }
      }
      
      // 3. For feedback messages, enforce one feedback per candidate response
      if (message.role === 'feedback') {
        // Find the most recent candidate message
        let lastCandidateIndex = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === 'candidate') {
            lastCandidateIndex = i;
            break;
          }
        }
        
        if (lastCandidateIndex === -1) {
          console.log(`Rejecting feedback - no candidate message found: ${messageId}`);
          return prev;
        }
        
        // Check if there's already feedback for this candidate message
        let hasFeedback = false;
        for (let i = lastCandidateIndex + 1; i < prev.length; i++) {
          if (prev[i].role === 'feedback') {
            hasFeedback = true;
            break;
          }
        }
        
        if (hasFeedback) {
          console.log(`Rejecting feedback - candidate already has feedback: ${messageId}`);
          return prev;
        }
      }
      
      // Add the message and sort by timestamp
      const newConversation = [...prev, completeMessage].sort(
        (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
      );
      
      console.log(`Added message to conversation: ${messageId} (${message.role})`);
      return newConversation;
    });
  };

  // Updated handleStartInterview function to ensure proper sequencing
  const handleStartInterview = async () => {
    if (!jobDescription || !company) {
      setError('Please enter both job description and company name');
      return;
    }
    
    // Make sure no processing is happening
    setProcessingFeedback(false);
    
    setIsLoading(true);
    setError(null);
    setConversation([]);
    lastAudioMessageIdRef.current = null; // Reset any audio playback state
    
    try {
      // Prime audio for Safari with extra measures
      if (isSafari) {
        // Multiple priming attempts for Safari
        primeSafariAudioContext();
        
        // Create a user gesture on the document to help unlock audio
        document.body.click();
        
        // Also try playing a silent audio element
        const silentAudio = new Audio();
        silentAudio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAANVVV";
        silentAudio.load();
        try {
          silentAudio.play().catch(e => console.log("Silent audio play attempt:", e));
        } catch (e) {
          console.log("Silent audio exception:", e);
        }
      } else {
        // Regular audio priming for other browsers
        const AudioContextClass = window.AudioContext || 
          ((window as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext);
        
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();
          const silentBuffer = audioContext.createBuffer(1, 1, 22050);
          const source = audioContext.createBufferSource();
          source.buffer = silentBuffer;
          source.connect(audioContext.destination);
          source.start();
          console.log("Audio context primed for browsers");
        }
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
        
        // Start the interview first - this ensures the UI is ready
        setStarted(true);
        
        // Reset any processing flags
        setProcessingFeedback(false);
        
        // Give a short delay to ensure the UI has updated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Define a fixed base timestamp for better sequencing
        const baseTime = Date.now();
        
        console.log("Starting interview with welcome message");
        
        // Add the welcome message with special Safari handling
        const welcomeMessage = `Welcome to your ${interviewMode} interview preparation for ${company}. I'll adapt my questions based on your answers to create a natural conversation, just like in a real interview. This will help you improve your interviewing skills for the ${company} position. Let's start with the first question.`;
        const summarizedWelcome = `Welcome to your ${interviewMode} interview with ${company}. Let's begin.`;
        
        const welcomeMessageId = `interviewer-welcome-${baseTime}`;
        addMessageToConversation({
          role: 'interviewer',
          content: welcomeMessage,
          summarizedContent: summarizedWelcome,
          needsAudioPlay: true,
          messageId: welcomeMessageId,
          timestamp: baseTime
        });
        
        console.log("Added welcome message, attempting to play audio");
        
        // For Safari, we need to explicitly try to play the welcome audio
        if (isSafari) {
          setTimeout(() => {
            // Force audio playback of welcome message
            const welcomeIndex = conversation.findIndex(msg => msg.messageId === welcomeMessageId);
            if (welcomeIndex !== -1) {
              console.log("Setting welcome message for Safari audio playback", welcomeIndex);
              lastAudioMessageIdRef.current = welcomeIndex;
              
              // Force a UI update to trigger the AudioPlayer
              setIsSpeaking(true);
              setTimeout(() => setIsSpeaking(false), 10);
            }
          }, 500);
        }
        
        // Add the first question after a delay
        setTimeout(() => {
          // Add the first question with explicit timing
          const questionTime = baseTime + 3000; // 3 seconds after welcome
          const firstQuestionMessageId = `interviewer-question-0-${questionTime}`;
          
          console.log("Adding first question to conversation");
          addMessageToConversation({
            role: 'interviewer',
            content: data.questions[0].question,
            question: data.questions[0],
            summarizedContent: data.questions[0].question,
            needsAudioPlay: true,
            messageId: firstQuestionMessageId,
            timestamp: questionTime
          });
          
          // For Safari, explicitly set this question for audio playback if welcome is done
          if (isSafari) {
            setTimeout(() => {
              if (!isSpeaking) {
                const questionIndex = conversation.findIndex(msg => msg.messageId === firstQuestionMessageId);
                if (questionIndex !== -1) {
                  console.log("Setting first question for Safari audio playback", questionIndex);
                  lastAudioMessageIdRef.current = questionIndex;
                }
              }
            }, 1000);
          }
        }, isSafari ? 4000 : 2000); // Longer delay for Safari
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

  // Update the playFeedbackAudio function to use the voice ID
  const playFeedbackAudio = (index: number, feedbackText: string) => {
    // First prime Safari audio context 
    primeSafariAudioContext();
    
    // Set audio message index with small delay
    setTimeout(() => {
      console.log(`Directly playing feedback audio at index ${index} with text: ${feedbackText.substring(0, 30)}...`);
      // Ensure we're not speaking first
      setIsSpeaking(false);
      // Set the audio message to play
      lastAudioMessageIdRef.current = index;
      
      // Make sure the AudioPlayer component gets the voice ID by re-rendering
      setConversation(prev => [...prev]);
    }, 300);
  };

  // Force direct question progression after feedback
  const handleAudioPlaybackEnded = () => {
    const currentAudioIndex = lastAudioMessageIdRef.current;
    console.log(`Audio playback ended for message ${currentAudioIndex}, type: ${currentAudioIndex !== null ? conversation[currentAudioIndex]?.role : 'none'}`);
    
    // Clear the current message that just finished playing
    const currentMessage = currentAudioIndex !== null ? conversation[currentAudioIndex] : null;
    lastAudioMessageIdRef.current = null;
    setIsSpeaking(false);
    
    // Immediately check if a feedback message just finished playing
    if (currentMessage?.role === 'feedback') {
      console.log("Feedback audio just finished, triggering next question immediately");
      setTimeout(() => {
        addNextQuestion(currentMessage);
      }, 300);
      return;
    }
    
    // Find the next message that needs audio playback
    setTimeout(() => {
      let nextMessageIndex = findNextAudioMessageIndex();
      
      if (nextMessageIndex !== -1) {
        console.log(`Playing next audio message at index ${nextMessageIndex}`);
        lastAudioMessageIdRef.current = nextMessageIndex;
      } else {
        console.log("No more messages need audio playback");
      }
    }, 200);
  };

  // Helper function to find the next message that needs audio
  const findNextAudioMessageIndex = () => {
    for (let i = 0; i < conversation.length; i++) {
      if (conversation[i].needsAudioPlay) {
        return i;
      }
    }
    return -1;
  };

  // Add the next question after feedback
  const addNextQuestion = (feedbackMessage: ConversationMessage) => {
    // Don't add another question if we're already processing one
    if (processingFeedback) {
      console.log("Already processing feedback, won't add another question");
      return;
    }
    
    console.log("Adding next question after feedback");
    
    // Set processing flag to prevent duplicates
    setProcessingFeedback(true);
    
    // Check if the feedback has a follow-up question
    if (feedbackMessage?.feedback?.follow_up_question) {
      const followUpQuestion = feedbackMessage.feedback.follow_up_question;
      const followUpCategory = feedbackMessage.feedback.follow_up_category || "Follow-up";
      
      console.log("Using follow-up question from feedback:", followUpQuestion);
      
      // Increment question counter
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      
      // Add the follow-up question immediately
      const followUpId = `follow-up-${Date.now()}`;
      addMessageToConversation({
        role: 'interviewer',
        content: followUpQuestion,
        question: {
          question: followUpQuestion,
          category: followUpCategory,
          difficulty: "Follow-up"
        },
        summarizedContent: followUpQuestion,
        needsAudioPlay: true,
        messageId: followUpId,
        timestamp: Date.now()
      });
      
      console.log("Added follow-up question:", followUpId);
      
    } else {
      // If there's no follow-up question from API, create a default one
      const currentQuestion = questions[currentQuestionIndex] || 
        { question: "Tell me more about your experience", category: "Experience", difficulty: "Medium" };
      
      // Create a generic follow-up based on the current question's category
      const followUpQuestion = `Let's explore another aspect. ${
        interviewMode === 'behavioral' 
          ? `Can you give me an example of a time when you demonstrated ${currentQuestion.category || "leadership"}?` 
          : `How would you approach a problem related to ${currentQuestion.category || "system design"}?`
      }`;
      
      console.log("Using generic follow-up question:", followUpQuestion);
      
      // Increment question counter
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      
      // Add the follow-up question immediately
      const followUpId = `generic-follow-up-${Date.now()}`;
      addMessageToConversation({
        role: 'interviewer',
        content: followUpQuestion,
        question: {
          question: followUpQuestion,
          category: currentQuestion.category || "Follow-up",
          difficulty: currentQuestion.difficulty || "Medium"
        },
        summarizedContent: followUpQuestion,
        needsAudioPlay: true,
        messageId: followUpId,
        timestamp: Date.now()
      });
      
      console.log("Added generic follow-up question:", followUpId);
    }
    
    // Release the processing flag with a delay
    setTimeout(() => {
      setProcessingFeedback(false);
    }, 1000);
  };

  // Update the handleSubmitAnswer function for more reliable question flow
  const handleSubmitAnswer = async () => {
    // Prime Safari audio
    primeSafariAudioContext();
    
    if (!userAnswer.trim()) {
      setError('Please provide an answer before submitting');
      return;
    }
    
    // Set processing flag to block duplicate messages
    setProcessingFeedback(true);

    // Save the current answer
    const currentAnswer = userAnswer;
    
    // Clear the answer field immediately
    setUserAnswer('');
    setIsSubmittingAnswer(true);
    setError(null);

    // Add user's answer to conversation
    const candidateMessageId = `candidate-${Date.now()}`;
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
      
      console.log(`Submitting answer for question ${currentQuestionIndex}, company: ${company}`);
      
      // Prepare conversation history for the API
      const conversationHistory = conversation
        .filter(msg => msg.role !== 'feedback') // Remove feedback messages from history
        .map(msg => ({
          role: msg.role === 'candidate' ? 'user' : 'assistant',
          content: msg.content
        }))
        .slice(-6);
      
      // Add current answer if not already included
      if (!conversationHistory.some(msg => msg.content === currentAnswer)) {
        conversationHistory.push({
          role: 'user',
          content: currentAnswer
        });
      }
      
      // Get feedback from the API
      const feedbackResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAnswer: currentAnswer,
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
      console.log("Feedback response:", feedback);

      // Prepare feedback content for display and audio
      const displayFeedback = feedback.feedback;
      const audioFeedback = createAudioFriendlyFeedback(feedback);
      
      console.log("Audio-friendly feedback created:", audioFeedback);

      // Add feedback to conversation
      const feedbackMessageId = `feedback-for-${candidateMessageId}-${Date.now()}`;
      
      addMessageToConversation({
        role: 'feedback',
        content: displayFeedback,
        feedback: feedback,
        summarizedContent: audioFeedback,
        needsAudioPlay: true,
        messageId: feedbackMessageId,
        timestamp: Date.now()
      });
      
      console.log("Added feedback message:", feedbackMessageId);
      
      // Find and play the feedback audio
      setTimeout(() => {
        const feedbackIndex = conversation.findIndex(msg => msg.messageId === feedbackMessageId);
        if (feedbackIndex !== -1) {
          console.log("Playing feedback audio");
          lastAudioMessageIdRef.current = feedbackIndex;
        } else {
          console.warn("Could not find feedback message to play");
          // If we can't find the feedback message, immediately add the next question
          addNextQuestion({ feedback: feedback } as ConversationMessage);
        }
        
        // Clear the submission state
        setIsSubmittingAnswer(false);
      }, 500);
      
    } catch (error) {
      console.error('Error submitting answer:', error);
      setError('Failed to submit answer. Please try again.');
      setProcessingFeedback(false);
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

  // Voice input handler with the same improvements
  const handleVoiceInput = (transcript: string) => {
    // Don't process if we're already processing feedback
    if (processingFeedback) {
      console.log("Voice input rejected - already processing feedback");
      setListeningForVoice(false);
      return;
    }
    
    // Prime Safari audio context first
    primeSafariAudioContext();
    
    console.log("Processing voice transcript:", transcript);
    
    // Stop recording immediately
    setListeningForVoice(false);
    
    if (transcript.trim()) {
      // Set processing flag to block duplicate messages
      setProcessingFeedback(true);
      
      // Set answer in state
      setUserAnswer(transcript);
      
      // Add user's voice answer to conversation
      const voiceMessageId = `candidate-voice-${Date.now()}`;
      addMessageToConversation({
        role: 'candidate',
        content: transcript,
        messageId: voiceMessageId,
        timestamp: Date.now()
      });
      
      // Process the voice input
      const submitAnswer = async (answerText: string) => {
        if (!answerText.trim()) {
          setProcessingFeedback(false);
          return;
        }
        
        console.log("Submitting voice answer to API:", answerText);
        setIsSubmittingAnswer(true);
        setError(null);
        
        try {
          // Get the current question
          const currentQuestion = currentQuestionIndex < questions.length 
            ? questions[currentQuestionIndex] 
            : null;
          
          // Prepare conversation history
          const conversationHistory = conversation
            .filter(msg => msg.role !== 'feedback') // Remove feedback from history
            .map(msg => ({
              role: msg.role === 'candidate' ? 'user' : 'assistant',
              content: msg.content
            }))
            .slice(-6);
          
          // Add current answer if not included
          if (!conversationHistory.some(msg => msg.content === answerText)) {
            conversationHistory.push({
              role: 'user',
              content: answerText
            });
          }
          
          // Get feedback from the API
          const feedbackResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
          console.log("Voice input: Received feedback response");

          // Create conversational feedback for display and audio
          const displayFeedback = feedback.feedback;
          const audioFeedback = createAudioFriendlyFeedback(feedback);
          
          console.log("Voice input: Audio-friendly feedback created:", audioFeedback);

          // Add feedback to conversation
          const feedbackMessageId = `feedback-for-${voiceMessageId}-${Date.now()}`;
          const feedbackTimestamp = Date.now() + 100;
          
          addMessageToConversation({
            role: 'feedback',
            content: displayFeedback,
            feedback: feedback,
            summarizedContent: audioFeedback,
            needsAudioPlay: true,
            messageId: feedbackMessageId,
            timestamp: feedbackTimestamp
          });
          
          console.log("Voice input: Added feedback to conversation:", feedbackMessageId);
          
          // Find and play the feedback audio
          setTimeout(() => {
            const feedbackIndex = conversation.findIndex(msg => msg.messageId === feedbackMessageId);
            if (feedbackIndex !== -1) {
              console.log(`Voice input: Playing feedback audio at index ${feedbackIndex}`);
              playFeedbackAudio(feedbackIndex, audioFeedback);
              
              // Wait for feedback to finish before proceeding
              const estimatedAudioDuration = Math.max(2000, audioFeedback.length * 80);
              
              setTimeout(() => {
                // Now add the follow-up question if available
                if (feedback.follow_up_question) {
                  // Increment question counter
                  setCurrentQuestionIndex(prevIndex => prevIndex + 1);
                  
                  // Add the follow-up question
                  const followUpMessageId = `interviewer-follow-up-for-${feedbackMessageId}-${Date.now()}`;
                  const followUpTimestamp = feedbackTimestamp + estimatedAudioDuration + 1000;
                  
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
                  
                  console.log("Voice input: Added follow-up question:", followUpMessageId);
                } else if (currentQuestionIndex >= questions.length - 1) {
                  // Interview completed
                  const concludingMessage = "That concludes our interview. Thank you for your thoughtful responses. I hope this practice helps you in your actual interview with " + company + ".";
                  
                  const concludingMessageId = `interviewer-conclusion-voice-${Date.now()}`;
                  const concludingTimestamp = feedbackTimestamp + estimatedAudioDuration + 1000;
                  
                  addMessageToConversation({
                    role: 'interviewer',
                    content: concludingMessage,
                    summarizedContent: "That's all for today. Thanks for participating in this interview simulation.",
                    needsAudioPlay: true,
                    messageId: concludingMessageId,
                    timestamp: concludingTimestamp
                  });
                  
                  console.log("Voice input: Added concluding message:", concludingMessageId);
                }
                
                // Clear the processing flag
                setProcessingFeedback(false);
              }, estimatedAudioDuration);
              
            } else {
              console.warn("Voice input: Could not find feedback message to play audio");
              setProcessingFeedback(false);
            }
          }, 500);

          // Clear the answer
          setUserAnswer('');
        } catch (error) {
          console.error('Error submitting voice answer:', error);
          setError('Failed to submit answer. Please try again.');
          setProcessingFeedback(false);
        } finally {
          setIsSubmittingAnswer(false);
        }
      };
      
      // Process the transcript immediately
      submitAnswer(transcript);
    } else {
      setProcessingFeedback(false);
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
                    <span>{currentQuestionIndex + 1}/{totalQuestions} Questions</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${((currentQuestionIndex) / (totalQuestions)) * 100}%` }}
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
                                  voiceId={VOICE_ID}
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
                                  voiceId={VOICE_ID}
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