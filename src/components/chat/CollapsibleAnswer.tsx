import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { normalizeMarkdown } from "@/utils/normalizeMarkdown";
import type { StructuredResponse, VerifiedLink } from "@/utils/responsePipeline";

interface CollapsibleAnswerProps {
  content: string;
  structured?: StructuredResponse | null;
  compact?: boolean;
}

function LinkRenderer({ href, children }: { href?: string; children?: React.ReactNode }) {
  if (!href) return <span>{children}</span>;
  const isInternal = href.startsWith("/");
  if (isInternal) {
    return (
      <Link to={href} className="text-primary hover:underline inline-flex items-center gap-0.5">
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

function VerifiedLinkChips({ links }: { links: VerifiedLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {links.map((link, i) =>
        link.external ? (
          <a
            key={i}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[11px] rounded-full border border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors inline-flex items-center gap-1"
          >
            {link.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <Link
            key={i}
            to={link.href}
            className="px-2.5 py-1 text-[11px] rounded-full border border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors inline-flex items-center gap-1"
          >
            {link.label}
          </Link>
        )
      )}
    </div>
  );
}

const proseClasses = "prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-p:leading-relaxed prose-headings:mt-2 prose-headings:mb-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0";

export function CollapsibleAnswer({ content, structured, compact }: CollapsibleAnswerProps) {
  const [expanded, setExpanded] = useState(false);

  // Fallback: no structured data, render plain markdown (streaming or legacy)
  if (!structured?.directAnswer) {
    return (
      <div className={`${proseClasses} ${compact ? "text-[13px]" : "text-sm"}`}>
        <ReactMarkdown components={{ a: LinkRenderer }}>
          {normalizeMarkdown(content)}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Direct answer - always visible */}
      <div className={`${proseClasses} ${compact ? "text-[13px]" : "text-sm"}`}>
        <ReactMarkdown components={{ a: LinkRenderer }}>
          {normalizeMarkdown(structured.directAnswer)}
        </ReactMarkdown>
      </div>

      {/* Supporting detail - collapsible */}
      {structured.supportingDetail && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 mt-1"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Minder" : "Meer achtergrond"}
          </button>
          {expanded && (
            <div className={`mt-1.5 pl-2 border-l-2 border-border ${proseClasses} ${compact ? "text-[12px]" : "text-[13px]"}`}>
              <ReactMarkdown components={{ a: LinkRenderer }}>
                {normalizeMarkdown(structured.supportingDetail)}
              </ReactMarkdown>
              {structured.verifiedLinks && <VerifiedLinkChips links={structured.verifiedLinks} />}
            </div>
          )}
        </div>
      )}

      {/* Links shown outside collapsed area if no supporting detail */}
      {!structured.supportingDetail && structured.verifiedLinks && (
        <VerifiedLinkChips links={structured.verifiedLinks} />
      )}
    </div>
  );
}
