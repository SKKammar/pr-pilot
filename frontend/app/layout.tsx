import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PR Pilot — AI Code Reviews for GitHub",
  description:
    "PR Pilot automatically reviews your pull requests using Gemini 2.0 Flash, posting inline comments on bugs, security issues, and logic errors within 30 seconds.",
  openGraph: {
    title: "PR Pilot — AI Code Reviews for GitHub",
    description: "Automated pull request reviews powered by Gemini 2.0 Flash.",
    url: "https://pr-pilot-six.vercel.app",
    siteName: "PR Pilot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PR Pilot — AI Code Reviews for GitHub",
    description: "Automated pull request reviews powered by Gemini 2.0 Flash.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
