"use client";

import { useState, useRef, useEffect } from 'react';
import AudioPlayer from './components/AudioPlayer';
import VoiceRecorder from './components/VoiceRecorder';

interface Question {
  question: string;
  category: string;
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
        
        // Add welcome message and first question to conversation
        setConversation([
          {
            role: 'interviewer',
            content: `Welcome to your technical interview with ${company}. I'll be asking you some questions to evaluate your technical skills. Let's start with the first question.`,
          },
          {
            role: 'interviewer',
            content: data.questions[0].question,
            question: data.questions[0],
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
          company,
        }),
      });

      if (!feedbackResponse.ok) {
        throw new Error('Failed to get feedback on answer');
      }

      const feedback = await feedbackResponse.json();

      // Add feedback to conversation
      setConversation(prev => [
        ...prev, 
        { 
          role: 'feedback', 
          content: feedback.feedback,
          feedback: feedback,
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
            }
          ]);
        }, 1000);
      } else {
        // Interview completed
        setTimeout(() => {
          setConversation(prev => [
            ...prev, 
            { 
              role: 'interviewer', 
              content: "That concludes our technical interview. Thank you for your time and thoughtful responses. Do you have any questions for me?",
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
    <main className="flex min-h-screen flex-col items-center">
      <div className="z-10 w-full max-w-4xl px-4 pb-24">
        <h1 className="text-3xl md:text-4xl font-bold text-center my-8">AI-pplicant</h1>
        <h2 className="text-xl md:text-2xl text-center mb-8">Technical Interview Simulator</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100/20 text-red-200 rounded-md">
            <p>{error}</p>
          </div>
        )}
        
        {!started ? (
          <div className="bg-white/10 p-6 rounded-lg shadow-lg w-full max-w-2xl mx-auto">
            <div className="mb-6">
              <label htmlFor="company" className="block text-sm font-medium mb-2">
                Company Name
              </label>
              <input
                type="text"
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5"
                placeholder="Enter company name (e.g., Google, Amazon, Microsoft)"
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="jobDescription" className="block text-sm font-medium mb-2">
                Job Description
              </label>
              <textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5"
                rows={6}
                placeholder="Paste the job description here (include technical requirements, responsibilities, etc.)"
              />
            </div>
            
            <button
              onClick={handleStartInterview}
              disabled={isLoading || !company || !jobDescription}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition duration-150 ease-in-out disabled:opacity-50"
            >
              {isLoading ? 'Preparing Interview...' : 'Start Technical Interview'}
            </button>
          </div>
        ) : (
          <div className="w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium">Technical Interview: {company}</h3>
              <button 
                onClick={handleRestart}
                className="py-1 px-3 bg-gray-600 hover:bg-gray-700 text-sm text-white rounded-md"
              >
                Restart
              </button>
            </div>
            
            {/* Conversation thread */}
            <div className="bg-gray-900/50 rounded-lg shadow-lg p-4 mb-4 max-h-[60vh] overflow-y-auto">
              {conversation.map((message, index) => (
                <div key={index} className={`mb-6 ${message.role === 'candidate' ? 'pl-4' : ''}`}>
                  {message.role === 'interviewer' && (
                    <div className="mb-2">
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-2">
                          <span className="text-white font-bold">I</span>
                        </div>
                        <span className="font-semibold text-blue-300">
                          Interviewer {message.question && `(${message.question.category})`}
                        </span>
                      </div>
                      <p className="text-white">{message.content}</p>
                      
                      {message.question && (
                        <AudioPlayer 
                          text={message.content}
                          autoPlay={index === 1} // Auto-play only the first question
                        />
                      )}
                    </div>
                  )}
                  
                  {message.role === 'candidate' && (
                    <div className="border-l-2 border-green-500 pl-4 mb-2">
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center mr-2">
                          <span className="text-white font-bold">Y</span>
                        </div>
                        <span className="font-semibold text-green-300">You</span>
                      </div>
                      <p>{message.content}</p>
                    </div>
                  )}
                  
                  {message.role === 'feedback' && message.feedback && (
                    <div className="bg-indigo-900/30 p-4 rounded-md mb-2">
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mr-2">
                          <span className="text-white font-bold">F</span>
                        </div>
                        <div>
                          <span className="font-semibold text-indigo-300">Feedback</span>
                          <span className="ml-2 px-2 py-1 bg-indigo-700 rounded-md text-xs">
                            Score: {message.feedback.score}/5
                          </span>
                        </div>
                      </div>
                      <p className="mb-2">{message.feedback.feedback}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <h4 className="text-sm font-medium mb-1 text-green-300">Strengths:</h4>
                          <ul className="list-disc pl-5 text-sm">
                            {message.feedback.strengths.map((strength, idx) => (
                              <li key={idx}>{strength}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-1 text-yellow-300">Areas for Improvement:</h4>
                          <ul className="list-disc pl-5 text-sm">
                            {message.feedback.improvements.map((improvement, idx) => (
                              <li key={idx}>{improvement}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      
                      {message.feedback.follow_up && (
                        <div className="mt-3 pt-2 border-t border-indigo-700">
                          <p className="text-sm italic">
                            <span className="font-semibold">Follow-up question:</span> {message.feedback.follow_up}
                          </p>
                        </div>
                      )}
                      
                      <AudioPlayer text={message.content} />
                    </div>
                  )}
                </div>
              ))}
              <div ref={conversationEndRef} />
            </div>
            
            {/* Answer input */}
            {currentQuestionIndex < questions.length && (
              <div className="bg-white/10 p-4 rounded-lg shadow-lg">
                <div className="mb-2 flex justify-between items-center">
                  <label className="block text-sm font-medium">
                    Your Answer:
                  </label>
                  <button 
                    onClick={() => setListeningForVoice(!listeningForVoice)}
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    {listeningForVoice ? 'Cancel Voice' : 'Use Voice'}
                  </button>
                </div>
                
                {listeningForVoice ? (
                  <div className="bg-gray-800/50 p-4 rounded-md flex flex-col items-center justify-center">
                    <p className="mb-3 text-center">Speak your answer...</p>
                    <VoiceRecorder onTranscription={handleVoiceInput} isListening={true} />
                  </div>
                ) : (
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5"
                    rows={4}
                    placeholder="Type your technical answer here or use voice input..."
                  />
                )}
                
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={isSubmittingAnswer || !userAnswer.trim()}
                    className="py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50"
                  >
                    {isSubmittingAnswer ? 'Submitting...' : 'Submit Answer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
