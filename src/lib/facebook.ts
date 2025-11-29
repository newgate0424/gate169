import { FacebookAdsApi, AdAccount, Ad } from 'facebook-nodejs-business-sdk';

export const initFacebookApi = (accessToken: string) => {
    const api = FacebookAdsApi.init(accessToken);
    return api;
};

export const getAdAccounts = async (accessToken: string) => {
    initFacebookApi(accessToken);
    const me = await (new FacebookAdsApi(accessToken)).call('GET', ['me', 'adaccounts'], {
        fields: 'name,id,account_id,currency,account_status'
    });
    return me.data;
};

export const getAdInsights = async (accessToken: string, adAccountId: string, dateRange?: { from: Date, to: Date }) => {
    const api = initFacebookApi(accessToken);
    const account = new AdAccount(adAccountId);

    const adFields = [
        'name',
        'status',
        'effective_status',
        'campaign{name,daily_budget,lifetime_budget}',
        'adset{name,daily_budget,lifetime_budget}',
        'creative{thumbnail_url,image_url,actor_id}',
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

        // Collect unique actor_ids (Page IDs)
        const pageIds = new Set<string>();
        ads.forEach((ad: any) => {
            if (ad.creative && ad.creative.actor_id) {
                pageIds.add(ad.creative.actor_id);
            }
        });

        // Fetch Page Names
        const pageNamesMap = new Map<string, string>();
        if (pageIds.size > 0) {
            try {
                // Batch request for pages
                // We can't use 'ids' param directly on root in SDK easily without raw call, 
                // but we can loop or use ?ids=...
                // Using raw call for simplicity and batching
                const idsArray = Array.from(pageIds);
                // Split into chunks of 50 to avoid limits if necessary, but for now assume < 50 pages
                const pagesData = await api.call('GET', [], {
                    ids: idsArray.join(','),
                    fields: 'name,username'
                });

                // pagesData is an object where keys are IDs
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

            const pageId = ad.creative ? ad.creative.actor_id : undefined;
            const pageData: any = pageId ? pageNamesMap.get(pageId) : null;

            return {
                id: ad.id,
                name: ad.name,
                status: ad.effective_status,
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
    initFacebookApi(accessToken);
    const ad = new Ad(adId);
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
        let nextUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=name,id,access_token,picture{url},tasks&limit=100&access_token=${accessToken}`;

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
        // Include 'link' field which contains ad referral info
        let allConversations: any[] = [];
        // Request participants with additional fields to try to get profile link
        let url = `https://graph.facebook.com/v18.0/${pageId}/conversations?fields=snippet,updated_time,participants{id,name,email,username,link},message_count,unread_count,link&platform=messenger&limit=100&access_token=${token}`;

        let pageCount = 0;
        const maxPages = 10; // Max 1000 conversations

        while (url && pageCount < maxPages) {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                console.error('Error fetching conversations:', data.error);
                break;
            }

            if (data.data && data.data.length > 0) {
                // Log first conversation to debug participants - detailed view
                if (pageCount === 0 && data.data[0]) {
                    console.log('[getPageConversations] First conversation FULL data:', JSON.stringify(data.data[0], null, 2));
                }

                // Process each conversation to extract ad_id from link if present
                const processedConvs = data.data.map((conv: any) => {
                    let adId = null;

                    // Check if link contains ad referral info
                    // Format: https://www.facebook.com/xxx?ad_id=120210157734360786
                    if (conv.link) {
                        const adIdMatch = conv.link.match(/ad_id=(\d+)/);
                        if (adIdMatch) {
                            adId = adIdMatch[1];
                            console.log(`[getPageConversations] Found ad_id in link: ${adId}`);
                        }
                    }

                    return {
                        ...conv,
                        ad_id: adId
                    };
                });

                allConversations = allConversations.concat(processedConvs);
            }

            // Check for next page
            url = data.paging?.next || null;
            pageCount++;
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
        let url = `https://graph.facebook.com/v18.0/${conversationId}/messages?fields=message,from,created_time,attachments,sticker&limit=100&access_token=${token}`;

        // Fetch all messages with pagination (max 500 to prevent infinite loops)
        let pageCount = 0;
        const maxPages = 10; // Max 1000 messages

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

        const pageApi = FacebookAdsApi.init(pageAccessToken);
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
