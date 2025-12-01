import { FacebookAdsApi, AdAccount, Ad } from 'facebook-nodejs-business-sdk';

// Rate limiting helper - delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== REQUEST CACHING ====================
// Cache to prevent duplicate API calls
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

const requestCache = new Map<string, CacheEntry<any>>();
const pendingRequests = new Map<string, Promise<any>>();

// Cache duration in milliseconds
const CACHE_DURATION = {
    AD_ACCOUNTS: 2 * 60 * 1000,   // 2 minutes
    ADS: 60 * 1000,               // 1 minute
    AD_DETAILS: 2 * 60 * 1000,    // 2 minutes
    AD_COUNTS: 5 * 60 * 1000,     // 5 minutes (slow to fetch, cache longer)
};

const getCacheKey = (prefix: string, accessToken: string, ...args: any[]) => {
    // Use last 8 chars of token to create unique key per user
    const tokenHash = accessToken.slice(-8);
    return `${prefix}:${tokenHash}:${args.join(':')}`;
};

const getFromCache = <T>(key: string): T | null => {
    const entry = requestCache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
        console.log(`[Cache HIT] ${key.split(':')[0]}`);
        return entry.data;
    }
    if (entry) {
        requestCache.delete(key);
    }
    return null;
};

const setCache = <T>(key: string, data: T, duration: number): void => {
    const now = Date.now();
    requestCache.set(key, {
        data,
        timestamp: now,
        expiresAt: now + duration,
    });
    console.log(`[Cache SET] ${key.split(':')[0]} (expires in ${duration/1000}s)`);
};

// Deduplicate concurrent requests
const deduplicatedRequest = async <T>(
    key: string,
    requestFn: () => Promise<T>,
    cacheDuration: number
): Promise<T> => {
    // Check cache first
    const cached = getFromCache<T>(key);
    if (cached) {
        return cached;
    }

    // Check if request is already pending
    const pending = pendingRequests.get(key);
    if (pending) {
        console.log(`[Request DEDUP] ${key.split(':')[0]} - waiting for pending request`);
        return pending;
    }

    // Make new request
    console.log(`[Request NEW] ${key.split(':')[0]}`);
    const requestPromise = requestFn()
        .then(result => {
            setCache(key, result, cacheDuration);
            pendingRequests.delete(key);
            return result;
        })
        .catch(error => {
            pendingRequests.delete(key);
            throw error;
        });

    pendingRequests.set(key, requestPromise);
    return requestPromise;
};

// Clear cache for a specific user (e.g., after sync)
export const clearUserCache = (accessToken: string): void => {
    const tokenHash = accessToken.slice(-8);
    const keysToDelete: string[] = [];
    
    requestCache.forEach((_, key) => {
        if (key.includes(tokenHash)) {
            keysToDelete.push(key);
        }
    });
    
    keysToDelete.forEach(key => requestCache.delete(key));
    console.log(`[Cache CLEAR] Cleared ${keysToDelete.length} entries for user`);
};
// ===========================================================

// Batch processing with rate limiting
const processBatch = async <T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 3,
    delayMs: number = 500
): Promise<R[]> => {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);
        
        // Delay between batches to avoid rate limiting
        if (i + batchSize < items.length) {
            await delay(delayMs);
        }
    }
    
    return results;
};

