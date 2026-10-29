import { Resource, IResource } from '../models/Resource';

export type MatchStatus = 'matched' | 'not_found' | 'unavailable';
export type MatchSource = 'numericMediaId' | 'reelShortcode' | 'reelId' | 'canonicalReelUrl' | 'alias';

export interface ResourceMatchResult {
  matchFound: boolean;
  status: MatchStatus;
  resource?: IResource;
  matchedBy?: MatchSource;
  searchedIdentifiers: {
    numericMediaId?: string;
    reelShortcode?: string;
    reelId?: string;
    canonicalReelUrl?: string;
    videoId?: string;
  };
}

export class ResourceMatcherService {
  /**
   * Deterministically matches an identified Reel against the resources collection.
   * Priority hierarchy:
   * 1. Exact numeric media ID match when both sides have a verified ID.
   * 2. Exact shortcode match.
   * 3. Exact normalized canonical permalink or explicitly registered alias.
   * 4. Otherwise, unmatched (never falls back to caption/title guessing).
   */
  public static async match(
    reelId?: string,
    canonicalReelUrl?: string,
    videoId?: string,
    reelShortcode?: string,
    numericMediaId?: string
  ): Promise<ResourceMatchResult> {
    const candidateNumericId = (numericMediaId || videoId || '').trim();
    const candidateShortcode = (reelShortcode || reelId || '').trim();
    const candidateCanonicalUrl = (canonicalReelUrl || '').trim();

    const searchedIdentifiers = {
      numericMediaId: candidateNumericId || undefined,
      reelShortcode: candidateShortcode || undefined,
      reelId: reelId?.trim(),
      canonicalReelUrl: candidateCanonicalUrl || undefined,
      videoId: videoId?.trim(),
    };

    // If no identifier was supplied at all
    if (!candidateNumericId && !candidateShortcode && !candidateCanonicalUrl) {
      return {
        matchFound: false,
        status: 'not_found',
        searchedIdentifiers,
      };
    }

    let candidateResource: IResource | null = null;
    let matchedBy: MatchSource | undefined;

    // Priority 1: Exact numeric media ID match when verified ID is present
    if (numericMediaId) {
      candidateResource = await Resource.findOne({
        $or: [
          { numericMediaId },
          { aliases: numericMediaId },
        ],
      });
      if (candidateResource) {
        matchedBy = 'numericMediaId';
      }
    }

    // Priority 2: Exact shortcode or reelId match
    if (!candidateResource && candidateShortcode) {
      candidateResource = await Resource.findOne({
        $or: [
          { reelShortcode: candidateShortcode },
          { reelId: candidateShortcode },
        ],
      });
      if (candidateResource) {
        matchedBy = reelShortcode ? 'reelShortcode' : 'reelId';
      }
    }

    // Priority 3: Exact normalized Canonical URL
    if (!candidateResource && candidateCanonicalUrl) {
      candidateResource = await Resource.findOne({ canonicalReelUrl: candidateCanonicalUrl });
      if (candidateResource) {
        matchedBy = 'canonicalReelUrl';
      }
    }

    // Priority 4: Deterministic aliases or videoId
    if (!candidateResource && (videoId || candidateShortcode)) {
      const aliasTarget = videoId || candidateShortcode;
      candidateResource = await Resource.findOne({
        $or: [
          { numericMediaId: aliasTarget },
          { aliases: aliasTarget },
        ],
      });
      if (candidateResource) {
        matchedBy = 'alias';
      }
    }

    // If no candidate exists in the library -> explicitly unmatched
    if (!candidateResource) {
      return {
        matchFound: false,
        status: 'not_found',
        searchedIdentifiers,
      };
    }

    // Check availability state policy
    const isResourceEligible = candidateResource.isAvailable && candidateResource.status === 'active';

    if (!isResourceEligible) {
      return {
        matchFound: false,
        status: 'unavailable',
        resource: candidateResource,
        matchedBy,
        searchedIdentifiers,
      };
    }

    // Record delivery increment asynchronously
    await Resource.updateOne(
      { _id: candidateResource._id },
      { 
        $inc: { matchCount: 1 },
        $set: { lastMatchedAt: new Date() }
      }
    ).exec();

    return {
      matchFound: true,
      status: 'matched',
      resource: candidateResource,
      matchedBy,
      searchedIdentifiers,
    };
  }
}

