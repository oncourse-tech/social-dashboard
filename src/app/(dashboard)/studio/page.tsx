import Link from "next/link";
import { Images, Video, MessageSquare } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FORMATS = [
  {
    id: "slideshows",
    title: "Slideshows",
    description: "6-slide photorealistic stories for TikTok",
    icon: Images,
    href: "/studio/slideshows",
    status: "active" as const,
  },
  {
    id: "ugc-hooks",
    title: "UGC Hooks",
    description: "Reaction videos with app screen reveals",
    icon: MessageSquare,
    href: null,
    status: "coming-soon" as const,
  },
  {
    id: "videos",
    title: "Videos",
    description: "Animated social media videos via Remotion",
    icon: Video,
    href: null,
    status: "coming-soon" as const,
  },
];

export default function StudioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
        <p className="text-muted-foreground">Create content for your social channels</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FORMATS.map((format) => {
          const Icon = format.icon;
          const isActive = format.status === "active";

          const card = (
            <Card
              key={format.id}
              className={
                isActive
                  ? "cursor-pointer transition-colors hover:border-primary/50"
                  : "opacity-50 cursor-not-allowed"
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon className="size-8 text-muted-foreground" />
                  <Badge variant={isActive ? "default" : "secondary"}>
                    {isActive ? "Active" : "Coming Soon"}
                  </Badge>
                </div>
                <CardTitle className="mt-3">{format.title}</CardTitle>
                <CardDescription>{format.description}</CardDescription>
              </CardHeader>
            </Card>
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