// Retry with exponential backoff
const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            const isRateLimited = error?.message?.includes('too many calls') || 
                                  error?.code === 80004 ||
                                  error?.error_subcode === 80004;
            
            if (isRateLimited && attempt < maxRetries - 1) {
                const waitTime = baseDelay * Math.pow(2, attempt);
                console.log(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}...`);
                await delay(waitTime);
            } else {
                throw error;
            }
        }
    }
    throw new Error('Max retries exceeded');
};

export const initFacebookApi = (accessToken: string) => {
    return new FacebookAdsApi(accessToken);
};

export const getAdAccounts = async (accessToken: string) => {
    const cacheKey = getCacheKey('AD_ACCOUNTS', accessToken);
    
    return deduplicatedRequest(cacheKey, async () => {
        const api = initFacebookApi(accessToken);
        const me = await api.call('GET', ['me', 'adaccounts'], {
            fields: 'name,id,account_id,currency,account_status,timezone_name,timezone_offset_hours_utc',
            limit: 500
        });
        return me.data;
    }, CACHE_DURATION.AD_ACCOUNTS);
};

// Get ad counts (total, active, paused) for ad accounts - with rate limiting
export const getAdAccountAdCounts = async (accessToken: string, accountIds: string[]) => {
    const cacheKey = getCacheKey('AD_COUNTS', accessToken, accountIds.join(','));
    
    return deduplicatedRequest(cacheKey, async () => {
        const api = initFacebookApi(accessToken);
        const countsMap = new Map();
        
        // Use a faster approach - get ad counts via summary instead of fetching all ads
        // This reduces API calls significantly
        const results = await processBatch(
            accountIds,
            async (accountId) => {
                try {
                    return await retryWithBackoff(async () => {
                        const account = new AdAccount(accountId, undefined, undefined, api);
                        
                        // Use summary to get counts quickly instead of fetching all ads
                        // Fetch only the count using summary=total_count
                        const [activeAds, pausedAds, totalAds] = await Promise.all([
                            account.getAds(['id'], { 
                                filtering: [{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }],
                                limit: 1,
                                summary: 'total_count'
                            }).then((result: any) => result?.summary?.total_count || 0).catch(() => 0),
                            account.getAds(['id'], { 
                                filtering: [{ field: 'effective_status', operator: 'IN', value: ['PAUSED'] }],
                                limit: 1,
                                summary: 'total_count'
                            }).then((result: any) => result?.summary?.total_count || 0).catch(() => 0),
                            account.getAds(['id'], { 
                                limit: 1,
                                summary: 'total_count'
                            }).then((result: any) => result?.summary?.total_count || 0).catch(() => 0),
                        ]);
                        
                        return { accountId, counts: { totalAds, activeAds, pausedAds } };
                    }, 2, 500); // Reduce retries and backoff for speed
                } catch (error) {
                    console.error(`Error fetching ad counts for ${accountId}:`, error);
                    return { accountId, counts: { totalAds: 0, activeAds: 0, pausedAds: 0 } };
                }
            },
            3, // Increase batch size
            300 // Reduce delay
        );
        
        results.forEach(({ accountId, counts }) => {
            countsMap.set(accountId, counts);
        });
        
        return countsMap;
    }, CACHE_DURATION.AD_COUNTS);
};

// Get insights for ad accounts - with rate limiting
export const getAdAccountInsights = async (accessToken: string, accountIds: string[], dateRange?: { from: Date, to: Date }) => {
    const dateKey = dateRange ? `${dateRange.from.toISOString().split('T')[0]}-${dateRange.to.toISOString().split('T')[0]}` : 'last_30d';
    const cacheKey = getCacheKey('INSIGHTS', accessToken, accountIds.sort().join(','), dateKey);
    
    return deduplicatedRequest(cacheKey, async () => {
        const api = initFacebookApi(accessToken);
        const insightsMap = new Map();
        
        // Build date params once
        const params: any = {
            level: 'account',
            limit: 1,
        };
        
        if (dateRange?.from && dateRange?.to) {
            params.time_range = {
                since: dateRange.from.toISOString().split('T')[0],
                until: dateRange.to.toISOString().split('T')[0],
            };
        } else {
            params.date_preset = 'last_30d';
        }
        
        // Fetch insights with rate limiting
        const results = await processBatch(
            accountIds,
            async (accountId) => {
                try {
                    return await retryWithBackoff(async () => {
                        const account = new AdAccount(accountId, undefined, undefined, api);
                        const insights = await account.getInsights(
                            ['impressions', 'reach', 'spend', 'clicks', 'ctr', 'cpm'],
                            params
                        );
                        return { accountId, insights: insights?.[0] || null };
                    });
                } catch (error) {
                    console.error(`Error fetching insights for ${accountId}:`, error);
                    return { accountId, insights: null };
                }
            },
            2, // batch size
            500 // delay between batches
        );
        
        results.forEach(({ accountId, insights }) => {
            if (insights) {
                insightsMap.set(accountId, insights);
            }
        });
        
        return insightsMap;
    }, CACHE_DURATION.AD_COUNTS);
};

export const getCampaigns = async (accessToken: string, adAccountId: string, dateRange?: { from: Date, to: Date }) => {
    const dateKey = dateRange ? `${dateRange.from.toISOString().split('T')[0]}-${dateRange.to.toISOString().split('T')[0]}` : 'last_30d';
    const cacheKey = getCacheKey('CAMPAIGNS', accessToken, adAccountId, dateKey);
    
    return deduplicatedRequest(cacheKey, async () => {
        const api = initFacebookApi(accessToken);
        const account = new AdAccount(adAccountId, undefined, undefined, api);
        
        const campaignFields = [
            'name',
            'status',
            'effective_status',
            'objective',
            'daily_budget',
            'lifetime_budget',
            'budget_remaining',
            'start_time',
            'stop_time',
            'created_time',
            'updated_time',
            'buying_type',
            'special_ad_categories',
        ];

        try {
            const campaigns = await account.getCampaigns(campaignFields, { limit: 500 });
            
            // Get insights for campaigns
            const insightFields = [
                'campaign_id',
                'impressions',
                'reach',
                'spend',
                'clicks',
                'actions',
            ];

            // Build date params for insights
            const insightParams: any = {
                level: 'campaign',
                limit: 500,
            };
            
            if (dateRange?.from && dateRange?.to) {
                insightParams.time_range = {
                    since: dateRange.from.toISOString().split('T')[0],
                    until: dateRange.to.toISOString().split('T')[0],
                };
            } else {
                insightParams.date_preset = 'last_30d';
            }

            const insights = await account.getInsights(insightFields, insightParams);

        const insightsMap = new Map();
        insights.forEach((i: any) => {
            insightsMap.set(i.campaign_id, i);
        });

        return campaigns.map((campaign: any) => {
            const insight = insightsMap.get(campaign.id) || {};
            
            const getActionCount = (actionType: string) => {
                if (!insight.actions) return 0;
                const action = insight.actions.find((a: any) => a.action_type === actionType);
                return action ? parseInt(action.value) : 0;
            };

            return {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                effectiveStatus: campaign.effective_status,
                objective: campaign.objective,
                dailyBudget: campaign.daily_budget ? parseInt(campaign.daily_budget) / 100 : null,
                lifetimeBudget: campaign.lifetime_budget ? parseInt(campaign.lifetime_budget) / 100 : null,
                budgetRemaining: campaign.budget_remaining ? parseInt(campaign.budget_remaining) / 100 : null,
                startTime: campaign.start_time,
                stopTime: campaign.stop_time,
                createdTime: campaign.created_time,
                updatedTime: campaign.updated_time,
                buyingType: campaign.buying_type,
                specialAdCategories: campaign.special_ad_categories,
                impressions: parseInt(insight.impressions || '0'),
                reach: parseInt(insight.reach || '0'),
                spend: parseFloat(insight.spend || '0'),
                clicks: parseInt(insight.clicks || '0'),
                results: getActionCount('onsite_conversion.messaging_first_reply'),
            };
        });
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            throw error;
        }
    }, CACHE_DURATION.ADS);
};

export const getAdSets = async (accessToken: string, campaignIds: string[], dateRange?: { from: Date, to: Date }) => {
    const dateKey = dateRange ? `${dateRange.from.toISOString().split('T')[0]}-${dateRange.to.toISOString().split('T')[0]}` : 'last_30d';
    const cacheKey = getCacheKey('ADSETS', accessToken, campaignIds.sort().join(','), dateKey);
    
    return deduplicatedRequest(cacheKey, async () => {
        const api = initFacebookApi(accessToken);
        
        // Build insights date range
        let insightsField = 'insights.date_preset(last_30d){impressions,reach,spend,clicks,actions}';
        if (dateRange?.from && dateRange?.to) {
            const since = dateRange.from.toISOString().split('T')[0];
            const until = dateRange.to.toISOString().split('T')[0];
            insightsField = `insights.time_range({"since":"${since}","until":"${until}"}){impressions,reach,spend,clicks,actions}`;
        }
        
        const adSetFields = [
            'name',
            'status',
            'effective_status',
            'campaign_id',
            'account_id',
            'daily_budget',
            'lifetime_budget',
            'budget_remaining',
            'start_time',
            'end_time',
            'targeting',
            'optimization_goal',
            'billing_event',
            'bid_amount',
            insightsField,
        ];

        try {
            // Fetch ad sets with rate limiting to avoid API limits
            const results = await processBatch(
                campaignIds,
                async (campaignId) => {
                    return await retryWithBackoff(async () => {
                        try {
                            const adSets = await api.call('GET', [campaignId, 'adsets'], {
                                fields: adSetFields.join(','),
                                limit: 500
                            });
                            return adSets.data || [];
                        } catch (error) {
                            console.error(`Error fetching adsets for campaign ${campaignId}:`, error);
                            return [];
                        }
                    });
                },
                2, // batch size - 2 campaigns at a time
                500 // 500ms delay between batches
            );
            const allAdSets = results.flat();

            return allAdSets.map((adSet: any) => {
                const insights = adSet.insights?.data?.[0] || {};
                const actions = insights.actions || [];
                const results = actions.find((a: any) => 
                    a.action_type === 'omni_purchase' || 
                    a.action_type === 'purchase' ||
                    a.action_type === 'lead' ||
                    a.action_type === 'link_click'
                )?.value || 0;
                
                return {
                    id: adSet.id,
                    name: adSet.name,
                    status: adSet.status,
                    effectiveStatus: adSet.effective_status,
                    campaignId: adSet.campaign_id,
                    adAccountId: adSet.account_id ? `act_${adSet.account_id}` : '',
                    dailyBudget: adSet.daily_budget ? parseInt(adSet.daily_budget) / 100 : null,
                    lifetimeBudget: adSet.lifetime_budget ? parseInt(adSet.lifetime_budget) / 100 : null,
                    budgetRemaining: adSet.budget_remaining ? parseInt(adSet.budget_remaining) / 100 : null,
                    startTime: adSet.start_time,
                    endTime: adSet.end_time,
                    optimizationGoal: adSet.optimization_goal || 'NONE',
                    billingEvent: adSet.billing_event || 'NONE',
                    bidAmount: adSet.bid_amount ? parseInt(adSet.bid_amount) / 100 : null,
                    impressions: parseInt(insights.impressions || '0'),
                    reach: parseInt(insights.reach || '0'),
                    spend: parseFloat(insights.spend || '0'),
                    clicks: parseInt(insights.clicks || '0'),
                    results: parseInt(results),
                };
            });
        } catch (error) {
            console.error('Error fetching ad sets:', error);
            throw error;
        }
    }, CACHE_DURATION.ADS);
};

export const getAdsByAdSets = async (accessToken: string, adSetIds: string[], dateRange?: { from: Date, to: Date }) => {
    const dateKey = dateRange ? `${dateRange.from.toISOString().split('T')[0]}-${dateRange.to.toISOString().split('T')[0]}` : 'last_30d';
    const cacheKey = getCacheKey('ADS', accessToken, adSetIds.sort().join(','), dateKey);
    
    return deduplicatedRequest(cacheKey, async () => {
        const api = initFacebookApi(accessToken);
        
        // Build insights date range with more metrics
        let insightsField = 'insights.date_preset(last_30d){impressions,reach,spend,clicks,actions,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,video_play_actions}';
        if (dateRange?.from && dateRange?.to) {
            const since = dateRange.from.toISOString().split('T')[0];
            const until = dateRange.to.toISOString().split('T')[0];
            insightsField = `insights.time_range({"since":"${since}","until":"${until}"}){impressions,reach,spend,clicks,actions,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,video_play_actions}`;
        }
        
        const adFields = [
            'name',
            'status',
            'effective_status',
            'adset_id',
            'adset{daily_budget,lifetime_budget}',
            'campaign_id',
            'account_id',
            'creative{id,thumbnail_url,image_url,object_story_spec,asset_feed_spec,actor_id}',
            insightsField,
        ];

        try {
            // Fetch ads with rate limiting to avoid API limits
            const results = await processBatch(
                adSetIds,
                async (adSetId) => {
                    return await retryWithBackoff(async () => {
                        try {
                            const ads = await api.call('GET', [adSetId, 'ads'], {
                                fields: adFields.join(','),
                                limit: 500
                            });
                            return ads.data || [];
                        } catch (error) {
                            console.error(`Error fetching ads for adset ${adSetId}:`, error);
                            return [];
                        }
                    });
                },
                2, // batch size - 2 ad sets at a time
                500 // 500ms delay between batches
            );
            const allAds = results.flat();

            return allAds.map((ad: any) => {
                const insights = ad.insights?.data?.[0] || {};
                const actions = insights.actions || [];
                
                // Helper to get action value
                const getActionValue = (actionType: string) => {
                    const action = actions.find((a: any) => a.action_type === actionType);
                    return action ? parseInt(action.value) : 0;
                };
                
                // Get results (conversions)
                const resultValue = getActionValue('omni_purchase') || 
                    getActionValue('purchase') || 
                    getActionValue('lead') || 
                    getActionValue('link_click') || 0;
                
                // Get post engagements
                const postEngagements = getActionValue('post_engagement') || 
                    getActionValue('page_engagement') || 0;
                
                // Get new messaging contacts
                const newMessagingContacts = getActionValue('onsite_conversion.messaging_first_reply') ||
                    getActionValue('onsite_conversion.messaging_conversation_started_7d') || 0;
                
                // Video metrics
                const getVideoMetric = (metricArray: any[] | undefined) => {
                    if (!metricArray || metricArray.length === 0) return 0;
                    const metric = metricArray.find((m: any) => m.action_type === 'video_view');
                    return metric ? parseFloat(metric.value) : 0;
                };
                
                const videoAvgTime = getVideoMetric(insights.video_avg_time_watched_actions);
                const videoPlays = getVideoMetric(insights.video_play_actions);
                const video3sec = getActionValue('video_view'); // 3-second views are in actions
                const videoP25 = getVideoMetric(insights.video_p25_watched_actions);
                const videoP50 = getVideoMetric(insights.video_p50_watched_actions);
                const videoP75 = getVideoMetric(insights.video_p75_watched_actions);
                const videoP95 = getVideoMetric(insights.video_p95_watched_actions);
                const videoP100 = getVideoMetric(insights.video_p100_watched_actions);
                
                // Calculate cost per new messaging contact
                const spend = parseFloat(insights.spend || '0');
                const costPerNewMessagingContact = newMessagingContacts > 0 ? spend / newMessagingContacts : 0;
                
                // Get budget from adset
                const adsetBudget = ad.adset?.daily_budget || ad.adset?.lifetime_budget || 0;
                const budget = adsetBudget ? parseInt(adsetBudget) / 100 : 0;
                
                // Extract thumbnail from creative
                let thumbnailUrl = '';
                let pageId = '';
                if (ad.creative) {
                    // Get page ID from actor_id or object_story_spec
                    pageId = ad.creative.actor_id || '';
                    if (!pageId && ad.creative.object_story_spec) {
                        pageId = ad.creative.object_story_spec.page_id || '';
                    }
                    
                    // Try direct thumbnail_url first
                    if (ad.creative.thumbnail_url) {
                        thumbnailUrl = ad.creative.thumbnail_url;
                    } else if (ad.creative.image_url) {
                        thumbnailUrl = ad.creative.image_url;
                    } 
                    // Try object_story_spec for image posts
                    else if (ad.creative.object_story_spec) {
                        const spec = ad.creative.object_story_spec;
                        if (spec.link_data?.image_hash || spec.link_data?.picture) {
                            thumbnailUrl = spec.link_data.picture || '';
                        } else if (spec.photo_data?.url) {
                            thumbnailUrl = spec.photo_data.url;
                        } else if (spec.video_data?.image_url) {
                            thumbnailUrl = spec.video_data.image_url;
                        }
                    }
                    // Try asset_feed_spec for dynamic ads
                    else if (ad.creative.asset_feed_spec) {
                        const assets = ad.creative.asset_feed_spec;
                        if (assets.images && assets.images.length > 0) {
                            thumbnailUrl = assets.images[0].url || '';
                        }
                    }
                }
                
                return {
                    id: ad.id,
                    name: ad.name,
                    status: ad.status,
                    effectiveStatus: ad.effective_status,
                    adSetId: ad.adset_id,
                    campaignId: ad.campaign_id,
                    adAccountId: ad.account_id ? `act_${ad.account_id}` : '',
                    thumbnailUrl,
                    pageId,
                    pageName: '', // Will be filled by API route
                    budget,
                    results: resultValue,
                    reach: parseInt(insights.reach || '0'),
                    impressions: parseInt(insights.impressions || '0'),
                    postEngagements,
                    clicks: parseInt(insights.clicks || '0'),
                    newMessagingContacts,
                    spend,
                    costPerNewMessagingContact,
                    videoAvgTime,
                    videoPlays,
                    video3sec,
                    videoP25,
                    videoP50,
                    videoP75,
                    videoP95,
                    videoP100,
                };
            });
        } catch (error) {
            console.error('Error fetching ads:', error);
            throw error;
        }
    }, CACHE_DURATION.ADS);
};

export const getAdInsights = async (accessToken: string, adAccountId: string, dateRange?: { from: Date, to: Date }) => {
    const api = initFacebookApi(accessToken);
    // Pass api instance to AdAccount (id, fields, method, api)
    const account = new AdAccount(adAccountId, undefined, undefined, api);

    const adFields = [
        'name',
        'status',
        'effective_status',
        'campaign{name,daily_budget,lifetime_budget}',
        'adset{name,daily_budget,lifetime_budget,promoted_object}',
        'creative{thumbnail_url,image_url,actor_id,object_story_spec}',
        'id'
    ];

    const insightFields = [
        'impressions',
        'reach',
        'spend',
        'actions',
        'action_values',
        'clicks',
        'video_avg_time_watched_actions',
        'video_p25_watched_actions',
        'video_p50_watched_actions',
        'video_p75_watched_actions',
        'video_p95_watched_actions',
        'video_p100_watched_actions',
        'video_play_actions',
        'ad_id',
    ];

    try {
        const ads = await account.getAds(adFields, { limit: 500 });

        const params: any = {
            level: 'ad',
            limit: 500
        };

        if (dateRange && dateRange.from && dateRange.to) {
            params.time_range = {
                since: dateRange.from.toISOString().split('T')[0],
                until: dateRange.to.toISOString().split('T')[0]
            };
        } else {
            params.date_preset = 'maximum';
        }

        const insights = await account.getInsights(insightFields, params);

        const insightsMap = new Map();
        insights.forEach((i: any) => {
            insightsMap.set(i.ad_id, i);
        });

        // Collect unique actor_ids (Page IDs) from multiple sources
        const pageIds = new Set<string>();
        ads.forEach((ad: any) => {
            // Source 1: creative.actor_id
            if (ad.creative?.actor_id) {
                pageIds.add(ad.creative.actor_id);
            }
            // Source 2: creative.object_story_spec.page_id
            if (ad.creative?.object_story_spec?.page_id) {
                pageIds.add(ad.creative.object_story_spec.page_id);
            }
            // Source 3: adset.promoted_object.page_id
            if (ad.adset?.promoted_object?.page_id) {
                pageIds.add(ad.adset.promoted_object.page_id);
            }
        });

        // Fetch Page Names
        const pageNamesMap = new Map<string, any>();
        if (pageIds.size > 0) {
            try {
                // Batch request for pages
                const idsArray = Array.from(pageIds);
                const pagesData = await api.call('GET', [], {
                    ids: idsArray.join(','),
                    fields: 'name,username'
                });

                Object.keys(pagesData).forEach(id => {
                    pageNamesMap.set(id, pagesData[id]);
                });

            } catch (e) {
                console.error("Error fetching page names", e);
            }
        }

        const mergedData = ads.map((ad: any) => {
            const insight = insightsMap.get(ad.id) || {};

            const getActionCount = (actionType: string) => {
                if (!insight.actions) return 0;
                const action = insight.actions.find((a: any) => a.action_type === actionType);
                return action ? parseInt(action.value) : 0;
            };

            const getActionValue = (actionType: string) => {
                if (!insight.action_values) return 0;
                const action = insight.action_values.find((a: any) => a.action_type === actionType);
                return action ? parseFloat(action.value) : 0;
            };

            const getVideoStat = (field: string) => {
                if (!insight[field]) return 0;
                const item = insight[field].find((a: any) => a.action_type === 'video_view');
                return item ? parseInt(item.value) : 0;
            };

            // Determine budget: Ad Set > Campaign
            let budget = 'N/A';
            if (ad.adset && (ad.adset.daily_budget || ad.adset.lifetime_budget)) {
                budget = ad.adset.daily_budget || ad.adset.lifetime_budget;
            } else if (ad.campaign && (ad.campaign.daily_budget || ad.campaign.lifetime_budget)) {
                budget = ad.campaign.daily_budget || ad.campaign.lifetime_budget;
            }

            const spend = parseFloat(insight.spend || '0');
            const impressions = parseInt(insight.impressions || '0');
            const purchaseValue = getActionValue('purchase') + getActionValue('offsite_conversion.fb_pixel_purchase');
            const roas = spend > 0 ? purchaseValue / spend : 0;
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

            // Get Page ID from multiple sources
            const pageId = ad.creative?.actor_id 
                || ad.creative?.object_story_spec?.page_id 
                || ad.adset?.promoted_object?.page_id 
                || undefined;
            const pageData: any = pageId ? pageNamesMap.get(pageId) : null;

            return {
                id: ad.id,
                name: ad.name,
                status: ad.status,
                effectiveStatus: ad.effective_status,
                campaignName: ad.campaign ? ad.campaign.name : '',
                adSetName: ad.adset ? ad.adset.name : '',
                thumbnail: ad.creative ? (ad.creative.thumbnail_url || ad.creative.image_url) : '',
                delivery: ad.effective_status,
                budget: budget,
                results: getActionCount('onsite_conversion.messaging_first_reply'),
                reach: parseInt(insight.reach || '0'),
                impressions: impressions,
                spend: spend,
                roas: roas,
                cpm: cpm,
                post_engagements: getActionCount('post_engagement'),
                link_clicks: getActionCount('link_click'),
                new_messaging_contact: getActionCount('onsite_conversion.messaging_first_reply'),
                video_avg_time: insight.video_avg_time_watched_actions ? insight.video_avg_time_watched_actions[0]?.value : 0,
                video_plays: getActionCount('video_view'),
                video_3sec: getActionCount('video_view'),
                video_p25: getVideoStat('video_p25_watched_actions'),
                video_p50: getVideoStat('video_p50_watched_actions'),
                video_p75: getVideoStat('video_p75_watched_actions'),
                video_p95: getVideoStat('video_p95_watched_actions'),
                video_p100: getVideoStat('video_p100_watched_actions'),
                pageId: pageId || 'N/A',
                pageName: pageData?.name || 'N/A',
                pageUsername: pageData?.username || null,
            };
        });

        return mergedData;

    } catch (error) {
        console.error('Error fetching ads data:', error);
        throw error;
    }
};

export const updateAdStatus = async (accessToken: string, adId: string, status: 'ACTIVE' | 'PAUSED') => {
    const api = initFacebookApi(accessToken);
    const ad = new Ad(adId, undefined, undefined, api);
    try {
        const result = await ad.update([], { status: status });
        return result;
    } catch (error) {
        console.error('Error updating ad status:', error);
        throw error;
    }
};

export const getPages = async (accessToken: string) => {
    try {
        let allPages: any[] = [];
        let nextUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=name,id,access_token,picture{url},tasks&limit=100&access_token=${accessToken}`;

        // Fetch all pages with pagination
        while (nextUrl) {
            const response = await fetch(nextUrl);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            if (data.data) {
                allPages = [...allPages, ...data.data];
            }

            // Check for next page
            nextUrl = data.paging?.next || null;
        }

        console.log(`[getPages] Fetched ${allPages.length} pages total (with pagination)`);
        console.log(`[getPages] Page list:`, allPages.map(p => `${p.name} (${p.id})`).join(', '));

        return allPages;
    } catch (error) {
        console.error('Error fetching pages:', error);
        throw error;
    }
};

