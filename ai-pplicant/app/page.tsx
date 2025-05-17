"use client";

import { useState, useRef } from 'react';
import AudioPlayer from './components/AudioPlayer';
import VoiceRecorder from './components/VoiceRecorder';

export default function Home() {
  const [jobDescription, setJobDescription] = useState('');
  const [company, setCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [showApiKeyInfo, setShowApiKeyInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listeningForVoice, setListeningForVoice] = useState(false);
  const [interviewerResponse, setInterviewerResponse] = useState<string | null>(null);
  const responseAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleStartInterview = async () => {
    if (!jobDescription || !company) {
      alert('Please enter both job description and company name');
      return;
    }
    
    setIsLoading(true);
    setError(null);
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
      
      if (data.interviewQuestions && data.interviewQuestions.length > 0) {
        setQuestions(data.interviewQuestions);
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

  const handleNextQuestion = () => {
    // Save current answer
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: currentAnswer
    }));
    
    // Move to next question
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer('');
    } else {
      // Interview complete
      alert('Interview completed! Thank you for your responses.');
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setCurrentAnswer(userAnswers[currentQuestionIndex - 1] || '');
    }
  };

  const handleVoiceInput = (transcript: string) => {
    setCurrentAnswer(transcript);
    setListeningForVoice(false);
    
    // Generate a response from the interviewer about the answer
    generateInterviewerResponse(transcript);
  };

  const generateInterviewerResponse = async (userAnswer: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAnswer,
          question: questions[currentQuestionIndex],
          company,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get interviewer response');
      }

      const data = await response.json();
      setInterviewerResponse(data.response);
    } catch (error) {
      console.error('Error getting interviewer response:', error);
      setInterviewerResponse("I understand. Let's continue with the interview.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        {showApiKeyInfo && (
          <div className="mb-8 p-4 bg-blue-100/20 text-blue-200 rounded-md">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Environment Setup</h3>
              <button 
                onClick={() => setShowApiKeyInfo(false)}
                className="text-blue-300 hover:text-blue-500"
              >
                ✕
              </button>
            </div>
            <p className="mt-2">
              This application uses API keys stored in Vercel. For local development, you may encounter missing audio and use mock data. 
              The deployed version will use the proper API keys from Vercel.
            </p>
          </div>
        )}
        
        <h1 className="text-4xl font-bold text-center mb-8">AI-pplicant</h1>
        <h2 className="text-2xl text-center mb-12">Voice Interview Simulator</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100/20 text-red-200 rounded-md">
            <p>{error}</p>
          </div>
        )}
        
        {!started ? (
          <div className="bg-white/10 p-8 rounded-lg shadow-lg w-full max-w-2xl mx-auto">
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
                placeholder="Enter company name"
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
                placeholder="Paste the job description here"
              />
            </div>
            
            <button
              onClick={handleStartInterview}
              disabled={isLoading || !company || !jobDescription}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition duration-150 ease-in-out disabled:opacity-50"
            >
              {isLoading ? 'Preparing Interview...' : 'Start Interview'}
            </button>
          </div>
        ) : (
          <div className="bg-white/10 p-8 rounded-lg shadow-lg w-full max-w-2xl mx-auto">
            <div>
              <h3 className="text-xl font-medium mb-4">Interview in Progress</h3>
              <p className="mb-6">Interviewing for position at {company}</p>
              
              <div className="bg-black/20 p-6 rounded-lg mb-6">
                <p className="text-xl mb-4 text-blue-300">Question {currentQuestionIndex + 1} of {questions.length}:</p>
                <p className="text-lg mb-4">{questions[currentQuestionIndex]}</p>
                
                <AudioPlayer 
                  text={questions[currentQuestionIndex]}
                  autoPlay={true}
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 flex justify-between items-center">
                  Your Answer:
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
                </label>
                
                {listeningForVoice ? (
                  <div className="bg-gray-800/50 p-4 rounded-md flex flex-col items-center justify-center">
                    <p className="mb-3 text-center">Speak your answer...</p>
                    <VoiceRecorder onTranscription={handleVoiceInput} isListening={true} />
                  </div>
                ) : (
                  <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5"
                    rows={4}
                    placeholder="Type your answer here or use voice input..."
                  />
                )}
              </div>
              
              {interviewerResponse && (
                <div className="mb-6 bg-indigo-900/30 p-4 rounded-md">
                  <h4 className="text-sm font-medium mb-2 text-indigo-300">Interviewer Response:</h4>
                  <p className="text-white">{interviewerResponse}</p>
                  <AudioPlayer text={interviewerResponse} autoPlay={true} />
                </div>
              )}
              
              <div className="flex justify-between">
                <button 
                  className="py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md disabled:opacity-50"
                  onClick={handlePrevQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  Previous
                </button>
                
                <button 
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
                  onClick={handleNextQuestion}
                >
                  {currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
              
              <button 
                className="mt-4 py-2 px-4 w-full bg-red-600 hover:bg-red-700 text-white font-medium rounded-md"
                onClick={() => setStarted(false)}
              >
                End Interview
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
