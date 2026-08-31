import { useEffect, useMemo, useRef, useState } from "react";

const GoogleAuthButton = ({ mode = "login", businessName = "", name = "", onSuccess, onError }) => {
  const buttonRef = useRef(null);
  const [ready, setReady] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const nonce = useMemo(() => {
    const bytes = new Uint8Array(16);
    window.crypto?.getRandomValues?.(bytes);
    return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("") || `${Date.now()}-${Math.random()}`;
  }, []);

  useEffect(() => {
    if (!clientId || typeof window === "undefined") return;
    const existing = document.querySelector("script[data-google-identity]");
    const load = () => setReady(Boolean(window.google?.accounts?.id));
    if (existing) {
      load();
      existing.addEventListener("load", load, { once: true });
      return () => existing.removeEventListener("load", load);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = load;
    script.onerror = () => onError?.("Google login script could not be loaded.");
    document.body.appendChild(script);
  }, [clientId, onError]);

  useEffect(() => {
    if (!ready || !buttonRef.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce,
      callback: (response) => {
        if (!response.credential) return onError?.("Google did not return a credential.");
        onSuccess?.({ idToken: response.credential, nonce, mode, businessName, name });
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: mode === "signup" ? "signup_with" : "continue_with",
      width: buttonRef.current.offsetWidth || 320,
    });
  }, [businessName, clientId, mode, name, nonce, onError, onSuccess, ready]);

  if (!clientId) {
    return <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700">Google login is not configured for this environment.</p>;
  }

  return <div ref={buttonRef} className="flex min-h-[44px] w-full justify-center" />;
};

export default GoogleAuthButton;
