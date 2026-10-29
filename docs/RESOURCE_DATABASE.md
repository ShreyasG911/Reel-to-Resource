# MongoDB Resource Database & Matching Specification

This document details the data schema, normalization procedures, deterministic matching rules, and indexing strategy for the **Reel to Resource Matcher** application.

---

## 1. Resource Collection Schema (`resources`)

The `resources` collection maintains our library of known Instagram Reels and their corresponding resource links (templates, digital assets, tutorials, Notion boards, software downloads, etc.).

```typescript
interface IResource {
  title: string;                 // Display title (e.g. "Ultimate Web Design Checklist")
  description?: string;          // Contextual summary of the resource
  reelId: string;                // Normalized Reel shortcode or asset ID (e.g. "DC5aXYZ89ab")
  canonicalReelUrl: string;      // Normalized canonical URL: "https://www.instagram.com/reel/DC5aXYZ89ab/"
  resourceUrl: string;           // Target destination URL delivered to the user
  resourceType: 'template' | 'guide' | 'preset' | 'code' | 'link' | 'other';
  tags: string[];                // Categorization tags
  isAvailable: boolean;          // Delivery gate: only true delivers resource link
  status: 'active' | 'draft' | 'archived'; // Operational lifecycle status
  aliases?: string[];            // Optional verified secondary identifiers (e.g. video_id)
  metadata?: {
    matchCount: number;          // Counter of successful deliveries
    lastMatchedAt?: Date;        // Timestamp of last match
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Essential Indexes:
1. `{ reelId: 1 }` (Unique constraint) — Guarantees that each Reel identifier maps to a single canonical resource.
2. `{ canonicalReelUrl: 1 }` (Index) — Accelerated exact canonical URL matching.
3. `{ aliases: 1 }` (Multikey index) — Lookup support for video IDs and alternative shortcodes.
4. `{ isAvailable: 1, status: 1 }` (Compound index) — Fast availability status checks.

---

## 2. Deterministic Matching Engine

### Priority 1: Exact Normalized Reel ID
The incoming shortcode extracted by `ReelIdentifierAdapter` is matched directly against `resources.reelId`:
```mongodb
db.resources.findOne({ reelId: extractedReelId, isAvailable: true, status: 'active' })
```

### Priority 2: Exact Normalized Canonical URL
If direct `reelId` lookup yields no match, the engine queries using the normalized canonical URL:
```mongodb
db.resources.findOne({ canonicalReelUrl: canonicalUrl, isAvailable: true, status: 'active' })
```

### Priority 3: Verified Aliases
If the event only contained a Meta internal video ID or secondary lookaside asset ID:
```mongodb
db.resources.findOne({ aliases: videoOrAssetId, isAvailable: true, status: 'active' })
```

---

## 3. Availability State Policies

- **`isAvailable: true` and `status: 'active'`:** The resource is active and eligible for delivery. The system replies with the configurable `resourceFound` template including `{{resourceUrl}}`.
- **`isAvailable: false`:** The resource exists in our system but is temporarily marked unavailable (e.g., outdated link, undergoing maintenance). The system delivers a polite fallback notice instead of a broken or stale link.
- **Resource Not Found:** If no matching record exists in the database, the system logs the incoming Reel request and replies with the configurable `resourceNotFound` message.
- **Ambiguous or Unsupported Share:** If the sender shared an unsupported media type (photo, audio, sticker), the system replies with the `unsupportedReel` guidance template.

