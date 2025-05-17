# AI-pplicant: Voice Interview Simulator

AI-pplicant is a voice-powered mock interview application that uses ElevenLabs conversational AI to simulate job interviews. Users can upload job descriptions, and the system will generate tailored interview questions based on the specific company and role.

## Features

- Upload job descriptions to generate custom interview questions
- Voice-powered responses using ElevenLabs text-to-speech
- Interactive interview experience with audio playback
- Track your responses and navigate through questions

## Technologies Used

- **Frontend**: Next.js with React and TypeScript
- **Backend**: Next.js API Routes
- **AI APIs**: OpenAI for question generation, ElevenLabs for voice synthesis
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- API keys for:
  - OpenAI (for generating interview questions)
  - ElevenLabs (for voice synthesis)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ai-pplicant.git
   cd ai-pplicant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following environment variables:
   ```
   OPENAI_API_KEY=your-openai-api-key
   ELEVENLABS_API_KEY=your-elevenlabs-api-key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Deployment on Vercel

1. Create a Vercel account at [vercel.com](https://vercel.com) if you don't have one.

2. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```

3. Deploy to Vercel:
   ```bash
   vercel
   ```

4. Follow the prompts to set up your project on Vercel.

5. Make sure to add your environment variables (OPENAI_API_KEY and ELEVENLABS_API_KEY) in the Vercel project settings.

## Usage

1. Enter the company name and job description on the home page.
2. Click "Start Interview" to begin the mock interview.
3. Listen to the interview questions using the voice synthesis feature.
4. Type your answers in the provided text area.
5. Navigate through questions using the Previous/Next buttons.
6. End the interview at any time using the "End Interview" button.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to ElevenLabs for providing the voice synthesis API
- Thanks to OpenAI for providing the GPT API for question generation
