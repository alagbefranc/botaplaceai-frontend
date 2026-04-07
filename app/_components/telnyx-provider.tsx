"use client";

import { TelnyxRTCProvider, TelnyxRTCContext } from "@telnyx/react-client";
import { useCallback, useEffect, useState, createContext, useContext, type ReactNode } from "react";

interface TelnyxContextValue {
  isReady: boolean;
  isConnecting: boolean;
  error: string | null;
  refreshToken: () => Promise<void>;
}

const TelnyxContext = createContext<TelnyxContextValue>({
  isReady: false,
  isConnecting: false,
  error: null,
  refreshToken: async () => {},
});

export function useTelnyxStatus() {
  return useContext(TelnyxContext);
}

interface TelnyxProviderProps {
  children: ReactNode;
}

// Component to set up the remote audio element after client connects
function RemoteAudioSetup() {
  const client = useContext(TelnyxRTCContext);
  
  useEffect(() => {
    if (!client) return;
    
    // Create the audio element for remote audio output
    let audioEl = document.getElementById("telnyx-remote-audio") as HTMLAudioElement | null;
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.id = "telnyx-remote-audio";
      audioEl.autoplay = true;
      audioEl.setAttribute("playsinline", "true");
      document.body.appendChild(audioEl);
      console.log("[TelnyxProvider] Created remote audio element");
    }
    
    // Set the client's remoteElement to our audio element
    // This tells Telnyx SDK where to route remote audio
    client.remoteElement = audioEl;
    console.log("[TelnyxProvider] Set client.remoteElement", client.remoteElement);
    
    return () => {
      // Don't remove on cleanup - keep for duration of session
    };
  }, [client]);
  
  return null;
}

export function TelnyxProvider({ children }: TelnyxProviderProps) {
  const [credential, setCredential] = useState<{ login_token: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const orgId = localStorage.getItem("orgId");
      if (!orgId) {
        setError("No organization selected");
        setIsConnecting(false);
        return;
      }

      const response = await fetch("/api/telnyx/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get WebRTC token");
      }

      const data = await response.json();
      setCredential({ login_token: data.login_token });
    } catch (err) {
      console.error("[TelnyxProvider] Token fetch error:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const options = {
    debug: true, // Enable debug logging
    // Note: ringbackFile removed - was causing "no supported sources" error
    // Telnyx network should provide ringback tone automatically
    useMic: true,
    useSpeaker: true,
  };

  const contextValue: TelnyxContextValue = {
    isReady: Boolean(credential),
    isConnecting,
    error,
    refreshToken: fetchToken,
  };

  // If no credential yet, render children without provider
  if (!credential) {
    return (
      <TelnyxContext.Provider value={contextValue}>
        {children}
      </TelnyxContext.Provider>
    );
  }

  return (
    <TelnyxContext.Provider value={contextValue}>
      <TelnyxRTCProvider credential={credential} options={options}>
        <RemoteAudioSetup />
        {children}
      </TelnyxRTCProvider>
    </TelnyxContext.Provider>
  );
}
