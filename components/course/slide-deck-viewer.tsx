"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Printer } from "lucide-react";

interface SlideDeckViewerProps {
  slideImages: string[];
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function buildSlidePrintDocument(slideImages: string[]): string {
  const pages: string[] = [];
  for (let i = 0; i < slideImages.length; i += 2) {
    const pair = slideImages.slice(i, i + 2);
    const imgs = pair
      .map(
        (url, j) =>
          `<img src="${escapeHtmlAttr(url)}" alt="Slide ${i + j + 1}" />`
      )
      .join("");
    const singleClass = pair.length === 1 ? " page--single" : "";
    pages.push(`<div class="page${singleClass}">${imgs}</div>`);
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Slides</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; }
      .page {
        display: grid;
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 12px;
        width: 100%;
        min-height: 100vh;
        height: 100vh;
        align-items: center;
        justify-items: center;
        padding: 0.25in;
        page-break-after: always;
        break-after: page;
      }
      .page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .page--single {
        grid-template-rows: 1fr;
      }
      .page--single img {
        max-height: 50%;
      }
      .page img {
        width: 100%;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      @page {
        size: portrait;
        margin: 0.25in;
      }
    </style>
  </head>
  <body>
    ${pages.join("\n")}
  </body>
</html>`;
}

function printSlideDeck(slideImages: string[]) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  iframe.srcdoc = buildSlidePrintDocument(slideImages);

  iframe.onload = () => {
    const doc = iframe.contentDocument;
    const printWindow = iframe.contentWindow;
    if (!doc || !printWindow) {
      iframe.remove();
      return;
    }

    const imgs = Array.from(doc.querySelectorAll("img"));
    if (imgs.length === 0) {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => iframe.remove(), 1000);
      return;
    }

    let pending = imgs.length;
    const tryPrint = () => {
      pending -= 1;
      if (pending === 0) {
        printWindow.focus();
        printWindow.print();
        setTimeout(() => iframe.remove(), 1000);
      }
    };

    imgs.forEach((img) => {
      if (img.complete) tryPrint();
      else {
        img.addEventListener("load", tryPrint, { once: true });
        img.addEventListener("error", tryPrint, { once: true });
      }
    });
  };

  document.body.appendChild(iframe);
}

export function SlideDeckViewer({ slideImages }: SlideDeckViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const total = slideImages.length;

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < total) setCurrentIndex(index);
    },
    [total]
  );

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext]);

  if (total === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No slides available for this module.</p>
        </CardContent>
      </Card>
    );
  }

  const slideContent = (
    <>
      <div
        className={`relative bg-black flex items-center justify-center ${
          isFullscreen ? "flex-1 min-h-0" : "aspect-[16/9]"
        } rounded-lg overflow-hidden`}
      >
        <img
          src={slideImages[currentIndex]}
          alt={`Slide ${currentIndex + 1} of ${total}`}
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />

        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="absolute left-0 top-0 h-full w-1/5 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition-opacity disabled:pointer-events-none"
          aria-label="Previous slide"
        >
          <span className="bg-black/50 text-white rounded-full p-2">
            <ChevronLeft className="h-6 w-6" />
          </span>
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === total - 1}
          className="absolute right-0 top-0 h-full w-1/5 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity disabled:pointer-events-none"
          aria-label="Next slide"
        >
          <span className="bg-black/50 text-white rounded-full p-2">
            <ChevronRight className="h-6 w-6" />
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center gap-3">
          <Select value={currentIndex.toString()} onValueChange={(v) => goTo(Number(v))}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {slideImages.map((_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  Slide {i + 1} / {total}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen((f) => !f)}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={goNext} disabled={currentIndex === total - 1}>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-200"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => printSlideDeck(slideImages)}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>
    </>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col gap-4 p-4">
        {slideContent}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">{slideContent}</CardContent>
    </Card>
  );
}
