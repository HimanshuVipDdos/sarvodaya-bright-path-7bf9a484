import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/section";
import { SITE } from "@/lib/site";
import { GraduationCap, Target, Heart, Sparkles } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About — ${SITE.name}` },
      { name: "description", content: `About ${SITE.name}, founded by ${SITE.owner} in Kasganj, UP.` },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <Section
      eyebrow="Our story"
      title={`Built in Kasganj. For aspirants across India.`}
      description={`${SITE.name} was founded by ${SITE.owner} with one mission — to make disciplined, high-quality competitive exam coaching accessible to every aspirant.`}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { icon: GraduationCap, title: "Mission", text: "Make every student exam-ready with structured concept building, daily practice and consistent mentorship." },
          { icon: Target, title: "Focus", text: "UP-level and central competitive exams — Police, SSC, Banking, Railway, Teaching, UPSC/UPPSC." },
          { icon: Heart, title: "Values", text: "Discipline, honesty and student-first teaching. We treat your career like our own." },
          { icon: Sparkles, title: "Approach", text: "Live classes + recorded lectures + DPP + mock tests + 1:1 doubt solving." },
        ].map((c) => (
          <div key={c.title} className="glass-strong rounded-3xl p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow">
              <c.icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{c.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
