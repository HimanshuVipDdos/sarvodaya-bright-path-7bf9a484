import { useState, useEffect, useCallback, type RefObject } from "react";

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface HTMLVideoElementWithWebKit extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
}

interface UseVideoFullscreenOptions {
  containerRef: RefObject<HTMLElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
  lockOrientationOnMobile?: boolean;
}

export function useVideoFullscreen({
  containerRef,
  videoRef,
  lockOrientationOnMobile = true,
}: UseVideoFullscreenOptions) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState<boolean>(false);

  // Check if standard or vendor-prefixed fullscreen is active
  const checkIsFullscreen = useCallback((): boolean => {
    if (typeof document === "undefined") return false;
    const doc = document as FullscreenDocument;
    const fsEl =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement;

    // Check if the fullscreen element is our container or inside our container or modal
    if (!fsEl) return false;
    if (containerRef.current) {
      return (
        fsEl === containerRef.current ||
        containerRef.current.contains(fsEl) ||
        fsEl.contains(containerRef.current)
      );
    }
    return Boolean(fsEl);
  }, [containerRef]);

  const lockOrientation = async () => {
    if (!lockOrientationOnMobile || typeof window === "undefined") return;
    try {
      if (screen.orientation && "lock" in screen.orientation) {
        await (screen.orientation as any).lock("landscape").catch(() => {});
      }
    } catch {}
  };

  const unlockOrientation = () => {
    if (typeof window === "undefined") return;
    try {
      if (screen.orientation && "unlock" in screen.orientation) {
        screen.orientation.unlock();
      }
    } catch {}
  };

  const enterFullscreen = useCallback(async () => {
    const container = containerRef.current as FullscreenElement | null;
    const video = videoRef?.current as HTMLVideoElementWithWebKit | null;

    // 1. Standard HTML5 Fullscreen on Container
    if (container) {
      if (container.requestFullscreen) {
        try {
          await container.requestFullscreen();
          await lockOrientation();
          return;
        } catch {}
      }
      if (container.webkitRequestFullscreen) {
        try {
          await container.webkitRequestFullscreen();
          await lockOrientation();
          return;
        } catch {}
      }
      if (container.mozRequestFullScreen) {
        try {
          await container.mozRequestFullScreen();
          await lockOrientation();
          return;
        } catch {}
      }
      if (container.msRequestFullscreen) {
        try {
          await container.msRequestFullscreen();
          await lockOrientation();
          return;
        } catch {}
      }
    }

    // 2. iOS Safari (iPhone) Native Video Fullscreen
    if (video && typeof video.webkitEnterFullscreen === "function") {
      try {
        video.webkitEnterFullscreen();
        return;
      } catch {}
    }

    // 3. Fallback: Pseudo-Fullscreen via CSS (e.g. YouTube iframe on iOS Safari)
    setIsPseudoFullscreen(true);
    setIsFullscreen(true);
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }
  }, [containerRef, videoRef, lockOrientationOnMobile]);

  const exitFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    const video = videoRef?.current as HTMLVideoElementWithWebKit | null;

    unlockOrientation();

    // 1. Standard / Prefixed Exit
    if (doc.exitFullscreen) {
      await doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }

    // 2. iOS Safari Video Exit
    if (video && typeof video.webkitExitFullscreen === "function") {
      video.webkitExitFullscreen();
    }

    // 3. Exit Pseudo-Fullscreen
    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      setIsFullscreen(false);
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    }
  }, [videoRef, isPseudoFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen || isPseudoFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, isPseudoFullscreen, enterFullscreen, exitFullscreen]);

  // Synchronize state with hardware/browser events
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      const active = checkIsFullscreen();
      setIsFullscreen(active);
      if (!active && !isPseudoFullscreen) {
        unlockOrientation();
      }
    };

    // iOS Safari specific video fullscreen events
    const video = videoRef?.current;
    const handleIOSBeginFullscreen = () => setIsFullscreen(true);
    const handleIOSEndFullscreen = () => {
      setIsFullscreen(false);
      unlockOrientation();
    };

    const docEvents = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange",
    ];

    docEvents.forEach((event) => document.addEventListener(event, handleFullscreenChange));

    if (video) {
      video.addEventListener("webkitbeginfullscreen", handleIOSBeginFullscreen);
      video.addEventListener("webkitendfullscreen", handleIOSEndFullscreen);
    }

    return () => {
      docEvents.forEach((event) => document.removeEventListener(event, handleFullscreenChange));
      if (video) {
        video.removeEventListener("webkitbeginfullscreen", handleIOSBeginFullscreen);
        video.removeEventListener("webkitendfullscreen", handleIOSEndFullscreen);
      }
      if (isPseudoFullscreen && typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [checkIsFullscreen, videoRef, isPseudoFullscreen]);

  return {
    isFullscreen: isFullscreen || isPseudoFullscreen,
    isPseudoFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
