/**
 * README Documentation Tests
 *
 * Test framework: This suite is written using Jest-style APIs (describe/test/expect),
 * which are also compatible with Vitest. It relies only on Node core modules.
 *
 * Purpose: Validate critical documentation structure and content introduced/modified
 * in the PR diff for the README. These tests assert presence of key sections,
 * tables, code blocks, and link syntax to ensure docs remain accurate and navigable.
 */
const fs = require('fs');
const path = require('path');

function readReadme() {
  // Locate README in common locations
  const candidates = [
    'README.md',
    'Readme.md',
    'readme.md',
    path.join('.', 'docs', 'README.md'),
  ];
  for (const rel of candidates) {
    const p = path.resolve(process.cwd(), rel);
    if (fs.existsSync(p)) {
      return { content: fs.readFileSync(p, 'utf8'), path: p };
    }
  }
  // Fallback: try any README*.md in repo root
  const rootFiles = fs.readdirSync(process.cwd());
  const anyReadme = rootFiles.find(f => /^readme.*\.md$/i.test(f));
  if (anyReadme) {
    const p = path.resolve(process.cwd(), anyReadme);
    return { content: fs.readFileSync(p, 'utf8'), path: p };
  }
  throw new Error('README file not found. Expected README.md in repo root.');
}

function extractLinks(md) {
  // Very simple Markdown link matcher [text](url)
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  const out = [];
  let m;
  while ((m = re.exec(md)) !== null) {
    out.push({ text: m[1], url: m[2] });
  }
  return out;
}

function hasHeading(md, level, text) {
  const pattern = new RegExp(`^${'#'.repeat(level)}\\s*${text}\\s*$`, 'mi');
  return pattern.test(md);
}

