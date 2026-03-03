# Datalab Frontend Integration Guide

## Overview

This guide shows you how to use the new Datalab-powered document content in your Next.js frontend. The Datalab integration provides:

- **Rich HTML content** with proper formatting, math equations, and tables
- **Navigation tree** extracted from document headings
- **Full-text search** within documents
- **Raw JSON access** via `raw_block_data` field in database

## What's New

### Files Added

1. **Types** (`src/types/datalab.ts`)
   - TypeScript interfaces for Datalab responses
   - `DatalabContentBlock`, `DocumentNavigation`, `SearchResponse`, etc.

2. **Service** (`src/services/datalabService.ts`)
   - API client for Datalab endpoints
   - Helper functions for content processing

3. **Component** (`src/components/DatalabDocumentViewer.tsx`)
   - Complete document viewer example
   - Shows navigation, content, and search

4. **Styles** (`src/styles/datalab-content.css`)
   - CSS for rendering Datalab HTML
   - Proper formatting for tables, math, headings

## Quick Start

### 1. Import CSS in your app

Add to `src/pages/_app.tsx`:

```tsx
import '@/styles/datalab-content.css';
```

### 2. Use the DatalabDocumentViewer

Replace your existing document viewer:

```tsx
// src/pages/document/[id].tsx
import DatalabDocumentViewer from '@/components/DatalabDocumentViewer';

const DocumentPage = ({ documentId }) => {
  return <DatalabDocumentViewer documentId={documentId} />;
};
```

That's it! The component handles everything:
- Loading content with progress indication
- Navigation sidebar
- Search functionality
- Smooth scrolling to sections

## API Endpoints

### Get Document Info

```typescript
import { datalabService } from '@/services/datalabService';

const docInfo = await datalabService.getDocumentInfo(documentId);
// Returns: processing status, cost, quality score, page count, etc.
```

### Get Content (Paginated)

```typescript
const response = await datalabService.getDocumentContent(documentId, {
  page: 1,
  pageSize: 50
});

// response = {
//   total: 1234,
//   page: 1,
//   page_size: 50,
//   total_pages: 25,
//   items: [...]
// }
```

### Get All Content (Auto-paginated)

```typescript
const allBlocks = await datalabService.getAllContent(
  documentId,
  (loaded, total) => {
    console.log(`Loaded ${loaded} / ${total}`);
  }
);
```

### Get Navigation Tree

```typescript
const navigation = await datalabService.getDocumentNavigation(documentId);

// navigation = {
//   document_id: "...",
//   title: "Building Code",
//   total_pages: 500,
//   navigation_tree: [
//     {
//       id: 1,
//       title: "Part 4 - Structural Design",
//       reference_code: "4",
//       page_number: 50,
//       level: 1,
//       children: [...]
//     }
//   ]
// }
```

### Search Document

```typescript
const results = await datalabService.searchDocument(documentId, "snow load", {
  page: 1,
  pageSize: 20
});

// results = {
//   query: "snow load",
//   total_results: 45,
//   results: [
//     {
//       content_id: 123,
//       page_number: 52,
//       html_snippet: "...specified <mark>snow load</mark>...",
//       section_hierarchy: {...}
//     }
//   ]
// }
```

## Content Structure

### Datalab Content Block

```typescript
interface DatalabContentBlock {
  id: number;
  page_number: number;         // 0-indexed
  block_type: string;           // "Page", "Section", "Text", etc.
  html_content: string | null;  // Ready-to-render HTML
  markdown_content: string | null;
  section_hierarchy: {          // Extracted headings
    h3: "4.1.6",
    h3_title: "Loads Due to Snow",
    title: "Loads Due to Snow"
  } | null;
  sequence_order: number;       // Global ordering
  images: Record<string, any> | null;  // Base64 image data
  bbox: [number, number, number, number] | null;
}
```

### Section Hierarchy Format

