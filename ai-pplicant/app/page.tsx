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
}

interface ConversationMessage {
  role: 'interviewer' | 'candidate' | 'feedback';
  content: string;
  question?: Question;
  feedback?: FeedbackResponse;
  summarizedContent?: string;
  needsAudioPlay?: boolean;
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
  const [audioPlayed, setAudioPlayed] = useState<Record<number, boolean>>({});
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const lastAudioMessageIdRef = useRef<number | null>(null);

  // Scroll to bottom of conversation when new messages are added
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Play audio for the last message that needs audio
    const lastMessageIndex = conversation.findIndex((msg, idx) => 
      msg.needsAudioPlay && (!lastAudioMessageIdRef.current || idx > lastAudioMessageIdRef.current)
    );

    if (lastMessageIndex !== -1) {
      lastAudioMessageIdRef.current = lastMessageIndex;
    }
  }, [conversation]);

  const handleStartInterview = async () => {
    if (!jobDescription || !company) {
      setError('Please enter both job description and company name');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setConversation([]);
    
    try {
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company,
          jobDescription,
          interviewMode, // Send the interview mode to the API
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setCurrentQuestionIndex(0);
        
        // Create welcome message with summarized version for speech
        const welcomeMessage = `Welcome to your ${interviewMode} interview with ${company}. I'll be asking you some questions to evaluate your ${interviewMode === 'technical' ? 'technical skills' : 'fit for the role'}. Let's start with the first question.`;
        const summarizedWelcome = `Welcome to your ${interviewMode} interview with ${company}. Let's begin.`;
        
        // Add welcome message and first question to conversation
        setConversation([
          {
            role: 'interviewer',
            content: welcomeMessage,
            summarizedContent: summarizedWelcome,
            needsAudioPlay: true
          },
          {
            role: 'interviewer',
            content: data.questions[0].question,
            question: data.questions[0],
            summarizedContent: data.questions[0].question,
            needsAudioPlay: true
          }
        ]);
        
        setStarted(true);
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

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      setError('Please provide an answer before submitting');
      return;
    }

    setIsSubmittingAnswer(true);
    setError(null);

    // Add user's answer to conversation
    setConversation(prev => [
      ...prev, 
      { 
        role: 'candidate', 
        content: userAnswer,
      }
    ]);

    try {
      // Get feedback on the answer
      const currentQuestion = questions[currentQuestionIndex];
      const feedbackResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAnswer,
          question: currentQuestion.question,
          category: currentQuestion.category,
          difficulty: currentQuestion.difficulty,
          company,
          interviewMode, // Send interview mode to get appropriate feedback
        }),
      });

      if (!feedbackResponse.ok) {
        throw new Error('Failed to get feedback on answer');
      }

      const feedback = await feedbackResponse.json();

      // Create a summarized version of the feedback for speech
      const summarizedFeedback = `${feedback.score >= 4 ? 'Good answer! ' : 'Thanks for your answer. '} 
        ${feedback.strengths[0]}. However, ${feedback.improvements[0]}. 
        Your score is ${feedback.score} out of 5.`;

      // Add feedback to conversation
      setConversation(prev => [
        ...prev, 
        { 
          role: 'feedback', 
          content: feedback.feedback,
          feedback: feedback,
          summarizedContent: summarizedFeedback,
          needsAudioPlay: true
        }
      ]);

      // Move to next question if available
      if (currentQuestionIndex < questions.length - 1) {
        const nextQuestionIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextQuestionIndex);
        
        // Add next question to conversation after a short delay
        setTimeout(() => {
          setConversation(prev => [
            ...prev, 
            { 
              role: 'interviewer', 
              content: questions[nextQuestionIndex].question,
              question: questions[nextQuestionIndex],
              summarizedContent: questions[nextQuestionIndex].question,
              needsAudioPlay: true
            }
          ]);
        }, 1000);
      } else {
        // Interview completed
        setTimeout(() => {
          const concludingMessage = "That concludes our technical interview. Thank you for your time and thoughtful responses. Do you have any questions for me?";
          setConversation(prev => [
            ...prev, 
            { 
              role: 'interviewer', 
              content: concludingMessage,
              summarizedContent: "That's all for today. Thanks for participating in this interview simulation.",
              needsAudioPlay: true
            }
          ]);
        }, 1000);
      }

      // Clear the answer for the next question
      setUserAnswer('');
    } catch (error) {
      console.error('Error submitting answer:', error);
      setError('Failed to submit answer. Please try again.');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Request microphone permission before starting recording
  const handleVoiceButtonClick = async () => {
    // Don't activate recording if AI is currently speaking
    if (isSpeaking) {
      setError("Please wait for the interviewer to finish speaking.");
      return;
    }
    
    if (listeningForVoice) {
      // Stop listening
      setListeningForVoice(false);
      return;
    }

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
      setListeningForVoice(true);
      setError(null);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Failed to access microphone. Please check your browser permissions.');
    }
  };

  const handleVoiceInput = (transcript: string) => {
    console.log("Received transcript:", transcript);
    if (transcript.trim()) {
      setUserAnswer(transcript);
      // Auto-submit answer after voice recording only if there's content
      setTimeout(() => {
        handleSubmitAnswer();
      }, 800); // Slightly longer delay to ensure state updates
    }
    setListeningForVoice(false);
  };

  // Handle changes to the conversation array and trigger audio playback for the newest messages
  useEffect(() => {
    // Find the last message that needs audio playback
    const messageToPlay = conversation.findIndex((msg, idx) => 
      msg.needsAudioPlay && !audioPlayed[idx] && 
      (lastAudioMessageIdRef.current === null || idx > lastAudioMessageIdRef.current)
    );
    
    if (messageToPlay !== -1) {
      console.log("Playing audio for message:", messageToPlay);
      lastAudioMessageIdRef.current = messageToPlay;
    }
    
    // Scroll to bottom
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, audioPlayed]);

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
    // Automatically stop any ongoing recording when audio starts playing
    if (listeningForVoice) {
      setListeningForVoice(false);
    }
  };

  const handleAudioPlaybackEnded = () => {
    setIsSpeaking(false);
    
    // Mark the current audio message as played
    if (lastAudioMessageIdRef.current !== null) {
      setAudioPlayed(prev => ({
        ...prev,
        [lastAudioMessageIdRef.current!]: true
      }));
    }
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
    
    checkMicrophonePermission();
  }, []);

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
                        <line x1="8" x2="16" y1="23" y2="23" />
                        <line x1="1" y1="1" x2="23" y2="23" />
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
                              <AudioPlayer 
                                text={message.summarizedContent || message.content}
                                autoPlay={true}
                                hideControls={true}
                                onPlaybackStart={handleAudioPlaybackStarted}
                                onPlaybackEnd={handleAudioPlaybackEnded}
                                key={`audio-${index}`}
                              />
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
                              <AudioPlayer 
                                text={message.summarizedContent || message.content}
                                autoPlay={true}
                                hideControls={true}
                                onPlaybackStart={handleAudioPlaybackStarted}
                                onPlaybackEnd={handleAudioPlaybackEnded}
                                key={`audio-${index}`}
                              />
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
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="w-full p-3 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900/70 text-white"
                    rows={3}
                    placeholder="Type your answer here or click 'Start Speaking' to use voice..."
                  />
                  
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={isSubmittingAnswer || !userAnswer.trim()}
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