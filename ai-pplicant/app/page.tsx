"use client";

import { useState, useRef, useEffect } from 'react';
import AudioPlayer from './components/AudioPlayer';
import VoiceRecorder from './components/VoiceRecorder';
import Image from 'next/image';

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
}

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
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of conversation when new messages are added
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
        const welcomeMessage = `Welcome to your technical interview with ${company}. I'll be asking you some questions to evaluate your technical skills. Let's start with the first question.`;
        const summarizedWelcome = `Welcome to your interview with ${company}. Let's begin.`;
        
        // Add welcome message and first question to conversation
        setConversation([
          {
            role: 'interviewer',
            content: welcomeMessage,
            summarizedContent: summarizedWelcome
          },
          {
            role: 'interviewer',
            content: data.questions[0].question,
            question: data.questions[0],
            summarizedContent: data.questions[0].question
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
          summarizedContent: summarizedFeedback
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
              summarizedContent: questions[nextQuestionIndex].question
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
              summarizedContent: "That's all for today. Thanks for participating in this interview simulation."
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

  const handleVoiceInput = (transcript: string) => {
    setUserAnswer(transcript);
    // Auto-submit answer after voice recording
    setTimeout(() => {
      if (transcript.trim()) {
        handleSubmitAnswer();
      }
    }, 500);
    setListeningForVoice(false);
  };

  const handleRestart = () => {
    setStarted(false);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswer('');
    setConversation([]);
    setError(null);
  };

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center mt-8 mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">AI-pplicant</h1>
        <h2 className="text-xl md:text-2xl text-center mb-8 text-gray-300">Technical Interview Simulator</h2>
        
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
                'Start Technical Interview'
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
                    {/* Replace this with an actual animated interviewer image */}
                    <div className="relative w-full h-full">
                      <Image 
                        src="https://www.animatedimages.org/data/media/1660/animated-interview-image-0011.gif" 
                        alt="AI Interviewer"
                        className="object-cover rounded-lg"
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        onError={(e) => {
                          // Fallback if image fails to load
                          const target = e.target as HTMLImageElement;
                          if (target.src !== 'https://via.placeholder.com/400x400?text=AI+Interviewer') {
                            target.src = 'https://via.placeholder.com/400x400?text=AI+Interviewer';
                          }
                        }}
                      />
                    </div>
                  </div>
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
                  onClick={() => setListeningForVoice(!listeningForVoice)}
                  className={`w-full flex items-center justify-center py-3 px-4 rounded-lg transition duration-150 ease-in-out shadow-lg ${
                    listeningForVoice 
                      ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {listeningForVoice ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                      </svg>
                      Stop Recording
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
                            
                            {message.question && (
                              <AudioPlayer 
                                text={message.summarizedContent || message.content}
                                autoPlay={index < 3} // Auto-play first few messages
                                hideControls={true}
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
                            
                            <AudioPlayer 
                              text={message.summarizedContent || message.content}
                              autoPlay={true}
                              hideControls={true}
                            />
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
