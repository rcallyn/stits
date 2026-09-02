import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Nav from "@/components/Nav";
import SearchPalette from "@/components/SearchPalette";
import Toaster from "@/components/Toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "stits",
  description: "Schedule, todos, and everything else in one place.",
  appleWebApp: {
    capable: true,
    title: "stits",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('stits:theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Nav />
        <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
        <SearchPalette />
        <Toaster />
      </body>
    </html>
  );
}
