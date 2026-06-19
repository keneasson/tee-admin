/**
 * TEE Admin Health Monitor - AWS Lambda Function
 *
 * Runs every 6 hours via EventBridge to verify:
 * 1. Main site is accessible
 * 2. Newsletter API returns schedule data
 * 3. Enhanced schedule API returns memorial, bibleClass, sundaySchool data
 *
 * Sends email alert via SES if any check fails.
 */

const https = require('https');

// Configuration
const CONFIG = {
  baseUrl: 'https://www.tee-admin.com',
  alertEmail: process.env.ALERT_EMAIL || 'ken.easson@gmail.com',
  fromEmail: process.env.FROM_EMAIL || 'noreply@tee-admin.com',
  timeout: 30000, // 30 seconds
};

// Health check endpoints
const ENDPOINTS = [
  {
    name: 'Homepage',
    path: '/',
    expectedStatus: 200,
    validate: (body) => body.includes('<!DOCTYPE html'),
  },
  {
    name: 'Newsletter API (upcoming-program)',
    path: '/api/upcoming-program',
    expectedStatus: 200,
    validate: (body) => {
      try {
        const data = JSON.parse(body);
        // Should be an array with events
        if (!Array.isArray(data)) {
          return { ok: false, error: 'Expected array, got ' + typeof data };
        }
        if (data.length === 0) {
          return { ok: false, error: 'Empty array - no upcoming events' };
        }
        // Check first event has expected fields
        const first = data[0];
        if (!first.Date || !first.Key) {
          return { ok: false, error: 'Missing Date or Key field in event' };
        }
        return { ok: true, count: data.length };
      } catch (e) {
        return { ok: false, error: 'JSON parse error: ' + e.message };
      }
    },
  },
  {
    name: 'Schedule API - Memorial',
    path: '/api/enhanced-schedule?types=memorial&fromDate=' + getTodayDate(),
    expectedStatus: 200,
    validate: (body) => validateScheduleResponse(body, 'memorial'),
  },
  {
    name: 'Schedule API - Bible Class',
    path: '/api/enhanced-schedule?types=bibleClass&fromDate=' + getTodayDate(),
    expectedStatus: 200,
    validate: (body) => validateScheduleResponse(body, 'bibleClass'),
  },
  {
    name: 'Schedule API - Sunday School',
    path: '/api/enhanced-schedule?types=sundaySchool&fromDate=' + getTodayDate(),
    expectedStatus: 200,
    validate: (body) =>
      validateScheduleResponse(body, 'sundaySchool', {
        // Sunday School breaks for the summer; an empty schedule is correct
        // during the recess, so don't alert on it then.
        allowEmpty: isSundaySchoolInRecess(),
        emptyNote: 'Sunday School in recess — empty schedule expected',
      }),
  },
];

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Sunday School breaks for the summer and resumes in September. While it's in
// recess an empty sundaySchool schedule is CORRECT, not a failure, so we skip
// the "empty array" alert during this window (other failures — non-200, bad
// JSON, missing structure — still alert). The window recurs every year, so no
// annual edits are needed. Override via env vars if the schedule changes
// (format: "MM-DD", UTC).
const SUNDAY_SCHOOL_RECESS_START = process.env.SUNDAY_SCHOOL_RECESS_START || '06-15'; // mid-June
const SUNDAY_SCHOOL_RECESS_END = process.env.SUNDAY_SCHOOL_RECESS_END || '09-01';     // resumes early September

function isSundaySchoolInRecess(date = new Date()) {
  const [startM, startD] = SUNDAY_SCHOOL_RECESS_START.split('-').map(Number);
  const [endM, endD] = SUNDAY_SCHOOL_RECESS_END.split('-').map(Number);
  // Encode month/day as MMDD so the window is a simple numeric range. Recess
  // does not wrap the year boundary, so no wrap handling is needed.
  const md = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const start = startM * 100 + startD;
  const end = endM * 100 + endD;
  return md >= start && md < end; // end-exclusive: resumes on the end date
}

