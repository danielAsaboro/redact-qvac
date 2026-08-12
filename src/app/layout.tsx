import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redact — Local review room",
  description:
    "A private, review-first workspace for preparing safer fixture copies.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
