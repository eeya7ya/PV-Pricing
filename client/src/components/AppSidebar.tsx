import { useState } from 'react';
import { Calculator, BarChart3, TrendingUp, GitCompare, HelpCircle, Users, Sun, ChevronRight, LayoutGrid } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin?: boolean;
}

// Everything related to designing / analysing a system lives behind a single
// collapsible group so the sidebar stays compact.
const designItems = [
  { title: 'System Designer', url: 'designer', icon: Calculator },
  { title: 'PV Design', url: 'pv-design', icon: Sun },
  { title: 'Dashboard', url: 'dashboard', icon: BarChart3 },
  { title: 'Analysis', url: 'analysis', icon: TrendingUp },
  { title: 'Comparison', url: 'comparison', icon: GitCompare },
];

const standaloneItems = [
  { title: 'Help', url: 'help', icon: HelpCircle, adminOnly: false },
  { title: 'User Management', url: 'users', icon: Users, adminOnly: true },
];

export default function AppSidebar({ activeTab, onTabChange, isAdmin = false }: AppSidebarProps) {
  const designActive = designItems.some((item) => item.url === activeTab);
  const [designOpen, setDesignOpen] = useState(true);

  const visibleStandalone = standaloneItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <img
            src="/espark-logo.png"
            alt="eSpark"
            className="h-9 w-9 rounded-md object-contain"
            data-testid="img-sidebar-logo"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">eSpark PV Calculator</span>
            <span className="text-[11px] text-muted-foreground">Created by ENG.Yahya-Khaleld</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Collapsible "System Design" parent — holds all design / analysis tabs */}
              <Collapsible
                open={designOpen || designActive}
                onOpenChange={setDesignOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={designActive}
                      data-testid="nav-system-design"
                      className="group transition-colors duration-200 hover:bg-orange-500/10 data-[active=true]:bg-orange-500/15 data-[active=true]:text-orange-200"
                    >
                      <LayoutGrid className="h-5 w-5" />
                      <span className="font-medium">System Design</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {designItems.map((item) => (
                        <SidebarMenuSubItem key={item.url}>
                          <SidebarMenuSubButton
                            onClick={() => onTabChange(item.url)}
                            isActive={activeTab === item.url}
                            data-testid={`nav-${item.url}`}
                            className="cursor-pointer transition-colors duration-200 hover:bg-orange-500/10 data-[active=true]:bg-gradient-to-r data-[active=true]:from-orange-500/20 data-[active=true]:to-amber-500/15 data-[active=true]:text-orange-200"
                          >
                            <item.icon
                              className={`h-4 w-4 ${activeTab === item.url ? 'text-orange-400' : ''}`}
                            />
                            <span>{item.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Standalone items */}
              {visibleStandalone.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    onClick={() => onTabChange(item.url)}
                    isActive={activeTab === item.url}
                    data-testid={`nav-${item.url}`}
                    className="group transition-colors duration-200 hover:bg-orange-500/10 data-[active=true]:bg-orange-500/15 data-[active=true]:text-orange-200"
                  >
                    <item.icon
                      className={`h-5 w-5 ${activeTab === item.url ? 'text-orange-400' : ''}`}
                    />
                    <span className="font-medium">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
