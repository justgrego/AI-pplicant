import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI-pplicant | Voice Interview Simulator",
  description: "Practice job interviews with AI-powered voice simulations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <footer className="w-full p-4 text-center text-sm text-gray-500">
          <p>
            Built with Next.js, OpenAI, and ElevenLabs. 
            <a href="https://github.com/yourusername/ai-pplicant" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 hover:underline">
              View on GitHub
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