export const getPageConversations = async (userAccessToken: string, pageId: string, pageAccessToken?: string) => {
    const api = initFacebookApi(userAccessToken);
    try {
        let token = pageAccessToken;

        if (!token) {
            const page = await api.call('GET', [pageId], {
                fields: 'access_token',
            });
            token = page.access_token;
        }

        // Fetch all conversations with pagination
        let allConversations: any[] = [];

        // Strategy: Try to fetch with 'labels' first to get Ad ID.
        // If it fails with TOS error (2018344), fallback to fetching without 'labels'.

        const fetchConversations = async (includeLabels: boolean) => {
            let fields = 'snippet,updated_time,participants{id,name,email,username,link},message_count,unread_count,link';
            if (includeLabels) {
                fields += ',labels';
            }

            let url = `https://graph.facebook.com/v21.0/${pageId}/conversations?fields=${fields}&platform=messenger&limit=20&access_token=${token}`;
            let pageCount = 0;
            const maxPages = 1;
            let conversations: any[] = [];

            while (url && pageCount < maxPages) {
                const response = await fetch(url);
                const data = await response.json();

                if (data.error) {
                    // Check for Page Contact TOS error
                    if (includeLabels && data.error.code === 2 && data.error.error_subcode === 2018344) {
                        console.warn('[getPageConversations] Page Contact TOS not accepted. Retrying without labels.');
                        throw new Error('TOS_REQUIRED');
                    }
                    console.error('Error fetching conversations:', data.error);
                    break;
                }

                if (data.data && data.data.length > 0) {
                    if (pageCount === 0 && data.data[0]) {
                        console.log('[getPageConversations] First conversation data:', JSON.stringify(data.data[0], null, 2));
                    }

                    const processedConvs = data.data.map((conv: any) => {
                        let adId = null;

                        // 1. Try to find ad_id in labels
                        if (conv.labels && conv.labels.data) {
                            const adLabel = conv.labels.data.find((l: any) => l.name && l.name.startsWith('ad_id.'));
                            if (adLabel) {
                                const parts = adLabel.name.split('.');
                                if (parts.length > 1) {
                                    adId = parts[1];
                                }
                            }
                        }

                        // 2. Fallback: Check link
                        if (!adId && conv.link) {
                            const adIdMatch = conv.link.match(/ad_id=(\d+)/);
                            if (adIdMatch) {
                                adId = adIdMatch[1];
                            }
                        }

                        return {
                            ...conv,
                            ad_id: adId
                        };
                    });

                    conversations = conversations.concat(processedConvs);
                }

                url = data.paging?.next || null;
                pageCount++;
            }
            return conversations;
        };

        try {
            allConversations = await fetchConversations(true);
        } catch (error: any) {
            if (error.message === 'TOS_REQUIRED') {
                // Retry without labels
                allConversations = await fetchConversations(false);
            } else {
                throw error;
            }
        }

        console.log(`Fetched ${allConversations.length} conversations for page ${pageId}`);
        return allConversations;
    } catch (error) {
        console.error('Error fetching conversations:', error);
        throw error;
    }
};

