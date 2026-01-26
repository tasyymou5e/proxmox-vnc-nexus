import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  MarkdownRenderer, 
  DocsSidebar, 
  DocsTableOfContents,
  DOCS_LIST 
} from "@/components/docs";
import { DOCS_CONTENT } from "@/lib/docsContent";
import { 
  BookOpen, 
  Search, 
  Menu,
  X,
  ArrowLeft,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Docs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string>();
  
  const activeDocId = searchParams.get("doc") || "readme";
  const activeDoc = DOCS_LIST.find(d => d.id === activeDocId) || DOCS_LIST[0];
  const content = DOCS_CONTENT[activeDocId] || "# Document Not Found\n\nThe requested documentation could not be found.";

  // Get current doc index for prev/next navigation
  const currentIndex = DOCS_LIST.findIndex(d => d.id === activeDocId);
  const prevDoc = currentIndex > 0 ? DOCS_LIST[currentIndex - 1] : null;
  const nextDoc = currentIndex < DOCS_LIST.length - 1 ? DOCS_LIST[currentIndex + 1] : null;

  const handleSelectDoc = useCallback((docId: string) => {
    setSearchParams({ doc: docId });
    setActiveSection(undefined);
    // Scroll to top
    document.querySelector(".docs-content")?.scrollTo(0, 0);
  }, [setSearchParams]);

  const handleSectionClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Filter docs based on search
  const filteredDocs = searchQuery
    ? DOCS_LIST.filter(doc => 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        DOCS_CONTENT[doc.id]?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : DOCS_LIST;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && e.altKey && prevDoc) {
        handleSelectDoc(prevDoc.id);
      } else if (e.key === "ArrowRight" && e.altKey && nextDoc) {
        handleSelectDoc(nextDoc.id);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevDoc, nextDoc, handleSelectDoc]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 lg:hidden"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-lg">Documentation</h1>
          </div>

          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <Button variant="outline" size="sm" asChild>
            <a 
              href="https://pve.proxmox.com/pve-docs/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Proxmox Docs</span>
            </a>
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside 
          className={cn(
            "fixed lg:sticky top-14 z-40 h-[calc(100vh-3.5rem)] w-72 shrink-0 border-r bg-background transition-transform lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <ScrollArea className="h-full py-4 px-3">
            {searchQuery ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground px-3 mb-2">
                  {filteredDocs.length} results for "{searchQuery}"
                </p>
                <DocsSidebar 
                  activeDoc={activeDocId} 
                  onSelectDoc={(id) => {
                    handleSelectDoc(id);
                    setSearchQuery("");
                  }} 
                />
              </div>
            ) : (
              <DocsSidebar 
                activeDoc={activeDocId} 
                onSelectDoc={handleSelectDoc} 
              />
            )}
          </ScrollArea>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <span>Docs</span>
              <span>/</span>
              <span className="text-foreground font-medium">{activeDoc.title}</span>
            </div>

            {/* Content */}
            <Card className="border-0 shadow-none">
              <CardContent className="p-0 docs-content">
                <MarkdownRenderer content={content} />
              </CardContent>
            </Card>

            {/* Prev/Next Navigation */}
            <div className="flex items-center justify-between mt-12 pt-6 border-t">
              {prevDoc ? (
                <Button
                  variant="ghost"
                  onClick={() => handleSelectDoc(prevDoc.id)}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <div className="text-left">
                    <div className="text-xs text-muted-foreground">Previous</div>
                    <div className="font-medium">{prevDoc.title}</div>
                  </div>
                </Button>
              ) : <div />}
              
              {nextDoc ? (
                <Button
                  variant="ghost"
                  onClick={() => handleSelectDoc(nextDoc.id)}
                  className="flex items-center gap-2"
                >
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Next</div>
                    <div className="font-medium">{nextDoc.title}</div>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : <div />}
            </div>
          </div>
        </main>

        {/* Table of Contents */}
        <aside className="hidden xl:block w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]">
          <ScrollArea className="h-full py-8 px-4">
            <DocsTableOfContents 
              content={content}
              activeSection={activeSection}
              onSectionClick={handleSectionClick}
            />
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
