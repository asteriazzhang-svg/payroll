import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "Hortor Payroll System",
  description: "Hortor Payroll System — supports SZ/HK employees, social insurance & housing fund, cumulative IIT, multi-currency payout.",
  keywords: ["Payroll", "Salary", "IIT", "MPF", "Social Insurance", "Next.js", "TypeScript"],
  authors: [{ name: "Hortor" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