export const getConversationMessages = async (userAccessToken: string, conversationId: string, pageId: string, pageAccessToken?: string) => {
    const api = initFacebookApi(userAccessToken);
    try {
        console.log(`Fetching messages for conversation: ${conversationId} on page: ${pageId}`);

        let token = pageAccessToken;

        if (!token) {
            // Get Page Access Token
            const page = await api.call('GET', [pageId], {
                fields: 'access_token',
            });
            token = page.access_token;
        }

        // Use fetch for pagination support
        let allMessages: any[] = [];
        let url = `https://graph.facebook.com/v21.0/${conversationId}/messages?fields=message,from,created_time,attachments,sticker&limit=20&access_token=${token}`;

        // Fetch all messages with pagination (max 500 to prevent infinite loops)
        let pageCount = 0;
        const maxPages = 1; // Optimize: Fetch only latest 20 messages

        while (url && pageCount < maxPages) {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                console.error('Error fetching messages:', data.error);
                break;
            }

            if (data.data && data.data.length > 0) {
                allMessages = allMessages.concat(data.data);
            }

            // Check for next page
            url = data.paging?.next || null;
            pageCount++;
        }

        console.log(`Fetched ${allMessages.length} messages for conversation ${conversationId}`);

        // Reverse to show oldest first (standard chat UI)
        return allMessages.reverse();
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
};

