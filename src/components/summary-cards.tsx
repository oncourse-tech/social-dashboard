import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type SummaryCardItem = {
  label: string;
  value: number;
  icon?: React.ReactNode;
  highlight?: string;
  textValue?: string;
  suffix?: string;
};

export function SummaryCards({ items }: { items: SummaryCardItem[] }) {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardContent className="flex items-center gap-3">
            {item.icon && (
              <div className="text-muted-foreground">{item.icon}</div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  item.highlight ? `text-[${item.highlight}]` : ""
                )}
                style={item.highlight ? { color: item.highlight } : undefined}
              >
                {item.textValue
                  ? item.textValue
                  : `${formatNumber(item.value)}${item.suffix ?? ""}`}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
