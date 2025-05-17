"use client";

import { useState } from 'react';
import AudioPlayer from './components/AudioPlayer';

export default function Home() {
  const [jobDescription, setJobDescription] = useState('');
  const [company, setCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');

  const handleStartInterview = async () => {
    if (!jobDescription || !company) {
      alert('Please enter both job description and company name');
      return;
    }
    
    setIsLoading(true);
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
        throw new Error('Failed to start interview');
      }

      const data = await response.json();
      
      if (data.interviewQuestions && data.interviewQuestions.length > 0) {
        setQuestions(data.interviewQuestions);
        setStarted(true);
      } else {
        alert('Failed to generate interview questions. Please try again.');
      }
    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Failed to start interview. Please try again.');
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">AI-pplicant</h1>
        <h2 className="text-2xl text-center mb-12">Voice Interview Simulator</h2>
        
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
              disabled={isLoading}
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
                <label className="block text-sm font-medium mb-2">
                  Your Answer:
                </label>
                <textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5"
                  rows={4}
                  placeholder="Type your answer here..."
                />
              </div>
              
              <div className="flex justify-between">
                <button 
                  className="py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md"
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
