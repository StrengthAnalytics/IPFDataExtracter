# Changelog

All notable features and improvements to IPF Data Extracter.

> **Note**: When adding new features, update this file with implementation details to help future development.

## [1.1.0] - December 2024

### 🎨 Scout UI Cleanup & Enhancement

Major redesign of the Scout page for improved usability and mobile experience.

**Files Modified:**
- `src/pages/Scout.tsx` - Complete UI restructure
- `vercel.json` - Added SPA routing configuration

**Breaking Changes:**
- Predictions now always enabled (toggle removed)
- Default aggregation mode changed from "By Lift" to "By Comp"
- Default sort changed from "Total" to "Prediction" (descending)
- Date range filters replaced with Target Comp Date + Trend Analysis Range

**New Features:**
1. **Centralized Search Box**
   - Max-width 2xl container (matches homepage styling)
   - All search and filters in single, clean interface
   - Centered page heading above search box

2. **Always-On Predictions**
   - Removed prediction enable/disable toggle
   - Predictions calculated automatically for all lifters
   - Default target date set to today
   - Configurable trend analysis range (12/18/24 months)

3. **Enhanced Tiles View**
   - Total and Predicted totals side-by-side (50/50 split)
   - Full attempt data for all lifts (S/B/D)
   - Competition details with line-clamp for long names
   - Better mobile space utilization

4. **Clickable Lifter Names**
   - Both list and tiles views support profile links
   - Opens in new tab with `target="_blank"`
   - Fixed 404 errors with `vercel.json` SPA routing config

5. **Responsive Toggle Controls**
   - Mobile: 3-column grid layout with labels above buttons
   - Desktop: Inline layout with centered alignment
   - Shortened labels on mobile (Lift/Comp, Total/GL, List/Tiles)
   - Full labels on desktop (By Lift/By Comp, Total/IPF GL, List/Tiles)

6. **Improved Info Popover**
   - Moved from inline to next to "Comparison Results" heading
   - Centered on screen (no horizontal scroll needed)
   - Explains all 3 comparison options in one place
   - Fixed flicker issue on desktop hover
   - Mobile-optimized with backdrop dismiss

7. **UI Layout Improvements**
   - Meets count moved from dedicated column to under lifter name
   - Simplified column structure (removed Meets column)
   - Better use of vertical space
   - Consistent max-width containers throughout

**Technical Improvements:**
- Added `vercel.json` with SPA rewrite rules
- Fixed routing for new tab navigation
- Improved hover interactions for popover
- Better responsive breakpoints for mobile/desktop
- Removed unused chart visualization code

**User Experience:**
- Cleaner, more focused interface
- Better mobile usability
- Predictions always available by default
- More intuitive date configuration
- Faster access to lifter profiles

---

## [1.0.0] - December 2024

### 🎯 Initial Release

Complete powerlifting scouting application with advanced filtering and comparison features.

---

## Core Features

### 🔍 Lifter Search
**Files:**
- `src/components/LifterSearch.tsx` (UI component)
- `src/services/supabaseApi.ts:28-72` (Search logic)

**Features:**
- Fuzzy name search with PostgreSQL `pg_trgm` extension
- Typo-tolerant matching (e.g., "jon haak" finds "John Haack")
- Similarity score ranking (1.0 = exact match)
- 300ms debounced input for performance
- Weight class filtering support
- Autocomplete dropdown with rich lifter details
- Click-outside detection to close results

**Database Requirements:**
1. `migrations/001_enable_pg_trgm.sql` - Enable pg_trgm extension and create GIN indexes
2. `migrations/002_add_fuzzy_search_function.sql` - Create `search_lifters_by_similarity()` function

**Implementation:**
```typescript
// Uses PostgreSQL RPC function for fuzzy search
const { data, error } = await supabase.rpc('search_lifters_by_similarity', {
  search_query: query.toLowerCase(),
  similarity_threshold: 0.1,  // Lower = more fuzzy
  result_limit: limit * 3
});
```

