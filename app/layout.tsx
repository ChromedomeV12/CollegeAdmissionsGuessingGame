import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admissions Oracle",
  description: "Test your admissions intuition across anonymized applicant profiles.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
