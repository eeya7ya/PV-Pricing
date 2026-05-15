# Solar PV Calculator - Professional System Design Tool

## Overview

This is a professional Solar Photovoltaic (PV) system calculator application that provides comprehensive analysis, ROI calculations, and scenario comparison tools for solar energy professionals. The application is based on advanced calculations originally implemented in a PyQt6 desktop application, now modernized with a React frontend and Express backend.

The calculator performs detailed monthly energy analysis considering time-of-day consumption patterns, solar generation factors, and self-consumption ratios to provide accurate system sizing and financial projections. It handles complex scenarios including tariff structures, system degradation, and export revenue calculations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: React hooks with TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Data Visualization**: Chart.js for solar performance graphs and custom SVG gauge components

### Backend Architecture
- **Runtime**: Node.js with Express framework using ESM modules
- **Language**: TypeScript with strict type checking
- **API Design**: RESTful endpoints for solar project CRUD operations
- **Storage Interface**: Abstract storage layer (currently in-memory, designed for database expansion)
- **Validation**: Zod schemas for runtime type validation
- **Development**: Hot reload with Vite integration

### Database Schema Design
- **ORM**: Drizzle with PostgreSQL support configured
- **Schema**: Comprehensive solar project data model preserving all original PyQt6 calculations
- **Data Types**: JSONB for complex nested data (monthly factors, calculation results)
- **Structure**: Single projects table with embedded calculation parameters and results

### Component Architecture
- **Layout**: Sidebar navigation with main content area
- **Form Management**: React Hook Form with Zod resolvers
- **Theme System**: Dark/light mode with CSS custom properties
- **Responsive Design**: Mobile-first approach with collapsible sidebar
- **Calculation Engine**: Client-side computation logic matching original PyQt6 implementation

### Data Flow Pattern
- **Input Collection**: Multi-step forms for consumption data and system parameters
- **Calculation Processing**: Real-time computation with immediate visual feedback
- **Result Presentation**: Dashboard with charts, gauges, and detailed breakdowns
- **Persistence**: Optional project saving with calculation result caching

### Design System
- **Color Palette**: Material Design principles with utility-focused approach
- **Typography**: Inter font family with consistent weight hierarchy
- **Layout System**: Tailwind spacing primitives (2, 4, 6, 8 unit system)
- **Component Variants**: Consistent visual hierarchy across calculation interfaces

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Router (Wouter), TanStack Query
- **UI Libraries**: Radix UI primitives, Lucide React icons, Class Variance Authority
- **Development Tools**: Vite, TypeScript, ESBuild for production builds

### Database and ORM
- **Database**: PostgreSQL via Neon serverless connection
- **ORM**: Drizzle ORM with Drizzle Kit for migrations
- **Validation**: Zod for schema validation and type safety

### Styling and Design
- **CSS Framework**: Tailwind CSS with PostCSS processing
- **Component Styling**: CVA (Class Variance Authority) for component variants
- **Utility Libraries**: clsx, tailwind-merge for conditional styling

### Data Visualization
- **Charting**: Chart.js for line charts and performance visualizations
- **Custom Components**: SVG-based circular gauges and progress indicators

### Development and Build Tools
- **Build System**: Vite with custom configuration for client/server separation
- **Type Checking**: TypeScript with strict mode and path mapping
- **Development**: Express middleware integration with HMR support
- **Error Handling**: Replit error overlay plugin for development

### Utility Libraries
- **Date Handling**: date-fns for date manipulation and formatting
- **Form Management**: React Hook Form with Hookform Resolvers
- **HTTP Client**: Fetch-based API client with TanStack Query integration