function validateScheduleResponse(body, expectedType, options = {}) {
  try {
    const data = JSON.parse(body);

    // Check structure
    if (!data.data || typeof data.data !== 'object') {
      return { ok: false, error: 'Missing data object' };
    }

    // Check for the expected type
    const events = data.data[expectedType];
    if (!Array.isArray(events)) {
      return { ok: false, error: `Missing ${expectedType} array` };
    }

    if (events.length === 0) {
      // An empty array is a failure unless the caller says empty is expected
      // (e.g. Sunday School during its summer recess).
      if (options.allowEmpty) {
        return { ok: true, count: 0, type: expectedType, note: options.emptyNote || 'empty is expected' };
      }
      return { ok: false, error: `Empty ${expectedType} array - no events` };
    }

    // Check first event has date
    if (!events[0].date) {
      return { ok: false, error: 'First event missing date field' };
    }

    return { ok: true, count: events.length, type: expectedType };
  } catch (e) {
    return { ok: false, error: 'JSON parse error: ' + e.message };
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const req = https.get(url, { timeout: CONFIG.timeout }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body,
          responseTime: Date.now() - startTime,
          headers: res.headers,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function runHealthChecks() {
  const results = [];

  for (const endpoint of ENDPOINTS) {
    const url = CONFIG.baseUrl + endpoint.path;
    console.log(`Checking: ${endpoint.name}`);

    try {
      const response = await makeRequest(url);

      // Check status code
      if (response.status !== endpoint.expectedStatus) {
        results.push({
          name: endpoint.name,
          success: false,
          error: `Expected status ${endpoint.expectedStatus}, got ${response.status}`,
          responseTime: response.responseTime,
        });
        continue;
      }

      // Run custom validation
      const validation = endpoint.validate(response.body);

      if (typeof validation === 'boolean') {
        results.push({
          name: endpoint.name,
          success: validation,
          error: validation ? null : 'Validation failed',
          responseTime: response.responseTime,
        });
      } else if (validation.ok) {
        results.push({
          name: endpoint.name,
          success: true,
          details: validation,
          responseTime: response.responseTime,
        });
      } else {
        results.push({
          name: endpoint.name,
          success: false,
          error: validation.error,
          responseTime: response.responseTime,
        });
      }

    } catch (error) {
      results.push({
        name: endpoint.name,
        success: false,
        error: error.message,
        responseTime: null,
      });
    }
  }

  return results;
}

async function sendAlertEmail(failures, allResults) {
  // Only import SES if we need to send an alert
  const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

  const ses = new SESClient({ region: process.env.AWS_REGION || 'ca-central-1' });

  const failureDetails = failures.map(f =>
    `❌ ${f.name}\n   Error: ${f.error}\n   Response time: ${f.responseTime || 'N/A'}ms`
  ).join('\n\n');

  const allDetails = allResults.map(r =>
    `${r.success ? '✅' : '❌'} ${r.name} (${r.responseTime || 'N/A'}ms)${r.error ? '\n   ' + r.error : ''}`
  ).join('\n');

  const emailBody = `
TEE Admin Health Check Alert
=============================
Time: ${new Date().toISOString()}

🚨 FAILURES DETECTED:
${failureDetails}

FULL REPORT:
${allDetails}

---
This is an automated alert from the TEE Admin health monitoring system.
Check CloudWatch logs for more details.
`;

  const command = new SendEmailCommand({
    Source: CONFIG.fromEmail,
    Destination: {
      ToAddresses: [CONFIG.alertEmail],
    },
    Message: {
      Subject: {
        Data: `🚨 TEE Admin Health Check Failed - ${failures.length} issue(s)`,
      },
      Body: {
        Text: {
          Data: emailBody,
        },
      },
    },
  });

  await ses.send(command);
  console.log('Alert email sent to', CONFIG.alertEmail);
}

// Lambda handler
exports.handler = async (event) => {
  console.log('Starting TEE Admin health check...');
  console.log('Event:', JSON.stringify(event));

  const results = await runHealthChecks();

  // Log all results
  console.log('Health check results:', JSON.stringify(results, null, 2));

  // Check for failures
  const failures = results.filter(r => !r.success);
  const successCount = results.length - failures.length;

  console.log(`Results: ${successCount}/${results.length} checks passed`);

  // Send alert if there are failures
  if (failures.length > 0) {
    console.log('Failures detected, sending alert...');
    try {
      await sendAlertEmail(failures, results);
    } catch (emailError) {
      console.error('Failed to send alert email:', emailError);
    }
  }

  return {
    statusCode: failures.length > 0 ? 500 : 200,
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      totalChecks: results.length,
      passed: successCount,
      failed: failures.length,
      results,
    }),
  };
};

// For local testing
if (require.main === module) {
  exports.handler({}).then(result => {
    console.log('Result:', JSON.stringify(result, null, 2));
  });
}
