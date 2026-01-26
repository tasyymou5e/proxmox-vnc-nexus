import { cn } from "@/lib/utils";
import { 
  BookOpen, 
  FileText, 
  Shield, 
  GitBranch, 
  Settings, 
  HelpCircle,
  Code2,
  Users
} from "lucide-react";

export interface DocItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  filename: string;
}

export const DOCS_LIST: DocItem[] = [
  {
    id: "readme",
    title: "Overview",
    description: "Project overview and quick start",
    icon: BookOpen,
    filename: "README.md",
  },
  {
    id: "architecture",
    title: "Architecture",
    description: "System design and data flow",
    icon: GitBranch,
    filename: "ARCHITECTURE.md",
  },
  {
    id: "api",
    title: "API Reference",
    description: "Edge function documentation",
    icon: Code2,
    filename: "API.md",
  },
  {
    id: "deployment",
    title: "Deployment",
    description: "Production deployment guide",
    icon: Settings,
    filename: "DEPLOYMENT.md",
  },
  {
    id: "security",
    title: "Security",
    description: "Security model and best practices",
    icon: Shield,
    filename: "SECURITY.md",
  },
  {
    id: "contributing",
    title: "Contributing",
    description: "Development guidelines",
    icon: Users,
    filename: "CONTRIBUTING.md",
  },
  {
    id: "changelog",
    title: "Changelog",
    description: "Version history",
    icon: FileText,
    filename: "CHANGELOG.md",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    description: "Common issues and solutions",
    icon: HelpCircle,
    filename: "TROUBLESHOOTING.md",
  },
];

interface DocsSidebarProps {
  activeDoc: string;
  onSelectDoc: (docId: string) => void;
}

export function DocsSidebar({ activeDoc, onSelectDoc }: DocsSidebarProps) {
  return (
    <nav className="space-y-1">
      {DOCS_LIST.map((doc) => {
        const Icon = doc.icon;
        const isActive = activeDoc === doc.id;
        
        return (
          <button
            key={doc.id}
            onClick={() => onSelectDoc(doc.id)}
            className={cn(
              "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
              isActive 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn(
              "h-5 w-5 mt-0.5 shrink-0",
              isActive ? "text-primary" : "text-muted-foreground"
            )} />
            <div className="min-w-0">
              <div className={cn(
                "font-medium text-sm",
                isActive && "text-primary"
              )}>
                {doc.title}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {doc.description}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