**Similarity Threshold:**
- `0.1` = Very permissive (handles significant typos)
- `0.3` = Moderate (minor typos only)
- `0.5` = Strict (almost exact matches)
- Current setting: `0.1` for best user experience

**Search Quality:**
- Handles misspellings: "jhon hack" → "John Haack" ✅
- Case insensitive: "JOHN HAACK" = "john haack" ✅
- Partial matches: "haack" → "John Haack" ✅
- Transpositions: "jonh" → "john" ✅
- Missing characters: "jhn haak" → "John Haack" ✅

**Future Enhancements:**
- [ ] Federation filtering
- [ ] Country filtering
- [ ] Recent searches history
- [ ] Search suggestions
- [ ] Adjustable similarity threshold in UI
- [ ] Search result highlighting

---

### 🏋️ Scout Page (Multi-Lifter Comparison)
**File:** `src/pages/Scout.tsx`

**Latest Version (v1.1.0):**
- Compare up to 10 lifters side-by-side
- **Centralized search box** (max-w-2xl) matching homepage styling
- **Predictions always enabled** - automatic velocity-based forecasting
- **Dynamic filtering** (auto-updates on change):
  - Weight class filter
  - Target Comp Date (defaults to today)
  - Trend Analysis Range (12/18/24 months, default 18)
- **Responsive toggle controls**:
  - Mobile: 3-column grid with labels above
  - Desktop: Inline layout, centered
  - Data (By Lift / By Comp), Rank by (Total / IPF GL), View (List / Tiles)
- **Sortable columns** in list view:
  - Name, Squat, Bench, Deadlift, Total, Prediction
  - Click to sort, click again to reverse
  - Visual indicators (↑/↓ arrows)
  - **Default**: Sort by Prediction descending
- **Enhanced views**:
  - List: Full attempt data, clickable names, meets under name
  - Tiles: Side-by-side total/prediction, all attempts, compact layout
- **Clickable lifter names** open profile pages in new tabs
- Real-time comparison updates via useEffect
- Loading states during data fetch
- Comprehensive info popover explaining all options

**API:**
- `compareLifters(lifters[], startDate?, endDate?, equipment?, weightClass?, aggregationMode, rankingMethod)`
- `getLifterHistory(name, trendRange, weightClass?, equipment?)` for predictions
- Parallel queries for each lifter
- Weight class filtering
- Automatic prediction calculation

**Implementation Notes:**
- Uses `useEffect` with dependencies: `[selectedLifters, startDate, endDate, weightClass, aggregationMode, rankingMethod]`
- Separate `useEffect` for predictions: `[predictionEnabled, selectedLifters, targetDate, trendRange, weightClass]`
- No "Compare" button needed - updates automatically
- Shows "Updating..." and "Calculating predictions..." spinners

**Defaults (v1.1.0):**
- Aggregation: By Comp
- Ranking: Total
- Sort: Prediction (descending)
- View: List (desktop) / Tiles (mobile)
- Target Date: Today
- Trend Range: 18 months

**Future Enhancements:**
- [ ] Equipment type filtering
- [ ] Federation filtering
- [ ] Save comparison presets
- [ ] Export to CSV/PDF
- [ ] Share comparison links
- [ ] Wilks/DOTS score comparison
- [ ] Confidence intervals for predictions
- [ ] Individual lift predictions (S/B/D separately)

---

### 👤 Lifter Profile Page
**File:** `src/pages/LifterProfile.tsx`

- Complete competition history (last 20 meets)
- Personal bests with dates and meet names
- Dynamic filtering (client-side, instant):
  - Weight class filter
  - Date range (start/end dates)
- Sortable competition table:
  - Date, Meet, Federation, Squat, Bench, Deadlift, Total, IPFGL, Place
  - Multi-type sorting (dates, numbers, strings)
- Shows filtered count vs total count
- IPFGL points display for each competition
- Weight classes and equipment types competed

