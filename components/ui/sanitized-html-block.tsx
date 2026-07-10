"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "a",
    "img",
    "span",
    "div",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
    "sup",
    "sub",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "class", "style", "width", "height", "align"],
  ALLOW_DATA_ATTR: false,
};

export function isLikelyHtml(s: string): boolean {
  if (!s) return false;
  return /<[a-z][\s\S]*?>/i.test(s);
}

type SanitizedHtmlBlockProps = {
  html: string;
  className?: string;
  /** Wrapper for non-HTML plain text */
  plainClassName?: string;
};

/**
 * Renders stored question/rich copy: plain text as text, HTML after DOMPurify (client).
 */
export function SanitizedHtmlBlock({ html, className, plainClassName }: SanitizedHtmlBlockProps) {
  const [sanitized, setSanitized] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLikelyHtml(html)) {
      setSanitized("");
      return;
    }
    setSanitized(DOMPurify.sanitize(html, SANITIZE_CONFIG));
  }, [html]);

  if (!html) return null;

  if (!isLikelyHtml(html)) {
    return <div className={plainClassName}>{html}</div>;
  }

  if (!sanitized) {
    return <div className={cn("text-muted-foreground text-sm", className)} aria-hidden />;
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert [&_table]:border-collapse [&_td]:border [&_th]:border [&_td]:p-2 [&_th]:p-2",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
