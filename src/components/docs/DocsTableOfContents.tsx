import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface DocsTableOfContentsProps {
  content: string;
  activeSection?: string;
  onSectionClick: (sectionId: string) => void;
}

export function DocsTableOfContents({ 
  content, 
  activeSection,
  onSectionClick 
}: DocsTableOfContentsProps) {
  const headings = useMemo(() => {
    const items: TocItem[] = [];
    const lines = content.split("\n");
    
    for (const line of lines) {
      const h2Match = line.match(/^## (.+)$/);
      const h3Match = line.match(/^### (.+)$/);
      
      if (h2Match) {
        const text = h2Match[1].replace(/[*_`]/g, "");
        items.push({
          id: generateId(text),
          text,
          level: 2,
        });
      } else if (h3Match) {
        const text = h3Match[1].replace(/[*_`]/g, "");
        items.push({
          id: generateId(text),
          text,
          level: 3,
        });
      }
    }
    
    return items;
  }, [content]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className="space-y-1">
      <h4 className="font-semibold text-sm text-foreground mb-3">On this page</h4>
      {headings.map((heading) => (
        <button
          key={heading.id}
          onClick={() => onSectionClick(heading.id)}
          className={cn(
            "block w-full text-left text-sm py-1 transition-colors",
            heading.level === 3 && "pl-3",
            activeSection === heading.id
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );
}

function generateId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}
