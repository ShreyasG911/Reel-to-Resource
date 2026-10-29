import { Resource, IResource } from '../models/Resource';

export type MatchStatus = 'matched' | 'not_found' | 'unavailable';
export type MatchSource = 'reelId' | 'canonicalReelUrl' | 'alias';

export interface ResourceMatchResult {
  matchFound: boolean;
  status: MatchStatus;
  resource?: IResource;
  matchedBy?: MatchSource;
  searchedIdentifiers: {
    reelId?: string;
    canonicalReelUrl?: string;
    videoId?: string;
  };
}

export class ResourceMatcherService {
  /**
   * Deterministically matches an identified Reel against the resources collection.
   */
  public static async match(
    reelId?: string,
    canonicalReelUrl?: string,
    videoId?: string
  ): Promise<ResourceMatchResult> {
    const searchedIdentifiers = {
      reelId: reelId?.trim(),
      canonicalReelUrl: canonicalReelUrl?.trim(),
      videoId: videoId?.trim(),
    };

    // If no identifier was supplied at all
    if (!searchedIdentifiers.reelId && !searchedIdentifiers.canonicalReelUrl && !searchedIdentifiers.videoId) {
      return {
        matchFound: false,
        status: 'not_found',
        searchedIdentifiers,
      };
    }

    let candidateResource: IResource | null = null;
    let matchedBy: MatchSource | undefined;

    // Priority 1: Exact normalized Reel Shortcode or Reel ID
    if (searchedIdentifiers.reelId) {
      candidateResource = await Resource.findOne({
        $or: [
          { reelShortcode: searchedIdentifiers.reelId },
          { reelId: searchedIdentifiers.reelId },
        ],
      });
      if (candidateResource) {
        matchedBy = 'reelId';
      }
    }

    // Priority 2: Exact normalized Canonical URL
    if (!candidateResource && searchedIdentifiers.canonicalReelUrl) {
      candidateResource = await Resource.findOne({ canonicalReelUrl: searchedIdentifiers.canonicalReelUrl });
      if (candidateResource) {
        matchedBy = 'canonicalReelUrl';
      }
    }

    // Priority 3: Deterministic aliases or numeric media ID
    if (!candidateResource && searchedIdentifiers.videoId) {
      candidateResource = await Resource.findOne({
        $or: [
          { numericMediaId: searchedIdentifiers.videoId },
          { aliases: searchedIdentifiers.videoId },
        ],
      });
      if (candidateResource) {
        matchedBy = 'alias';
      }
    }

    // Check alias by reelId if not found yet
    if (!candidateResource && searchedIdentifiers.reelId) {
      candidateResource = await Resource.findOne({ aliases: searchedIdentifiers.reelId });
      if (candidateResource) {
        matchedBy = 'alias';
      }
    }

    // If no candidate exists in the library
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

