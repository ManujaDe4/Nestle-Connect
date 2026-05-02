const pool = require("../config/db");

const getROISummary = async (req, res) => {
  try {
    // 1. Overall conversion funnel
    const conversionResult = await pool.query(`
      SELECT 
        COUNT(*) as total_claims,
        SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as total_redeemed,
        SUM(CASE WHEN claim_status = 'expired'  THEN 1 ELSE 0 END) as total_expired,
        SUM(CASE WHEN claim_status = 'claimed'  THEN 1 ELSE 0 END) as total_pending
      FROM vouchers
    `);

    // 2. Per-platform breakdown: claims + redemptions + conversion rate
    const channelResult = await pool.query(`
      SELECT 
        COALESCE(NULLIF(platform, ''), 'other') as platform,
        COUNT(*) as claim_count,
        SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as redeemed_count,
        ROUND(
          100.0 * SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
          1
        ) as conversion_rate
      FROM vouchers
      GROUP BY COALESCE(NULLIF(platform, ''), 'other')
      ORDER BY claim_count DESC
    `);

    // 3. Daily claims trend (last 30 days)
    const trendResult = await pool.query(`
      SELECT 
        DATE(created_at) as day,
        COUNT(*) as claims,
        SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as redemptions
      FROM vouchers
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `);

    // 4. Campaign-level performance
    const campaignResult = await pool.query(`
      SELECT 
        c.campaign_id,
        c.campaign_name,
        COUNT(v.id) as total_claims,
        SUM(CASE WHEN v.claim_status = 'redeemed' THEN 1 ELSE 0 END) as redeemed_count,
        ROUND(
          100.0 * SUM(CASE WHEN v.claim_status = 'redeemed' THEN 1 ELSE 0 END) / NULLIF(COUNT(v.id), 0),
          1
        ) as conversion_rate,
        c.status,
        c.start_date,
        c.end_date,
        c.budget,
        c.voucher_limit,
        c.voucher_value,
        c.objective,
        c.target_audience
      FROM campaigns c
      LEFT JOIN vouchers v ON c.campaign_id = v.campaign_id
      GROUP BY c.campaign_id, c.campaign_name, c.status, c.start_date, c.end_date, c.budget, c.voucher_limit, c.voucher_value, c.objective, c.target_audience
      ORDER BY total_claims DESC
    `);

    // 5. Performance by Location (Redemptions by Province/Region)
    const locationResult = await pool.query(`
      SELECT 
        s.province, 
        s.region,
        s.area,
        COUNT(r.id) as redemption_count
      FROM redemptions r
      JOIN shops s ON r.shop_id = s.shop_id
      WHERE s.province IS NOT NULL
      GROUP BY s.province, s.region, s.area
      ORDER BY redemption_count DESC
    `);

    // 6. Top performing regions (for table)
    const topRegionsResult = await pool.query(`
      SELECT 
        s.province,
        s.region,
        COUNT(DISTINCT s.id) as shop_count,
        COUNT(r.id) as redemption_count
      FROM shops s
      LEFT JOIN redemptions r ON r.shop_id = s.shop_id
      WHERE s.province IS NOT NULL
      GROUP BY s.province, s.region
      ORDER BY redemption_count DESC
      LIMIT 10
    `);

    res.status(200).json({
      conversion: conversionResult.rows[0],
      channels: channelResult.rows,
      trend: trendResult.rows,
      campaigns: campaignResult.rows,
      locations: locationResult.rows,
      topRegions: topRegionsResult.rows
    });
  } catch (error) {
    console.error("getROISummary error:", error);
    res.status(500).json({ message: "Server error while fetching ROI summary" });
  }
};