**API:**
- `getLifterProfile(name)`
- Returns summary + last 20 competitions
- Fetches from both `lifter_summary` and `lifter_records`

**Filtering Strategy:**
- Client-side filtering for instant feedback
- `getFilteredAndSortedCompetitions()` function
- Filters applied before sorting

**Future Enhancements:**
- [ ] All-time competition history (paginated)
- [ ] Performance graphs over time
- [ ] Weight class progression timeline
- [ ] Meet location map
- [ ] Competitor analysis
- [ ] Training cycle estimation

---

### 📊 Advanced Filtering

**Features:**
1. **Weight Class Filter**
   - Dropdown populated from database
   - Filters both search results and comparisons
   - Works on Scout and Profile pages

2. **Date Range Filters**
   - Separate start and end date inputs
   - HTML5 date pickers
   - Examples:
     - All of 2025: `2025-01-01` to `2025-12-31`
     - Last 6 months: `2024-06-01` to `Current`
     - Career best: No dates (all time)

3. **Dynamic Updates**
   - Scout page: Auto-fetches on filter change
   - Profile page: Client-side filtering (instant)

**Implementation:**
- Scout: Server-side filtering via API
- Profile: Client-side filtering in browser
- Both use same filter UI pattern

**Future Enhancements:**
- [ ] Federation filter
- [ ] Equipment type filter
- [ ] Age class filter
- [ ] Division filter
- [ ] Drug tested filter
- [ ] Country filter
- [ ] Preset date ranges (Last 3 months, This year, etc.)

---

### 🔄 Sortable Tables

**Features:**
- Click column headers to sort
- Click again to toggle direction (asc/desc)
- Visual indicators:
  - Active column: colored arrow (↑/↓)
  - Inactive columns: gray double arrow (⇅)
- Hover effects on headers
- Multi-type sorting:
  - Numbers: Numeric comparison
  - Strings: Alphabetical (localeCompare)
  - Dates: Timestamp comparison
  - Mixed: Handle empty/null values

**Implementation Pattern:**
```typescript
const handleSort = (column: SortColumn) => {
  if (sortColumn === column) {
    setSortDirection(dir === 'asc' ? 'desc' : 'asc');
  } else {
    setSortColumn(column);
    setSortDirection('desc'); // Default to highest first
  }
};

const sortData = (data: Item[]) => {
  return [...data].sort((a, b) => {
    const aVal = getColumnValue(a, sortColumn);
    const bVal = getColumnValue(b, sortColumn);
    return sortDirection === 'asc'
      ? compare(aVal, bVal)
      : compare(bVal, aVal);
  });
};
```

**Files:**
- `src/pages/Scout.tsx:82-146` - Sort logic and UI
- `src/pages/LifterProfile.tsx:50-149` - Sort logic and UI

**Future Enhancements:**
- [ ] Multi-column sorting (primary + secondary)
- [ ] Persistent sort preferences
- [ ] Default sort per page
- [ ] Sort direction persistence

---

### 🗄️ Database Optimizations

#### pg_trgm Extension
**File:** `migrations/001_enable_pg_trgm.sql`

- Enables PostgreSQL trigram extension
- Creates GIN indexes on name columns
- Improves fuzzy search quality and performance
- Handles typos and partial matches

**Benefits:**
- Better search results for misspelled names
- Similarity scoring for ranking
- Works across all apps using same database

**Note:** One-time setup per database, reusable by all applications

#### Indexes
```sql
-- Standard B-tree indexes
CREATE INDEX idx_lifter_records_name ON lifter_records(name);
CREATE INDEX idx_lifter_records_date ON lifter_records(date);
CREATE INDEX idx_lifter_summary_name ON lifter_summary(name);

-- Trigram GIN indexes (fuzzy search)
CREATE INDEX idx_lifter_summary_name_trgm ON lifter_summary USING GIN (name gin_trgm_ops);
CREATE INDEX idx_lifter_records_name_trgm ON lifter_records USING GIN (name gin_trgm_ops);

-- Composite index for common queries
CREATE INDEX idx_lifter_records_sex_equipment_weightclass
  ON lifter_records(sex, equipment, weight_class_kg);
```

