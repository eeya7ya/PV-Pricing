# Solar PV Calculator Design Guidelines

## Design Approach
**Utility-Focused Design System Approach** - Using Material Design principles for a data-heavy, calculation-focused application that prioritizes functionality and clear information hierarchy.

## Core Design Elements

### Color Palette
**Primary Colors:**
- Light mode: 37 92% 50% (vibrant blue for trust and technology)
- Dark mode: 220 15% 20% (deep charcoal background)
- Dark mode cards: 220 15% 25% (elevated surfaces)

**Accent Colors:**
- Success/positive: 142 76% 36% (green for energy efficiency)
- Warning: 43 96% 56% (amber for attention)
- Text primary (dark): 220 15% 95%
- Text secondary (dark): 220 10% 70%

### Typography
**Font System:** Inter via Google Fonts
- Headers: 600 weight, sizes from text-xl to text-3xl
- Body: 400 weight, text-sm to text-base
- Data displays: 500 weight for emphasis

### Layout System
**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 and p-6
- Section margins: m-4 and m-8
- Grid gaps: gap-4 and gap-6

### Component Library

**Dashboard Layout:**
- Sidebar navigation with calculation categories
- Main content area with card-based sections
- Responsive grid system (1-2-3 column layouts)

**Core Components:**
- Input cards with labeled form controls
- Result display cards with prominent value typography
- Chart containers with subtle borders and shadows
- Navigation tabs with active state indicators
- Time factor widgets with monthly input grids

**Data Visualization:**
- Chart.js integration for solar performance graphs
- Gauge components for efficiency metrics
- Progress bars for capacity indicators
- Color-coded result summaries

**Form Elements:**
- Consistent input styling with focus states
- Grouped controls within card boundaries
- Real-time validation feedback
- Clear labels and helper text

### Visual Hierarchy
- Card elevation using subtle shadows
- Consistent border radius (rounded-lg)
- Strategic use of background colors for grouping
- Bold typography for calculation results
- Muted colors for secondary information

### Responsive Behavior
- Mobile-first approach with stacked layouts
- Collapsible sidebar navigation
- Touch-friendly input controls
- Readable text sizing across devices

## Key Design Principles
1. **Clarity First:** Prioritize calculation visibility and input clarity
2. **Consistent Spacing:** Maintain rhythm with limited spacing scale
3. **Professional Aesthetic:** Clean, technical appearance suitable for solar professionals
4. **Dark Mode Default:** Energy-conscious theme with optional light mode
5. **Data-Driven:** Visual emphasis on numerical results and charts