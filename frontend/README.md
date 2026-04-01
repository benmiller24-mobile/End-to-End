# Eclipse Kitchen Designer - React Frontend

A modern, full-featured React SPA for the Eclipse Kitchen Designer constraint-based layout engine.

## Features

- **Supabase Authentication** - Sign up / sign in with email
- **Room Configuration** - Select layout type, room type, walls, and appliances
- **Material Selection** - Choose species, door style, and cabinet construction
- **Solver Integration** - Run layout solver and view results
- **Quote Generation** - Get detailed pricing with line items
- **Template Gallery** - Start from pre-configured room templates
- **Dark Theme UI** - Modern, accessible dark mode design

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Supabase:
   - Copy `.env.example` to `.env.local`
   - Update with your Supabase project URL and anon key
   - See https://supabase.com for project setup

3. Start development server:
```bash
npm run dev
```

Server runs on `http://localhost:5173` by default.

## Build

```bash
npm run build
npm run preview
```

Output is built to `../dist` for deployment.

## Architecture

- **src/App.jsx** - Single-file main app with all components (Auth, Designer, Results, Templates)
- **src/main.jsx** - React entry point
- **src/lib/supabase.js** - Supabase client initialization
- **vite.config.js** - Proxies `/api/*` to backend at `http://localhost:8888`
- **index.html** - Entry HTML with Google Fonts (Inter)

## API Endpoints

The frontend proxies requests to the backend at `http://localhost:8888`:

- `POST /api/solve` - Solve layout (returns layout placements)
- `POST /api/quote` - Generate full quote with pricing
- `GET /api/templates` - List available templates
- `POST /api/templates` - Load template by ID

## Components

- **Auth** - Supabase sign-in/sign-up form
- **WallEditor** - Add/edit/delete walls with roles
- **ApplianceEditor** - Configure appliances on walls
- **ResultsView** - Display solver output, layout visualization, quote table
- **TemplatePicker** - Browse and select room templates
- **App** - Main container with routing and state management

## Styling

All styling is done with inline styles using a centralized color scheme (COLORS object). No external CSS files needed.

## Color Scheme

- Background: `#0f172a` (slate-950)
- Surface: `#1e293b` (slate-800)
- Primary: `#3b82f6` (blue-500)
- Accent: `#10b981` (emerald-500)
- Danger: `#ef4444` (red-500)
- Text: `#f1f5f9` (slate-100)

## Requirements

- Node 18+
- React 18
- Vite 5
- Supabase JS SDK 2.39+