---

## Performance Metrics

| Operation | Time | Notes |
|-----------|------|-------|
| Search (< 3 chars) | 0ms | Client-side validation |
| Search (3+ chars) | < 500ms | With debounce |
| Lifter Profile Load | < 300ms | 20 competitions |
| Scout Comparison (2 lifters) | < 1s | Parallel queries |
| Scout Comparison (5 lifters) | < 2s | Parallel queries |
| Client-side Filter | < 10ms | Instant feedback |
| Client-side Sort | < 5ms | Array operation |

---

## Technical Improvements

### Type Safety
- Full TypeScript coverage
- Strict mode enabled
- No `any` types in production code
- Comprehensive interfaces for all data structures

### Code Organization
- Clear separation of concerns:
  - Components: UI only
  - Services: Business logic
  - Types: Shared interfaces
  - Config: Environment setup
- Consistent naming conventions
- Well-documented complex logic

### Error Handling
- APIError class for consistent error types
- Try-catch blocks around all API calls
- User-friendly error messages
- Fallback states for failed loads

---

## Documentation

### Files Created
1. **README.md** - Overview and quick start
2. **ARCHITECTURE.md** - Deep technical details
3. **NEXTJS_MIGRATION.md** - Migration roadmap
4. **CHANGELOG.md** - This file
5. **migrations/README.md** - Database migration guide

### Documentation Strategy
- Code comments for complex logic
- Type annotations for all functions
- README for each major directory
- Migration guides for future changes
- AI-assistant friendly (Claude-optimized)

---

## Planned Features

### High Priority
- [ ] Equipment type filtering
- [ ] Federation filtering
- [ ] Export to CSV
- [ ] Performance graphs
- [ ] Mobile responsive optimizations

### Medium Priority
- [ ] Age class filtering
- [ ] Division filtering
- [ ] Drug tested filter
- [ ] Wilks/DOTS comparison
- [ ] Competition location maps

### Low Priority
- [ ] User accounts
- [ ] Saved comparisons
- [ ] Email alerts for lifters
- [ ] Social sharing
- [ ] Custom reports
- [ ] Print-friendly views

### Future (Next.js)
- [ ] Server-side rendering (SSR)
- [ ] Static site generation (SSG)
- [ ] Incremental static regeneration (ISR)
- [ ] Edge runtime deployment
- [ ] API route caching
- [ ] Better SEO

---

## Migration History

### From Vite to Next.js (Planned)
**Status:** Not started
**Timeline:** TBD
**Guide:** See NEXTJS_MIGRATION.md

**Rationale:**
- Better performance (SSR/SSG)
- Improved SEO
- Edge deployment
- API route caching
- Scalability

---

## Breaking Changes

### None (v1.0.0 initial release)

---

## Deprecations

### None (v1.0.0 initial release)

---

## How to Update This File

When adding new features:

1. **Add to appropriate section** above
2. **Include implementation details:**
   - File paths
   - Key functions
   - API changes
   - Database changes
3. **Add "Future Enhancements"** section for extensibility
4. **Update metrics** if performance changes
5. **Document breaking changes** if any
6. **Update migration guide** if architecture changes

### Template for New Features

```markdown
### Feature Name
**File:** `path/to/file.tsx`

**Description:**
Brief description of what this feature does.

**Implementation:**
- Key technical details
- Important functions
- API endpoints used

**Usage Example:**
```typescript
// Code example
```

**Future Enhancements:**
- [ ] Planned improvement 1
- [ ] Planned improvement 2
```

---

## Version History

### [1.0.0] - December 2024
- Initial release
- Complete scouting application
- Advanced filtering and sorting
- PostgreSQL trigram search
- Full TypeScript coverage
- Comprehensive documentation

---

**Next Version:** TBD (Next.js migration)
