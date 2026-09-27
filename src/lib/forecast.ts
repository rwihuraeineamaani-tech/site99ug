/** Campaign estimation formulas. Pure functions — every output carries the working behind it. */

export type Platform = "instagram" | "tiktok" | "youtube" | "facebook" | "x";
export const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube", "facebook", "x"];

/** Industry-typical fallbacks used until we have our own results. */
export const DEFAULT_RATES: Record<Platform, { reachRate: number; engagementRate: number }> = {
  instagram: { reachRate: 0.3, engagementRate: 0.035 },
  tiktok: { reachRate: 0.45, engagementRate: 0.06 },
  youtube: { reachRate: 0.2, engagementRate: 0.04 },
  facebook: { reachRate: 0.12, engagementRate: 0.015 },
  x: { reachRate: 0.1, engagementRate: 0.01 },
};

export type ImpactInput = {
  talent: { name: string; followers: number; fee: number }[];
  platforms: Platform[];
  posts: number;
  extraBudget: number;
  /** learned rates from past results (reach per follower, engagement per reach) */
  learned?: { reachRate: number; engagementRate: number } | null;
};

export type ImpactOutput = {
  reach: number;
  engagements: number;
  cost: number;
  cpm: number;
  cpe: number;
  reachRate: number;
  engagementRate: number;
  source: "our history" | "standard defaults";
  working: string[];
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function estimateImpact(i: ImpactInput): ImpactOutput {
  const plats = i.platforms.length ? i.platforms : (["instagram"] as Platform[]);
  const reachRate = i.learned?.reachRate ?? avg(plats.map((p) => DEFAULT_RATES[p].reachRate));
  const engagementRate = i.learned?.engagementRate ?? avg(plats.map((p) => DEFAULT_RATES[p].engagementRate));
  const followers = i.talent.reduce((a, t) => a + Math.max(0, t.followers), 0);
  const posts = Math.max(1, i.posts);
  // Repeat posts reach mostly the same people: each extra post adds 35% of the first post's reach.
  const postFactor = 1 + (posts - 1) * 0.35;
  const organic = followers * reachRate * postFactor;
  // Paid boost: about UGX 7,500 per 1,000 views, i.e. one extra view per UGX 7.5.
  const paid = Math.max(0, i.extraBudget) / 7.5;
  const reach = Math.round(organic + paid);
  const engagements = Math.round(reach * engagementRate);
  const cost = i.talent.reduce((a, t) => a + Math.max(0, t.fee), 0) + Math.max(0, i.extraBudget);
  const cpm = reach ? Math.round((cost / reach) * 1000) : 0;
  const cpe = engagements ? Math.round(cost / engagements) : 0;
  return {
    reach, engagements, cost, cpm, cpe, reachRate, engagementRate,
    source: i.learned ? "our history" : "standard defaults",
    working: [
      `Combined followers: ${followers.toLocaleString()}`,
      `Reach per follower: ${(reachRate * 100).toFixed(1)}% (${i.learned ? "from our past campaigns" : "standard for " + plats.join(", ")})`,
      `${posts} post${posts > 1 ? "s" : ""} → ×${postFactor.toFixed(2)} (each extra post adds 35%)`,
      `Organic reach ≈ ${Math.round(organic).toLocaleString()}; paid boost ≈ ${Math.round(paid).toLocaleString()} (UGX 7,500 per 1,000 views)`,
      `Engagement rate ${(engagementRate * 100).toFixed(1)}% → ${engagements.toLocaleString()} engagements`,
      `Total cost UGX ${cost.toLocaleString()} → UGX ${cpm.toLocaleString()} per 1,000 views, UGX ${cpe.toLocaleString()} per engagement`,
    ],
  };
}

export type ReturnInput = { budget: number; reach: number; clickRate: number; conversionRate: number; orderValue: number };
export type Scenario = { label: "low" | "likely" | "high"; clicks: number; sales: number; revenue: number; roi: number };

/** Low / likely / high: rates scaled by 0.6 / 1 / 1.4. ROI = (revenue − budget) / budget. */
export function estimateReturn(i: ReturnInput): Scenario[] {
  return ([["low", 0.6], ["likely", 1], ["high", 1.4]] as const).map(([label, k]) => {
    const clicks = Math.round(i.reach * i.clickRate * k);
    const sales = Math.round(clicks * i.conversionRate * k);
    const revenue = Math.round(sales * i.orderValue);
    const roi = i.budget > 0 ? (revenue - i.budget) / i.budget : 0;
    return { label, clicks, sales, revenue, roi };
  });
}

export type ResultRow = { reach: number; impressions: number; engagements: number; clicks: number; conversions: number; revenue_ugx: number; campaign_id: string };

/** Learn reach-per-follower and engagement-per-reach from past results. Null when too little data. */
export function learnRates(results: ResultRow[], followersByCampaign: Record<string, number>) {
  const usable = results.filter((r) => r.reach > 0 && (followersByCampaign[r.campaign_id] ?? 0) > 0);
  if (usable.length < 2) return null;
  const reach = usable.reduce((a, r) => a + r.reach, 0);
  const followers = [...new Set(usable.map((r) => r.campaign_id))].reduce((a, c) => a + followersByCampaign[c], 0);
  const eng = usable.reduce((a, r) => a + r.engagements, 0);
  return { reachRate: Math.min(2, reach / followers), engagementRate: Math.min(0.5, eng / reach) };
}

/** Percent difference actual vs forecast (+ means beat the forecast). */
export const accuracy = (forecast: number, actual: number) => (forecast > 0 ? (actual - forecast) / forecast : 0);