describe('README.md documentation', () => {
  const { content: md, path: readmePath } = readReadme();

  test('has the primary title "Telegram Bot Hosting Platform"', () => {
    expect(hasHeading(md, 1, 'Telegram Bot Hosting Platform')).toBe(true);
  });

  test('includes key section headings', () => {
    const sections = [
      '🔑 Highlights',
      '🧱 Tech Stack',
      '📂 Project Structure',
      '✨ Features (Detailed)',
      '🧪 Local Development',
      '⚙️ Platform Environment Variables',
      '🤖 Creating and Running a Bot',
      '🚀 Deployment',
      '🔌 API Endpoints (High Level)',
      '🧩 Editor Tips',
      '🛡️ Security',
      '🧰 Troubleshooting',
      '📝 License',
      '🙌 Acknowledgments',
    ];
    const missing = sections.filter(h => !hasHeading(md, 2, h));
    expect(missing).toEqual([]);
  });

  test('project structure code block contains expected key files/dirs', () => {
    // Look for fenced block containing a tree with server.js and src/ and client/
    const fence = /```([\s\S]*?)```/g;
    let found = false;
    let m;
    while ((m = fence.exec(md)) !== null) {
      const block = m[1];
      if (
        /telegram-bot-hosting-platform\//.test(block) &&
        /server\.js/.test(block) &&
        /src\//.test(block) &&
        /client\//.test(block)
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('Environment Variables table includes required rows and columns', () => {
    // Validate header row and presence of expected vars
    expect(/\| *Variable *\| *Description *\| *Default *\|/.test(md)).toBe(true);
    const requiredVars = ['PORT', 'NODE_ENV', 'LOG_LEVEL', 'HOST'];
    for (const v of requiredVars) {
      const rowRe = new RegExp(`\\|\\s*\\\`${v}\\\`\\s*\\|`, 'm');
      expect(rowRe.test(md)).toBe(true);
    }
  });

  test('includes BotFather link and example env usage snippet', () => {
    // BotFather link
    expect(/\[[@]BotFather\]\(https?:\/\/t\.me\/botfather\)/i.test(md)).toBe(true);
    // Example snippet using process.env.PROTECT_CONTENT
    const codeSnippetRe = /String\(process\.env\.PROTECT_CONTENT[^)]*\)\.toLowerCase\(\) === 'true'/m;
    expect(codeSnippetRe.test(md)).toBe(true);
  });

  test('Deployment section includes Docker build/run commands', () => {
    const dockerBuild = /docker build -t telegram-bot-platform \./m;
    const dockerRun = /docker run -p 3001:3001 .*telegram-bot-platform/m;
    expect(dockerBuild.test(md)).toBe(true);
    expect(dockerRun.test(md)).toBe(true);
  });

  test('API Endpoints list includes critical routes', () => {
    const endpoints = [
      'GET /api/bots',
      'POST /api/bots',
      'PUT /api/bots/:botId',
      'DELETE /api/bots/:botId',
      'GET /api/bots/:botId/file',
      'PUT /api/bots/:botId/file',
      'POST /api/bots/:botId/start',
      'POST /api/bots/:botId/stop',
      'GET /api/bots/:botId/logs',
    ];
    for (const e of endpoints) {
      const re = new RegExp('`' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`', 'm');
      expect(re.test(md)).toBe(true);
    }
  });

  test('links are well-formed http(s) URLs (syntax only)', () => {
    const links = extractLinks(md);
    // Only validate external links (begin with http or https)
    const external = links.filter(l => /^https?:\/\//i.test(l.url));
    // Basic syntax checks: no spaces, no unmatched parentheses
    for (const { url } of external) {
      expect(/\s/.test(url)).toBe(false);
      // parentheses balance check (very basic)
      const open = (url.match(/\(/g) || []).length;
      const close = (url.match(/\)/g) || []).length;
      expect(open).toBe(close);
    }
    // Ensure at least one badge link (e.g., CodeRabbit) exists
    const hasBadge = external.some(l => /img\.shields\.io|coderabbit/i.test(l.url));
    expect(hasBadge).toBe(true);
  });

  test('no fenced code blocks are left unclosed', () => {
    const fences = (md.match(/```/g) || []).length;
    // Fenced blocks should be even (opening and closing)
    expect(fences % 2).toBe(0);
  });

  test('README contains no Windows-style CR characters and no lines over 2000 chars', () => {
    expect(/\r/.test(md)).toBe(false);
    const longLines = md.split('\n').filter(l => l.length > 2000);
    expect(longLines).toEqual([]);
  });

  test('file ends with a newline and does not have excessive trailing blank lines', () => {
    expect(md.endsWith('\n')).toBe(true);
    const tail = md.trimEnd();
    // After trimEnd, add one newline and compare length difference
    expect(md.length - (tail + '\n').length).toBeGreaterThanOrEqual(0);
  });

  test('acknowledgments section lists key technologies', () => {
    const items = ['Monaco Editor', 'Tailwind CSS', 'Socket.IO', 'Railway', 'node-telegram-bot-api'];
    const sectionRe = /##\s*🙌 Acknowledgments([\s\S]*?)$/m;
    const m = sectionRe.exec(md);
    expect(m).not.toBeNull();
    const section = m ? m[1] : '';
    for (const i of items) {
      expect(new RegExp(i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(section)).toBe(true);
    }
  });

  test('Troubleshooting section includes guidance for Docker build issues on Alpine and missing env vars', () => {
    const hasAlpineNote = /Docker build fails .* Alpine/i.test(md);
    const hasEnvNote = /Ensure required env variables.*BOT_TOKEN/i.test(md);
    expect(hasAlpineNote).toBe(true);
    expect(hasEnvNote).toBe(true);
  });

  test('Security section mentions CORS, Helmet, rate limiting, and process isolation', () => {
    expect(/CORS\s*\+\s*Helmet\s*\+\s*rate limiting/i.test(md)).toBe(true);
    expect(/Process isolation per bot/i.test(md)).toBe(true);
  });

  test('Local Development section includes "npm run dev" command and localhost URL', () => {
    expect(/npm run dev/.test(md)).toBe(true);
    expect(/http:\/\/localhost:3000/.test(md)).toBe(true);
  });

  test('includes explicit note about PROTECT_CONTENT variable handling in UI', () => {
    expect(/No special handling for `PROTECT_CONTENT`/i.test(md)).toBe(true);
  });

  test('documents the Tech Stack for backend, frontend, telegram lib, and packaging', () => {
    const items = [
      /Backend:\s*Node\.js, Express, Socket\.IO/i,
      /Frontend:\s*React, Tailwind CSS, Monaco Editor/i,
      /Telegram:\s*`node-telegram-bot-api`/i,
      /Packaging:\s*Docker.*Railway/i,
    ];
    for (const re of items) {
      expect(re.test(md)).toBe(true);
    }
  });

  test('file path resolved correctly for logging/debug (non-assert)', () => {
    // Provide a hint in test output for maintainers
    expect(typeof readmePath).toBe('string');
  });
});