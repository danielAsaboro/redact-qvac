import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redact — Share a safer copy",
  description:
    "A private, review-first workspace for creating flattened redacted copies.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