const exportROIReport = async (req, res) => {
  try {
    const now = new Date();
    const reportDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const reportTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const [overallRows, channelRows, campaignRows, locationRows, trendRows] = await Promise.all([
      // Overall funnel
      pool.query(`
        SELECT
          COUNT(*) as total_claims,
          SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as total_redeemed,
          SUM(CASE WHEN claim_status = 'expired'  THEN 1 ELSE 0 END) as total_expired,
          SUM(CASE WHEN claim_status = 'claimed'  THEN 1 ELSE 0 END) as total_pending
        FROM vouchers
      `),
      // Platform performance
      pool.query(`
        SELECT
          COALESCE(NULLIF(platform, ''), 'other') as platform,
          COUNT(*) as claim_count,
          SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as redeemed_count,
          SUM(CASE WHEN claim_status = 'expired'  THEN 1 ELSE 0 END) as expired_count,
          SUM(CASE WHEN claim_status = 'claimed'  THEN 1 ELSE 0 END) as pending_count,
          ROUND(100.0 * SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as conversion_rate
        FROM vouchers
        GROUP BY COALESCE(NULLIF(platform, ''), 'other')
        ORDER BY claim_count DESC
      `),
      // Campaign performance (full metadata)
      pool.query(`
        SELECT
          c.campaign_id, c.campaign_name, c.status,
          c.start_date, c.end_date,
          c.objective, c.target_audience,
          c.budget, c.voucher_limit, c.voucher_value,
          COUNT(v.id) as total_claims,
          SUM(CASE WHEN v.claim_status = 'redeemed' THEN 1 ELSE 0 END) as redeemed_count,
          SUM(CASE WHEN v.claim_status = 'expired'  THEN 1 ELSE 0 END) as expired_count,
          SUM(CASE WHEN v.claim_status = 'claimed'  THEN 1 ELSE 0 END) as pending_count,
          ROUND(100.0 * SUM(CASE WHEN v.claim_status = 'redeemed' THEN 1 ELSE 0 END) / NULLIF(COUNT(v.id), 0), 1) as conversion_rate
        FROM campaigns c LEFT JOIN vouchers v ON c.campaign_id = v.campaign_id
        GROUP BY c.campaign_id, c.campaign_name, c.status, c.start_date, c.end_date,
                 c.objective, c.target_audience, c.budget, c.voucher_limit, c.voucher_value
        ORDER BY redeemed_count DESC
      `),
      // Location performance
      pool.query(`
        SELECT s.province, s.region, s.area, COUNT(r.id) as redemption_count
        FROM redemptions r JOIN shops s ON r.shop_id = s.shop_id
        WHERE s.province IS NOT NULL
        GROUP BY s.province, s.region, s.area ORDER BY s.province, s.region
      `),
      // 30-day daily trend
      pool.query(`
        SELECT DATE(created_at) as day, COUNT(*) as claims,
          SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as redemptions
        FROM vouchers
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at) ORDER BY day ASC
      `)
    ]);

    const overall = overallRows.rows[0] || {};
    const totalClaims   = parseInt(overall.total_claims, 10) || 0;
    const totalRedeemed = parseInt(overall.total_redeemed, 10) || 0;
    const totalPending  = parseInt(overall.total_pending, 10) || 0;
    const totalExpired  = parseInt(overall.total_expired, 10) || 0;
    const overallCR     = totalClaims > 0 ? ((totalRedeemed / totalClaims) * 100).toFixed(1) : '0.0';

    // Helper: escape CSV fields
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmtNum = (v) => (Number(v) || 0).toLocaleString();
    const fmtLKR = (v) => `LKR ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : 'N/A';

    let csv = '';

    // ── REPORT HEADER ──────────────────────────────────────────────────────────
    csv += `"NESTLÉ CONNECT"\r\n`;
    csv += `"Marketing ROI Performance Report"\r\n`;
    csv += `"Confidential — For Internal Use Only"\r\n`;
    csv += `"Generated On:","${reportDate} at ${reportTime}"\r\n`;
    csv += `"Reporting Period:","All Time (up to ${reportDate})"\r\n`;
    csv += `\r\n`;

    // ── EXECUTIVE SUMMARY ──────────────────────────────────────────────────────
    csv += `"━━━ SECTION 1: EXECUTIVE SUMMARY ━━━"\r\n`;
    csv += `"Metric","Value"\r\n`;
    csv += `"Total Vouchers Claimed","${fmtNum(totalClaims)}"\r\n`;
    csv += `"Total Vouchers Redeemed","${fmtNum(totalRedeemed)}"\r\n`;
    csv += `"Total Pending Vouchers","${fmtNum(totalPending)}"\r\n`;
    csv += `"Total Expired Vouchers","${fmtNum(totalExpired)}"\r\n`;
    csv += `"Overall Conversion Rate","${overallCR}%"\r\n`;
    csv += `"Total Active Campaigns","${campaignRows.rows.filter(r => r.status === 'active').length}"\r\n`;
    csv += `"Total Campaigns (All)","${campaignRows.rows.length}"\r\n`;
    csv += `\r\n`;

    // ── CAMPAIGN PERFORMANCE ───────────────────────────────────────────────────
    csv += `"━━━ SECTION 2: CAMPAIGN PERFORMANCE & FINANCIAL ANALYSIS ━━━"\r\n`;
    csv += [
      'Campaign ID', 'Campaign Name', 'Status',
      'Objective', 'Target Audience',
      'Start Date', 'End Date', 'Duration (days)',
      'Budget (LKR)', 'Voucher Value (LKR)', 'Voucher Limit',
      'Total Claims', 'Redeemed', 'Pending', 'Expired',
      'Conversion Rate (%)',
      'Money Spent (LKR)', 'Budget Utilization (%)',
      'Cost Per Acquisition (LKR)', 'Projected Liability (LKR)'
    ].map(q).join(',') + '\r\n';

    campaignRows.rows.forEach(r => {
      const budget      = parseFloat(r.budget) || 0;
      const voucherVal  = parseFloat(r.voucher_value) || 0;
      const vLimit      = parseInt(r.voucher_limit, 10) || 0;
      const redeemed    = parseInt(r.redeemed_count, 10) || 0;
      const pending     = parseInt(r.pending_count, 10) || 0;
      const expired     = parseInt(r.expired_count, 10) || 0;
      const claims      = parseInt(r.total_claims, 10) || 0;
      const moneySpent  = redeemed * voucherVal;
      const budgetPct   = budget > 0 ? ((moneySpent / budget) * 100).toFixed(1) : 'N/A';
      const cpa         = redeemed > 0 && budget > 0 ? (budget / redeemed).toFixed(2) : 'N/A';
      const liability   = (pending * voucherVal).toFixed(2);
      const startD      = r.start_date ? new Date(r.start_date) : null;
      const endD        = r.end_date   ? new Date(r.end_date)   : null;
      const duration    = startD && endD ? Math.round((endD - startD) / 86400000) : 'N/A';

      csv += [
        r.campaign_id, r.campaign_name || '', r.status || '',
        r.objective || '', r.target_audience || '',
        fmtDate(r.start_date), fmtDate(r.end_date), duration,
        budget.toFixed(2), voucherVal.toFixed(2), vLimit || 'Unlimited',
        claims, redeemed, pending, expired,
        r.conversion_rate || '0.0',
        moneySpent.toFixed(2), budgetPct,
        cpa, liability
      ].map(q).join(',') + '\r\n';
    });
    csv += '\r\n';

    // ── PLATFORM ANALYTICS ────────────────────────────────────────────────────
    csv += `"━━━ SECTION 3: PLATFORM & CHANNEL ANALYTICS ━━━"\r\n`;
    csv += ['Platform', 'Total Claims', 'Redeemed', 'Pending', 'Expired', 'Conversion Rate (%)'].map(q).join(',') + '\r\n';
    channelRows.rows.forEach(r => {
      csv += [
        r.platform,
        r.claim_count, r.redeemed_count, r.pending_count || 0, r.expired_count || 0,
        r.conversion_rate || '0.0'
      ].map(q).join(',') + '\r\n';
    });
    csv += '\r\n';

    // ── GEOGRAPHIC BREAKDOWN ──────────────────────────────────────────────────
    csv += `"━━━ SECTION 4: GEOGRAPHIC PERFORMANCE (PROVINCE / REGION / AREA) ━━━"\r\n`;
    csv += ['Province', 'Region', 'Area', 'Redemptions'].map(q).join(',') + '\r\n';
    locationRows.rows.forEach(r => {
      csv += [r.province || 'Unknown', r.region || 'Unknown', r.area || 'Unknown', r.redemption_count].map(q).join(',') + '\r\n';
    });
    csv += '\r\n';

    // ── 30-DAY DAILY TREND ────────────────────────────────────────────────────
    csv += `"━━━ SECTION 5: 30-DAY DAILY ACTIVITY TREND ━━━"\r\n`;
    csv += ['Date', 'Claims', 'Redemptions', 'Daily Conversion Rate (%)'].map(q).join(',') + '\r\n';
    trendRows.rows.forEach(r => {
      const dayClaims   = parseInt(r.claims, 10) || 0;
      const dayRedeemed = parseInt(r.redemptions, 10) || 0;
      const dayCR       = dayClaims > 0 ? ((dayRedeemed / dayClaims) * 100).toFixed(1) : '0.0';
      csv += [fmtDate(r.day), dayClaims, dayRedeemed, dayCR].map(q).join(',') + '\r\n';
    });
    csv += '\r\n';

    // ── REPORT FOOTER ──────────────────────────────────────────────────────────
    csv += `"━━━ END OF REPORT ━━━"\r\n`;
    csv += `"This report is auto-generated by Nestlé Connect Analytics Engine."\r\n`;
    csv += `"Data reflects live database state at time of export."\r\n`;
    csv += `"For queries contact: Nestlé Connect Administration"\r\n`;

    // Generate a timestamped filename
    const fileTs = now.toISOString().slice(0, 10);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="Nestle_Connect_ROI_Report_${fileTs}.csv"`);
    // BOM for Excel compatibility (UTF-8)
    return res.send('\uFEFF' + csv);
  } catch (error) {
    console.error("exportROIReport error:", error);
    res.status(500).json({ message: "Server error while exporting ROI report" });
  }
};

