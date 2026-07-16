import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type HeroSlide = {
  id: string;
  image_url: string;
  link_type: string;
  link_value: string | null;
};

const AUTOPLAY_MS = 8000;

function buildHref(slide: HeroSlide): string | null {
  if (slide.link_type === "whatsapp" && slide.link_value) {
    const digits = slide.link_value.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : null;
  }
  if (slide.link_type === "url" && slide.link_value) {
    const v = slide.link_value.trim();
    if (!v) return null;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }
  return null;
}

export function HeroSlider() {
  const { data: slides = [] } = useQuery({
    queryKey: ["hero-slides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_slides")
        .select("id, image_url, link_type, link_value")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HeroSlide[];
    },
  });

  const count = slides.length;
  const extended = count > 1 ? [...slides, slides[0]] : slides;

  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const hoverRef = useRef(false);

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => {
      if (!hoverRef.current) setIndex((i) => i + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [count]);

  function handleTransitionEnd() {
    if (index === count) {
      setAnimate(false);
      setIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimate(true));
      });
    }
  }

  if (count === 0) return null;

  return (
    <div
      className="relative w-full overflow-hidden"
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
    >
      <div
        className="flex"
        style={{
          width: `${extended.length * 100}%`,
          transform: `translateX(-${(index * 100) / extended.length}%)`,
          transition: animate ? "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          willChange: "transform",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {extended.map((slide, i) => {
          const href = buildHref(slide);
          const img = (
            <img
              src={slide.image_url}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
              loading={i === 0 ? "eager" : "lazy"}
            />
          );
          return (
            <div
              key={`${slide.id}-${i}`}
              className="aspect-[5/1] shrink-0"
              style={{ width: `${100 / extended.length}%` }}
            >
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="block h-full w-full">
                  {img}
                </a>
              ) : (
                img
              )}
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => {
                setAnimate(true);
                setIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index % count ? "w-6 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
