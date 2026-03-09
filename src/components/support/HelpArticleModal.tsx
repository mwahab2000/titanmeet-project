import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { HelpArticle } from "./HelpArticleContent";

interface HelpArticleModalProps {
  article: HelpArticle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Minimal markdown-to-JSX renderer for help articles */
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let key = 0;

  const flush = () => {
    if (!inTable || tableRows.length === 0) return;
    const [header, ...body] = tableRows;
    elements.push(
      <div key={key++} className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {header.map((h, i) => (
                <th
                  key={i}
                  className="text-left px-3 py-2 border-b border-border font-semibold text-foreground"
                >
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className="even:bg-muted/40">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 border-b border-border text-muted-foreground">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table row
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      // Skip separator rows like |---|---|
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        inTable = true;
        continue;
      }
      if (!inTable && tableRows.length === 0) {
        // first header row
        tableRows.push(cells);
        continue;
      }
      inTable = true;
      tableRows.push(cells);
      continue;
    }

    flush();

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="text-lg font-bold text-foreground mt-6 mb-2">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="text-base font-semibold text-foreground mt-5 mb-1.5">
          {line.slice(4)}
        </h3>
      );
    } else if (/^[0-9]+\.\s/.test(line.trim())) {
      elements.push(
        <p key={key++} className="text-sm text-muted-foreground ml-4 mb-1">
          {renderInline(line.trim())}
        </p>
      );
    } else if (line.trim().startsWith("- ")) {
      elements.push(
        <p key={key++} className="text-sm text-muted-foreground ml-4 mb-1 flex gap-1.5">
          <span className="shrink-0">•</span>
          <span>{renderInline(line.trim().slice(2))}</span>
        </p>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(
        <p key={key++} className="text-sm text-muted-foreground mb-1">
          {renderInline(line)}
        </p>
      );
    }
  }
  flush();

  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Bold + code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-muted text-xs font-mono text-foreground">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function HelpArticleModal({ article, open, onOpenChange }: HelpArticleModalProps) {
  if (!article) return null;

  const Icon = article.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">{article.title}</DialogTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 mt-1">
                {article.readTime} read
              </Badge>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="pt-2 pb-4">{renderMarkdown(article.content)}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
