import Link from "next/link";
import { Images, Video, MessageSquare, ArrowRight } from "lucide-react";

const FORMATS = [
  {
    id: "slideshows",
    title: "Slideshows",
    description: "6-slide photorealistic stories for TikTok & Reels",
    icon: Images,
    href: "/studio/slideshows",
    status: "active" as const,
    accent: "from-indigo-500/20 to-violet-500/20",
    iconColor: "text-indigo-400",
    ringColor: "ring-indigo-500/10",
  },
  {
    id: "ugc-hooks",
    title: "UGC Hooks",
    description: "Reaction videos with app screen reveals",
    icon: MessageSquare,
    href: null,
    status: "coming-soon" as const,
    accent: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400",
    ringColor: "ring-amber-500/10",
  },
  {
    id: "videos",
    title: "Videos",
    description: "Animated social media videos via Remotion",
    icon: Video,
    href: null,
    status: "coming-soon" as const,
    accent: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
    ringColor: "ring-emerald-500/10",
  },
];

export default function StudioPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create content for your social channels
        </p>
      </div>

      <div className="space-y-3">
        {FORMATS.map((format) => {
          const Icon = format.icon;
          const isActive = format.status === "active";

          const card = (
            <div
              key={format.id}
              className={`group relative flex items-center gap-4 rounded-xl border border-border/60 p-4 transition-all ${
                isActive
                  ? "hover:border-border hover:bg-muted/30 cursor-pointer"
                  : "opacity-40 cursor-not-allowed"
              }`}
            >
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${format.accent} ring-1 ${format.ringColor}`}
              >
                <Icon className={`size-5 ${format.iconColor}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{format.title}</h3>
                  {!isActive && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Soon
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {format.description}
                </p>
              </div>

              {isActive && (
                <ArrowRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/60 shrink-0" />
              )}
            </div>
          );

          if (isActive && format.href) {
            return (
              <Link key={format.id} href={format.href}>
                {card}
              </Link>
            );
          }
          return <div key={format.id}>{card}</div>;
        })}
      </div>
    </div>
  );
}
