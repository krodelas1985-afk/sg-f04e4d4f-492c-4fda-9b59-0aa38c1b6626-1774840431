import { Toaster } from "@/components/ui/toaster";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { UserProfileProvider } from "@/contexts/UserProfileContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UserProfileProvider>
      <Component {...pageProps} />
      <Toaster />
    </UserProfileProvider>
  );
}