const getCampaignAnalytics = async (req, res) => {
  const { campaign_id } = req.params;
  try {
    // Funnel for this campaign
    const funnel = await pool.query(`
      SELECT
        COUNT(*) as total_claims,
        SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as total_redeemed,
        SUM(CASE WHEN claim_status = 'expired'  THEN 1 ELSE 0 END) as total_expired,
        SUM(CASE WHEN claim_status = 'claimed'  THEN 1 ELSE 0 END) as total_pending
      FROM vouchers WHERE campaign_id = $1
    `, [campaign_id]);

    // Platform breakdown for this campaign
    const platforms = await pool.query(`
      SELECT
        COALESCE(NULLIF(platform, ''), 'other') as platform,
        COUNT(*) as claim_count,
        SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as redeemed_count,
        ROUND(100.0 * SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as conversion_rate
      FROM vouchers WHERE campaign_id = $1
      GROUP BY COALESCE(NULLIF(platform, ''), 'other')
      ORDER BY claim_count DESC
    `, [campaign_id]);

    // Daily trend (last 30 days) for this campaign
    const trend = await pool.query(`
      SELECT
        DATE(created_at) as day,
        COUNT(*) as claims,
        SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as redemptions
      FROM vouchers
      WHERE campaign_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `, [campaign_id]);

    // Top regions for this campaign (via redemptions)
    const regions = await pool.query(`
      SELECT s.province, s.region, s.area, COUNT(r.id) as redemption_count
      FROM redemptions r
      JOIN shops s ON r.shop_id = s.shop_id
      JOIN vouchers v ON r.claim_id = v.claim_id
      WHERE v.campaign_id = $1 AND s.province IS NOT NULL
      GROUP BY s.province, s.region, s.area
      ORDER BY redemption_count DESC
    `, [campaign_id]);

    // Campaign meta
    const meta = await pool.query(`SELECT * FROM campaigns WHERE campaign_id = $1`, [campaign_id]);

    res.json({
      meta: meta.rows[0] || {},
      funnel: funnel.rows[0],
      platforms: platforms.rows,
      trend: trend.rows,
      regions: regions.rows
    });
  } catch (error) {
    console.error('getCampaignAnalytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getROISummary, exportROIReport, getCampaignAnalytics };