export const sendMessage = async (userAccessToken: string, pageId: string, recipientId: string, messageText: string) => {
    const api = initFacebookApi(userAccessToken);
    try {
        // Get Page Access Token
        const page = await api.call('GET', [pageId], {
            fields: 'access_token',
        });
        const pageAccessToken = page.access_token;

        const pageApi = new FacebookAdsApi(pageAccessToken);
        // Send message via Graph API
        // Endpoint: /me/messages (which maps to /page_id/messages with page token)
        const response = await pageApi.call('POST', ['me', 'messages'], {
            recipient: { id: recipientId },
            message: { text: messageText },
            messaging_type: 'RESPONSE'
        });

        return response;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

export const getAdDetails = async (accessToken: string, adId: string) => {
    const api = initFacebookApi(accessToken);
    try {
        const ad = new Ad(adId, undefined, undefined, api);

        // 1. Get Ad Basic Info & Creative
        const adData = await ad.get([
            'name',
            'status',
            'creative{thumbnail_url,image_url,title,body,object_story_spec}',
            'preview_shareable_link'
        ]);

        // 2. Get Ad Insights (Lifetime)
        const insights = await ad.getInsights(
            ['impressions', 'clicks', 'spend', 'cpc', 'ctr', 'actions', 'reach'],
            { date_preset: 'maximum' }
        );

        return {
            ...adData,
            insights: insights.length > 0 ? insights[0] : null
        };
    } catch (error) {
        console.error('Error fetching ad details:', error);
        throw error;
    }
};
