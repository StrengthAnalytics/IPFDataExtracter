# Next.js Migration Guide

> **Purpose**: Complete roadmap for porting this Vite + React application to Next.js 14+ with App Router. Designed for AI assistants (Claude) and developers.

## Table of Contents
- [Migration Overview](#migration-overview)
- [Architecture Changes](#architecture-changes)
- [Component Migration](#component-migration)
- [API Routes](#api-routes)
- [Data Fetching Patterns](#data-fetching-patterns)
- [Performance Optimizations](#performance-optimizations)
- [Step-by-Step Migration](#step-by-step-migration)
- [Testing Strategy](#testing-strategy)

---

## Migration Overview

### Why Next.js?

**Current (Vite + React):**
- ✅ Fast development
- ✅ Simple deployment
- ❌ Client-side only (slow initial load)
- ❌ No SEO optimization
- ❌ No server-side data fetching

**Future (Next.js):**
- ✅ Server-Side Rendering (SSR)
- ✅ Static Site Generation (SSG)
- ✅ API Routes (backend logic)
- ✅ SEO-friendly
- ✅ Better performance
- ✅ Edge deployment

### Migration Scope

| Component | Current | Next.js | Strategy |
|-----------|---------|---------|----------|
| Routing | React Router | App Router | Convert to file-based routing |
| Data Fetching | Client-side | Server Components | Use async components |
| API Layer | Direct Supabase | API Routes | Create `/api` routes |
| Styling | Tailwind | Tailwind | No changes needed |
| State | useState/useEffect | Server state + client hooks | Hybrid approach |

---

## Architecture Changes

### Current Architecture (Vite)

```
Browser → React Components → Supabase Client → PostgreSQL
```

### Next.js Architecture

```
Browser → Next.js Server → API Routes → Supabase → PostgreSQL
         ↓
      Server Components (RSC)
         ↓
      Client Components (interactive)
```

### Directory Structure Comparison

#### Current (Vite)
```
src/
├── components/
├── pages/
├── services/
├── types/
├── config/
└── App.tsx
```

#### Next.js (App Router)
```
app/
├── (routes)/
│   ├── page.tsx                    # Home page
│   ├── scout/
│   │   └── page.tsx                # Scout page
│   └── lifter/
│       └── [name]/
│           └── page.tsx            # Dynamic lifter profile
├── api/
│   ├── search/
│   │   └── route.ts                # API: Search lifters
│   ├── lifters/
│   │   └── [name]/
│   │       └── route.ts            # API: Get lifter profile
│   └── compare/
│       └── route.ts                # API: Compare lifters
├── components/
│   ├── LifterSearch.tsx            # Client component
│   └── ComparisonTable.tsx         # Client component
└── lib/
    ├── supabase.ts                 # Supabase client (server)
    ├── supabaseClient.ts           # Supabase client (browser)
    └── types.ts                    # Shared types
```

---

## Component Migration

### 1. Pages → App Router Routes

#### Scout Page

**Current:** `src/pages/Scout.tsx`
**Next.js:** `app/scout/page.tsx`

**Before (Vite):**
```typescript
// src/pages/Scout.tsx
import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function Scout() {
  const [lifters, setLifters] = useState<string[]>([]);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (lifters.length >= 2) {
      api.compareLifters(lifters).then(setData);
    }
  }, [lifters]);

  return <div>...</div>;
}
```

**After (Next.js - Client Component):**
```typescript
// app/scout/page.tsx
'use client'; // Mark as client component

import { useState, useEffect } from 'react';

export default function ScoutPage() {
  const [lifters, setLifters] = useState<string[]>([]);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (lifters.length >= 2) {
      // Call Next.js API route
      fetch('/api/compare', {
        method: 'POST',
        body: JSON.stringify({ lifters })
      })
        .then(res => res.json())
        .then(setData);
    }
  }, [lifters]);

  return <div>...</div>;
}
```

**OR (Next.js - Server Component with Client Island):**
```typescript
// app/scout/page.tsx (Server Component)
import { ScoutClient } from '@/components/ScoutClient';

export default async function ScoutPage() {
  // Can do server-side data fetching here
  const weightClasses = await getWeightClasses(); // Server-side

  return <ScoutClient weightClasses={weightClasses} />;
}

// components/ScoutClient.tsx (Client Component)
'use client';

import { useState } from 'react';

export function ScoutClient({ weightClasses }: Props) {
  const [lifters, setLifters] = useState<string[]>([]);
  // ... interactive logic
}
```

#### Lifter Profile Page

**Current:** `src/pages/LifterProfile.tsx` (uses `useParams`)
**Next.js:** `app/lifter/[name]/page.tsx` (uses params prop)

**Before (Vite):**
```typescript
// src/pages/LifterProfile.tsx
import { useParams } from 'react-router-dom';

export function LifterProfile() {
  const { name } = useParams<{ name: string }>();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.getLifterProfile(name!).then(setProfile);
  }, [name]);

  return <div>{profile?.name}</div>;
}
```

**After (Next.js - Server Component):**
```typescript
// app/lifter/[name]/page.tsx
import { getLifterProfile } from '@/lib/api';
import { LifterProfileClient } from '@/components/LifterProfileClient';

export default async function LifterPage({
  params
}: {
  params: { name: string }
}) {
  // Server-side data fetching (no loading spinner!)
  const profile = await getLifterProfile(decodeURIComponent(params.name));

  // Pass to client component for interactive features
  return <LifterProfileClient profile={profile} />;
}

// Generate static pages for popular lifters
export async function generateStaticParams() {
  const topLifters = await getTopLifters(100);
  return topLifters.map(lifter => ({
    name: encodeURIComponent(lifter.name)
  }));
}
```

### 2. Client Components

Components with interactivity must use `'use client'` directive:

**LifterSearch Component:**
```typescript
// components/LifterSearch.tsx
'use client';

import { useState, useEffect } from 'react';

export function LifterSearch({ onSelect, weightClass }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Debounced search to API route
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        fetch(`/api/search?q=${query}&wc=${weightClass}`)
          .then(res => res.json())
          .then(data => setResults(data.results));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, weightClass]);

  return (/* ... */);
}
```

**When to use `'use client'`:**
- Component uses hooks (useState, useEffect, useRef)
- Component has event handlers (onClick, onChange)
- Component uses browser APIs (localStorage, window)
- Component needs real-time updates

**When NOT to use `'use client'` (Server Component):**
- Static content display
- Data fetching from database
- SEO-critical content
- Performance-critical initial render

---

## API Routes

### 1. Search API

**File:** `app/api/search/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { searchLifters } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const weightClass = searchParams.get('wc') || undefined;
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    const results = await searchLifters(query, limit, weightClass);

    return NextResponse.json(results, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
```

**Caching Strategy:**
- `s-maxage=60`: Cache for 60 seconds on CDN
- `stale-while-revalidate=300`: Serve stale content while revalidating for 5 minutes

### 2. Lifter Profile API

**File:** `app/api/lifters/[name]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getLifterProfile } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const name = decodeURIComponent(params.name);

  try {
    const profile = await getLifterProfile(name);

    return NextResponse.json(profile, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Lifter not found' },
      { status: 404 }
    );
  }
}
```

**Why cache longer?**
- Lifter profiles change infrequently
- 5-minute CDN cache reduces database load
- 1-hour stale-while-revalidate provides fast experience

### 3. Compare API

**File:** `app/api/compare/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { compareLifters } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lifters, startDate, endDate, weightClass } = body;

  if (!lifters || lifters.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 lifters required' },
      { status: 400 }
    );
  }

  try {
    const comparison = await compareLifters(
      lifters,
      startDate,
      endDate,
      undefined,
      weightClass
    );

    return NextResponse.json(comparison, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Comparison failed' },
      { status: 500 }
    );
  }
}
```

**Caching Strategy:**
- POST requests can still be cached by CDN
- Use lifter names + filters as cache key
- 2-minute cache, 10-minute stale-while-revalidate

---

## Data Fetching Patterns

### Pattern 1: Server Component Data Fetching

**Use for:** Initial page loads, SEO-critical data

```typescript
// app/lifter/[name]/page.tsx
import { getLifterProfile } from '@/lib/supabase';

export default async function LifterPage({ params }: { params: { name: string } }) {
  // This runs on the server
  const profile = await getLifterProfile(params.name);

  // Data is sent to client as part of HTML
  return (
    <div>
      <h1>{profile.name}</h1>
      <p>Best Total: {profile.best_total_kg} kg</p>
    </div>
  );
}
```

**Benefits:**
- No loading spinner needed
- SEO-friendly (data in HTML)
- Fast perceived performance

### Pattern 2: Client Component with SWR/React Query

**Use for:** Dynamic filtering, real-time updates

```typescript
'use client';

import useSWR from 'swr';

export function LifterComparison({ lifters }: Props) {
  const { data, error, isLoading } = useSWR(
    ['/api/compare', lifters],
    ([url, lifters]) =>
      fetch(url, {
        method: 'POST',
        body: JSON.stringify({ lifters })
      }).then(res => res.json()),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000 // Don't refetch for 1 minute
    }
  );

  if (isLoading) return <Spinner />;
  if (error) return <Error />;

  return <ComparisonTable data={data} />;
}
```

**Benefits:**
- Automatic caching
- Deduplication
- Background revalidation
- Error handling

### Pattern 3: Hybrid (Server + Client)

**Use for:** Best of both worlds

```typescript
// app/scout/page.tsx (Server Component)
export default async function ScoutPage() {
  // Server-side: Get static data
  const weightClasses = await getWeightClasses();
  const recentLifters = await getRecentlySearched();

  // Pass to client component
  return (
    <ScoutClient
      weightClasses={weightClasses}
      suggestions={recentLifters}
    />
  );
}

// components/ScoutClient.tsx (Client Component)
'use client';

export function ScoutClient({ weightClasses, suggestions }: Props) {
  const [lifters, setLifters] = useState<string[]>([]);

  // Dynamic data fetching when lifters selected
  const { data } = useSWR(
    lifters.length >= 2 ? ['/api/compare', lifters] : null,
    fetcher
  );

  return (/* ... */);
}
```

---

## Performance Optimizations

### 1. Static Site Generation (SSG)

**Generate static pages for popular lifters:**

```typescript
// app/lifter/[name]/page.tsx
export async function generateStaticParams() {
  // Pre-render top 1000 lifters at build time
  const topLifters = await getTopLifters(1000);

  return topLifters.map(lifter => ({
    name: encodeURIComponent(lifter.name)
  }));
}

export const dynamicParams = true; // Still allow dynamic lifters
```

**Benefits:**
- Instant page loads for popular lifters
- Reduced database queries
- Better SEO

### 2. Incremental Static Regeneration (ISR)

**Regenerate pages periodically:**

```typescript
// app/lifter/[name]/page.tsx
export const revalidate = 3600; // Regenerate every hour

export default async function LifterPage({ params }: Props) {
  const profile = await getLifterProfile(params.name);
  return <LifterProfileClient profile={profile} />;
}
```

**Benefits:**
- Fresh data without full rebuild
- Balance between static and dynamic
- Handles data updates automatically

### 3. Edge Runtime

**Deploy API routes to edge:**

```typescript
// app/api/search/route.ts
export const runtime = 'edge'; // Deploy to edge network

export async function GET(request: NextRequest) {
  // This runs on Cloudflare/Vercel Edge
  const results = await searchLifters(query);
  return NextResponse.json(results);
}
```

**Benefits:**
- < 50ms latency globally
- Automatic geographic distribution
- Lower costs

### 4. React Server Components

**Reduce client JavaScript:**

```typescript
// Server Component (no JS sent to browser)
export default async function ComparisonTable({ lifters }: Props) {
  const data = await compareLifters(lifters);

  return (
    <table>
      {data.map(lifter => (
        <tr key={lifter.name}>
          <td>{lifter.name}</td>
          <td>{lifter.best_total?.total_kg}</td>
        </tr>
      ))}
    </table>
  );
}
```

**Benefits:**
- Smaller bundle size
- Faster page loads
- Better Core Web Vitals

---

## Step-by-Step Migration

### Phase 1: Setup (Week 1)

1. **Create Next.js project:**
   ```bash
   npx create-next-app@latest ipf-scout-nextjs --typescript --tailwind --app
   ```

2. **Install dependencies:**
   ```bash
   npm install @supabase/supabase-js
   npm install swr # or @tanstack/react-query
   ```

3. **Copy configuration:**
   - `.env.local` (Next.js uses `.env.local` instead of `.env`)
   - `tailwind.config.js`
   - `tsconfig.json` (merge with Next.js defaults)

4. **Copy types:**
   - `src/types/index.ts` → `lib/types.ts`

### Phase 2: API Layer (Week 1-2)

1. **Create server-side Supabase client:**
   ```typescript
   // lib/supabase.ts (server-side)
   import { createClient } from '@supabase/supabase-js';

   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side key
   );
   ```

2. **Create client-side Supabase client:**
   ```typescript
   // lib/supabaseClient.ts (browser)
   import { createClient } from '@supabase/supabase-js';

   export const supabaseClient = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   );
   ```

3. **Migrate API functions:**
   - `src/services/supabaseApi.ts` → `lib/api/` (split by domain)
   - `lib/api/search.ts`
   - `lib/api/lifters.ts`
   - `lib/api/compare.ts`

4. **Create API routes:**
   - `app/api/search/route.ts`
   - `app/api/lifters/[name]/route.ts`
   - `app/api/compare/route.ts`

### Phase 3: Components (Week 2-3)

1. **Migrate shared components:**
   - `src/components/LifterSearch.tsx` → `components/LifterSearch.tsx`
     - Add `'use client'` directive
     - Change API calls to fetch('/api/...')

2. **Create page components:**
   - `app/page.tsx` (Home)
   - `app/scout/page.tsx` (Scout)
   - `app/lifter/[name]/page.tsx` (Profile)

3. **Split into Server + Client:**
   - Create client components for interactivity
   - Keep server components for static content

### Phase 4: Routing (Week 3)

1. **Remove React Router:**
   - Delete `react-router-dom` dependency
   - Use Next.js Link component

2. **Update navigation:**
   ```typescript
   // components/Navigation.tsx
   'use client';

   import Link from 'next/link';

   export function Navigation() {
     return (
       <nav>
         <Link href="/">Home</Link>
         <Link href="/scout">Scout</Link>
       </nav>
     );
   }
   ```

### Phase 5: Testing & Optimization (Week 4)

1. **Test all features:**
   - Search functionality
   - Filtering and sorting
   - Dynamic routing
   - API routes

2. **Add ISR/SSG:**
   - Configure `revalidate` for pages
   - Add `generateStaticParams` for popular lifters

3. **Performance audit:**
   - Run Lighthouse
   - Check Core Web Vitals
   - Optimize bundle size

4. **Deploy to Vercel:**
   ```bash
   vercel
   ```

---

## Migration Checklist

### Before Migration
- [ ] Document current features
- [ ] Set up Next.js project
- [ ] Install dependencies
- [ ] Configure environment variables

### API Layer
- [ ] Create server Supabase client
- [ ] Create client Supabase client
- [ ] Migrate search API
- [ ] Migrate lifter profile API
- [ ] Migrate comparison API
- [ ] Add API route caching

### Components
- [ ] Migrate LifterSearch component
- [ ] Migrate Scout page
- [ ] Migrate LifterProfile page
- [ ] Split Server/Client components
- [ ] Update imports

### Routing
- [ ] Remove React Router
- [ ] Implement Next.js navigation
- [ ] Add dynamic routes
- [ ] Test all routes

### Performance
- [ ] Add ISR to lifter pages
- [ ] Generate static params for top lifters
- [ ] Enable edge runtime for API routes
- [ ] Optimize images (next/image)

### Testing
- [ ] Test all features
- [ ] Run Lighthouse audit
- [ ] Check Core Web Vitals
- [ ] Test on mobile

### Deployment
- [ ] Deploy to Vercel
- [ ] Configure custom domain
- [ ] Set up analytics
- [ ] Monitor performance

---

## Expected Improvements

| Metric | Current (Vite) | Next.js | Improvement |
|--------|---------------|---------|-------------|
| **Initial Load** | 2-3s | 0.5-1s | 2-3x faster |
| **Lifter Page** | 1-2s (client) | 0.2-0.5s (SSG) | 4-10x faster |
| **SEO Score** | 60-70 | 95-100 | Better indexing |
| **Bundle Size** | 400KB | 150KB | 60% smaller |
| **API Latency** | N/A | 50ms (edge) | Global performance |

---

## Rollback Plan

If migration encounters issues:

1. **Keep Vite version running** during migration
2. **Use feature flags** to toggle Next.js features
3. **Gradual rollout:** Migrate one page at a time
4. **Monitor metrics:** Compare before/after
5. **DNS failover:** Can switch back quickly

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Deployment](https://nextjs.org/docs/app/building-your-application/deploying)

---

## Support for AI Assistants

When migrating code to Next.js:

1. **Always specify `'use client'`** for components with hooks
2. **Use server components by default** unless interactivity needed
3. **Create API routes** instead of direct Supabase calls from client
4. **Add caching headers** to all API routes
5. **Use `generateStaticParams`** for dynamic routes with known values
6. **Test edge runtime compatibility** before deployment

**Key principle:** Server-first, client when necessary.
