import { useState } from 'react';
import { SlidersHorizontal, BarChart3, HelpCircle, Users, FolderClock, Compass } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import LegalDialog, { type LegalDoc } from '@/components/LegalDialog';

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin?: boolean;
}

const items = [
  {
    title: 'Inputs',
    url: 'inputs',
    icon: SlidersHorizontal,
    description: 'All design inputs — consumption, tariff, PV design and electrical BoS'
  },
  {
    title: 'Results',
    url: 'results',
    icon: BarChart3,
    description: 'Performance, PV yield, electrical sizing and the before/after comparison'
  },
  {
    title: 'Saved Cases',
    url: 'cases',
    icon: FolderClock,
    description: 'Save your study cases and reopen previous ones'
  },
  {
    title: 'Guide',
    url: 'guide',
    icon: Compass,
    description: 'How to use the app — a quick step-by-step walkthrough'
  },
  {
    title: 'Help',
    url: 'help',
    icon: HelpCircle,
    description: 'Equations, parameters and documentation'
  },
  {
    title: 'User Management',
    url: 'users',
    icon: Users,
    description: 'Create and manage user accounts',
    adminOnly: true
  }
];

export default function AppSidebar({ activeTab, onTabChange, isAdmin = false }: AppSidebarProps) {
  const visibleItems = items.filter(item => !item.adminOnly || isAdmin);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>eSpark Solar Calculator</SidebarGroupLabel>
          <div className="px-3 pb-2">
            <p className="text-xs text-muted-foreground/90 font-medium tracking-wide" data-testid="text-credits-sidebar">
              Created by ENG.Yahya-Khaleld
            </p>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    onClick={() => onTabChange(item.url)}
                    isActive={activeTab === item.url}
                    data-testid={`nav-${item.url}`}
                    className="group flex flex-col items-start gap-1 h-auto py-3 border border-transparent transition-all duration-300 hover:bg-orange-500/10 hover:border-orange-500/20 data-[active=true]:bg-gradient-to-r data-[active=true]:from-orange-500/20 data-[active=true]:to-amber-500/15 data-[active=true]:border-orange-500/30 data-[active=true]:shadow-lg data-[active=true]:shadow-orange-500/10"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`h-5 w-5 transition-colors duration-300 ${
                        activeTab === item.url 
                          ? 'text-orange-500 drop-shadow-sm' 
                          : 'group-hover:text-orange-400'
                      }`} />
                      <span className={`font-medium transition-colors duration-300 ${
                        activeTab === item.url
                          ? 'text-orange-700 dark:text-orange-100 font-semibold'
                          : 'text-foreground/80 group-hover:text-orange-600 dark:group-hover:text-orange-200'
                      }`}>{item.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground text-left">
                      {item.description}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-1 px-3 pb-3">
        <p className="text-xs font-medium text-muted-foreground" data-testid="text-version">
          v1.0A · Beta version
        </p>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 flex-wrap">
          <button
            type="button"
            onClick={() => setLegalDoc('terms')}
            className="hover:text-orange-500 hover:underline transition-colors"
            data-testid="link-terms"
          >
            Terms &amp; Conditions
          </button>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => setLegalDoc('privacy')}
            className="hover:text-orange-500 hover:underline transition-colors"
            data-testid="link-privacy"
          >
            Privacy Policy
          </button>
        </div>
      </SidebarFooter>

      <LegalDialog doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </Sidebar>
  );
}