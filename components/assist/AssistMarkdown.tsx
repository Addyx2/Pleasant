import Link from "next/link";
import { Fragment, type ReactNode } from "react";

// A deliberately small Markdown subset for Assist's replies: paragraphs,
// bullet and numbered lists, **bold**, `code`, [label](/path) links and bare
// in-app paths like /shifts/abc. Built as React nodes, so model output can
// never inject HTML.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|(?<![\w/])\/(?:shifts|staff|clients|billing|payroll|timesheets|dispatch|rota|compliance|settings|oversight|workforce)(?:\/[\w-]+)*)/g;

function isInternal(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">{part.slice(1, -1)}</code>;
    const md = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (md) {
      return isInternal(md[2]) ? (
        <Link key={key} href={md[2]} className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800">
          {md[1]}
        </Link>
      ) : (
        <span key={key}>{md[1]}</span>
      );
    }
    if (isInternal(part) && /^\/[a-z]/.test(part)) {
      return (
        <Link key={key} href={part} className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800">
          {part}
        </Link>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function AssistMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      const k = `p${blocks.length}`;
      blocks.push(<p key={k}>{inline(paragraph.join(" "), k)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((item, i) => <li key={`${k}-${i}`}>{inline(item, `${k}-${i}`)}</li>);
      blocks.push(
        list.ordered ? (
          <ol key={k} className="list-decimal space-y-1 pl-5">{items}</ol>
        ) : (
          <ul key={k} className="list-disc space-y-1 pl-5 marker:text-slate-300">{items}</ul>
        ),
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else if (heading) {
      flushParagraph();
      flushList();
      const k = `h${blocks.length}`;
      blocks.push(<p key={k} className="font-semibold text-slate-900">{inline(heading[1], k)}</p>);
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();

  return <div className="space-y-2 text-sm leading-relaxed text-slate-700">{blocks}</div>;
}