The `section_hierarchy` field contains:
- `h1`, `h2`, `h3`, etc. - Reference codes (e.g., "4", "4.1", "4.1.6")
- `h1_title`, `h2_title`, etc. - Full titles
- `title` - Main title for the block

Example:
```json
{
  "h3": "4.1.6",
  "h3_title": "4.1.6. Loads Due to Snow and Rain",
  "h4": "4.1.6.1",
  "h4_title": "4.1.6.1. Specified Load",
  "title": "4.1.6.1. Specified Load"
}
```

## Rendering HTML Content

### Basic Rendering

```tsx
<div
  className="datalab-content"
  dangerouslySetInnerHTML={{ __html: block.html_content }}
/>
```

The `datalab-content` CSS class provides proper styling for:
- Headings (h1-h6)
- Tables
- Math equations
- Lists
- Code blocks

### Math Equations

Datalab preserves MathJax format:

```html
<math>S_s</math>
<math display="block">S = I_s [S_s (C_b C_w C_s C_a) + S_r]</math>
```

For full MathJax support, add to your `_document.tsx`:

```tsx
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
```

### Tables

Tables are already formatted as HTML:

```html
<table>
  <thead>
    <tr>
      <th>Importance Category</th>
      <th>Factor</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Low</td>
      <td>0.8</td>
    </tr>
  </tbody>
</table>
```

No special handling needed - CSS handles styling.

## Custom Implementation

### Minimal Example

If you want to build your own viewer:

```tsx
import { useEffect, useState } from 'react';
import { datalabService } from '@/services/datalabService';

function MyDocumentViewer({ documentId }) {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    datalabService.getAllContent(documentId)
      .then(setBlocks)
      .catch(console.error);
  }, [documentId]);

  return (
    <div>
      {blocks.map(block => (
        <div key={block.id} className="datalab-content">
          <div dangerouslySetInnerHTML={{ __html: block.html_content }} />
        </div>
      ))}
    </div>
  );
}
```

### With Navigation

```tsx
function MyDocumentViewer({ documentId }) {
  const [blocks, setBlocks] = useState([]);
  const [navigation, setNavigation] = useState(null);

  useEffect(() => {
    Promise.all([
      datalabService.getAllContent(documentId),
      datalabService.getDocumentNavigation(documentId)
    ]).then(([blocksData, navData]) => {
      setBlocks(blocksData);
      setNavigation(navData);
    });
  }, [documentId]);

  const scrollToBlock = (blockId) => {
    document.getElementById(`block-${blockId}`)
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ display: 'flex' }}>
      {/* Navigation */}
      <nav style={{ width: '300px' }}>
        {navigation?.navigation_tree.map(node => (
          <button key={node.id} onClick={() => scrollToBlock(node.id)}>
            {node.title}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main>
        {blocks.map(block => (
          <div
            key={block.id}
            id={`block-${block.id}`}
            className="datalab-content"
          >
            <div dangerouslySetInnerHTML={{ __html: block.html_content }} />
          </div>
        ))}
      </main>
    </div>
  );
}
```

## Accessing Raw JSON

The database stores the complete raw JSON from Datalab in the `raw_block_data` field. To access it:

### From Backend

Add to your API endpoint:

```python
# app/routers/datalab.py
@router.get("/documents/{document_id}/raw-block/{block_id}")
async def get_raw_block(document_id: str, block_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(DatalabContent).where(
        DatalabContent.id == block_id,
        DatalabContent.pdf_document_id == document_id
    )
    result = await db.execute(stmt)
    block = result.scalar_one_or_none()

    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    return {
        "id": block.id,
        "raw_block_data": block.raw_block_data  # Complete original JSON
    }
```

### From Database Query

```sql
SELECT raw_block_data FROM datalab_content WHERE id = 123;
```

The `raw_block_data` contains everything Datalab returned:
- Original HTML
- Markdown
- Bounding boxes
- Polygon coordinates
- Images metadata
- Section hierarchy
- And more...

## Helper Functions

### Extract Text from HTML

```typescript
import { extractTextFromHtml } from '@/services/datalabService';

const text = extractTextFromHtml(block.html_content);
```

