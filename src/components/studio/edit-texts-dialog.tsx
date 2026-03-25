"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SLIDE_LABELS = [
  "Slide 1 — Hook",
  "Slide 2 — Problem",
  "Slide 3 — Discovery",
  "Slide 4 — Reveal",
  "Slide 5 — Result",
  "Slide 6 — CTA",
];

interface EditTextsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTexts: string[];
  onSubmit: (texts: string[], feedback: string) => void;
}

export function EditTextsDialog({
  open,
  onOpenChange,
  initialTexts,
  onSubmit,
}: EditTextsDialogProps) {
  const [texts, setTexts] = useState<string[]>(initialTexts);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setTexts(initialTexts);
  }, [initialTexts]);

  const updateText = (index: number, value: string) => {
    setTexts((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setFeedback("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Slide Texts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto py-2">
          {texts.map((text, i) => (
            <div key={i}>
              <Label className="text-xs">{SLIDE_LABELS[i]}</Label>
              <textarea
                value={text}
                onChange={(e) => updateText(i, e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          ))}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">
            Additional feedback (optional)
          </Label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Make it more emotional, change the scene lighting..."
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSubmit(texts, feedback);
              setFeedback("");
            }}
          >
            Regenerate with new texts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
