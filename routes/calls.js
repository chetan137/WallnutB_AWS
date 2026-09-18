'use strict';

const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const logger = require('../utils/logger');

/**
 * GET /api/calls
 * Fetch all recorded daily sales calls & visits.
 */
router.get('/', async (req, res) => {
  try {
    const { salesOfficer, district, state, from, to } = req.query;
    const conditions = [];
    const params = [];

    if (salesOfficer) {
      params.push(salesOfficer);
      conditions.push(`sales_officer = $${params.length}`);
    }
    if (district) {
      params.push(district);
      conditions.push(`district = $${params.length}`);
    }
    if (state) {
      params.push(state);
      conditions.push(`state = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`call_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`call_date <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        id::text,
        dealer,
        COALESCE(sales_officer, '') AS "salesMan",
        COALESCE(caller_role, '')   AS "callerRole",
        COALESCE(district, '')      AS district,
        COALESCE(state, '')         AS state,
        call_date                   AS date,
        COALESCE(call_type, 'Phone Call') AS "callType",
        COALESCE(purpose, 'Payment Follow-up') AS purpose,
        COALESCE(notes, '')         AS notes,
        COALESCE(status, 'Completed') AS status,
        created_at                  AS "createdAt"
      FROM sales_calls
      ${whereClause}
      ORDER BY call_date DESC, created_at DESC
      LIMIT 1000
    `;

    const { rows } = await query(sql, params);
    res.json({
      ok: true,
      count: rows.length,
      calls: rows,
    });
  } catch (err) {
    logger.error('Failed to fetch sales calls', { error: err.message });
    res.status(500).json({ ok: false, error: 'Failed to retrieve sales calls from database' });
  }
});

/**
 * POST /api/calls
 * Log a new daily sales call / visit.
 */
router.post('/', async (req, res) => {
  try {
    const {
      dealer,
      salesMan,
      salesOfficer,
      callerRole,
      district,
      state,
      date,
      callDate,
      callType,
      purpose,
      notes,
      status,
    } = req.body;

    if (!dealer) {
      return res.status(400).json({ ok: false, error: 'Dealer name is required' });
    }

    const officer = salesMan || salesOfficer || 'Sales Team';
    const cDate = date || callDate || new Date().toISOString().split('T')[0];
    const cType = callType || 'Phone Call';
    const cPurpose = purpose || 'Payment Follow-up';
    const cRole = callerRole || 'sales_officer';
    const cDistrict = district || 'General';
    const cState = state || 'General';
    const cStatus = status || 'Completed';
    const cNotes = notes || '';

    const sql = `
      INSERT INTO sales_calls (
        dealer, sales_officer, caller_role, district, state, call_date, call_type, purpose, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id::text,
        dealer,
        sales_officer AS "salesMan",
        caller_role   AS "callerRole",
        district,
        state,
        call_date     AS date,
        call_type     AS "callType",
        purpose,
        notes,
        status,
        created_at    AS "createdAt"
    `;

    const { rows } = await query(sql, [
      dealer,
      officer,
      cRole,
      cDistrict,
      cState,
      cDate,
      cType,
      cPurpose,
      cNotes,
      cStatus,
    ]);

    logger.info(`New sales call logged into PostgreSQL: ${dealer} (${cType}) by ${officer}`);

    res.status(201).json({
      ok: true,
      message: 'Sales call logged successfully',
      call: rows[0],
    });
  } catch (err) {
    logger.error('Failed to save sales call', { error: err.message });
    res.status(500).json({ ok: false, error: 'Failed to save sales call to database' });
  }
});

module.exports = router;