### Get Section Title

```typescript
import { getSectionTitle } from '@/services/datalabService';

const title = getSectionTitle(block.section_hierarchy);
```

### Get Reference Code

```typescript
import { getReferenceCode } from '@/services/datalabService';

const code = getReferenceCode(block.section_hierarchy);
// Returns: "4.1.6.1" or null
```

## Comparison: Old vs New

### Old System (building_code_content)

```typescript
// Hierarchical structure with parent_id
{
  id: 123,
  parent_id: 122,
  content_type: "article",  // Predefined types
  content_text: "Plain text only",
  reference_code: "4.1.6.1",
  // No HTML, no formatting
}
```

### New System (datalab_content)

```typescript
// Flat structure with rich content
{
  id: 123,
  block_type: "Section",  // From Datalab
  html_content: "<h3>4.1.6</h3><p>Rich HTML...</p>",
  section_hierarchy: {
    h3: "4.1.6",
    title: "Loads Due to Snow"
  },
  // Preserves all formatting, math, tables
}
```

## Migration Strategy

### Option 1: Full Replacement

Update your document viewer to use `DatalabDocumentViewer`:

```tsx
import DatalabDocumentViewer from '@/components/DatalabDocumentViewer';

// Old
// return <DocumentViewer documentId={documentId} />;

// New
return <DatalabDocumentViewer documentId={documentId} />;
```

### Option 2: Gradual Migration

Detect document type and use appropriate viewer:

```tsx
import { useEffect, useState } from 'react';
import DocumentViewer from '@/components/DocumentViewer';
import DatalabDocumentViewer from '@/components/DatalabDocumentViewer';
import { datalabService } from '@/services/datalabService';

function SmartDocumentViewer({ documentId }) {
  const [docInfo, setDocInfo] = useState(null);

  useEffect(() => {
    datalabService.getDocumentInfo(documentId)
      .then(setDocInfo)
      .catch(() => setDocInfo({ processingStatus: 'old_format' }));
  }, [documentId]);

  if (!docInfo) return <div>Loading...</div>;

  // Use Datalab viewer for new documents
  if (docInfo.processingStatus === 'completed' && docInfo.datalabRequestId) {
    return <DatalabDocumentViewer documentId={documentId} />;
  }

  // Fall back to old viewer
  return <DocumentViewer documentId={documentId} />;
}
```

## Performance Tips

1. **Lazy Load Content**: Use the paginated API for large documents
2. **Virtual Scrolling**: Implement if rendering 1000+ blocks
3. **Cache Navigation**: Navigation tree rarely changes
4. **Debounce Search**: Wait for user to stop typing

```typescript
// Lazy loading example
const [currentPage, setCurrentPage] = useState(1);

useEffect(() => {
  datalabService.getDocumentContent(documentId, {
    page: currentPage,
    pageSize: 50
  }).then(response => {
    setBlocks(prev => [...prev, ...response.items]);
  });
}, [currentPage]);
```

## Troubleshooting

### Math not rendering
- Add MathJax script to `_document.tsx`
- Ensure HTML is rendered with `dangerouslySetInnerHTML`

### Tables look broken
- Import `datalab-content.css` in `_app.tsx`
- Check CSS is loading correctly

### Search returns no results
- Content must be loaded from Datalab endpoints
- Old documents won't have Datalab data

### Navigation tree is empty
- Document might not have clear heading structure
- Check `section_hierarchy` fields in blocks

## Next Steps

1. **Try the example viewer**: Use `DatalabDocumentViewer` to see all features
2. **Customize styling**: Modify `datalab-content.css` for your brand
3. **Add features**: Bookmarks, annotations, print view, etc.
4. **Optimize loading**: Implement virtual scrolling for very long documents

## Support

For issues with:
- **Datalab API**: Check backend logs and `DATALAB_INTEGRATION.md`
- **Frontend rendering**: Check browser console for errors
- **Missing content**: Verify document was processed via Datalab API
