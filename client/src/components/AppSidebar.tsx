import { SlidersHorizontal, BarChart3, HelpCircle, Users } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

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
                          ? 'text-orange-200 dark:text-orange-100 font-semibold' 
                          : 'group-hover:text-orange-400 dark:group-hover:text-orange-200'
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
    </Sidebar>
  );
}