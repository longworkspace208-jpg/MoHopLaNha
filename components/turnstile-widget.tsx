"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: (errorCode?: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (err?: string) => void;
  onExpire?: () => void;
  className?: string;
}

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  className = "",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fallback to Cloudflare's official test sitekey (Always passes)
  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

  useEffect(() => {
    // Nếu script đã được nạp trước đó
    if (window.turnstile) {
      setLoaded(true);
      return;
    }

    const scriptId = "cf-turnstile-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setLoaded(true);
      };
      script.onerror = () => {
        if (onError) onError("Không thể nạp thư viện Cloudflare Turnstile.");
      };
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", () => setLoaded(true));
    }
  }, [onError]);

  useEffect(() => {
    if (!loaded || !containerRef.current || !window.turnstile) return;

    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // bỏ qua
      }
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          onVerify(token);
        },
        "error-callback": (err) => {
          if (onError) onError(err || "Lỗi xác thực Turnstile");
        },
        "expired-callback": () => {
          if (onExpire) onExpire();
        },
        theme: "light",
      });
    } catch (err) {
      console.warn("[TurnstileWidget] render error:", err);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // bỏ qua
        }
      }
    };
  }, [loaded, siteKey, onVerify, onError, onExpire]);

  return (
    <div className={`turnstile-container ${className}`}>
      <div ref={containerRef} className="min-h-[65px]" />
    </div>
  );
}

