"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  onSubmit: (texts: string[]) => void;
}

export function EditTextsDialog({ open, onOpenChange, initialTexts, onSubmit }: EditTextsDialogProps) {
  const [texts, setTexts] = useState<string[]>(initialTexts);

  useEffect(() => { setTexts(initialTexts); }, [initialTexts]);

  const updateText = (index: number, value: string) => {
    setTexts((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Slide Texts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(texts)}>Regenerate with new texts</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
