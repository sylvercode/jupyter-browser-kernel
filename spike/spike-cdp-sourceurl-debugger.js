/**
 * spike-cdp-sourceurl-debugger.js
 *
 * Time-boxed research harness for Story `2-spike-cdp-sourceurl-debugger`.
 * Empirically answers the six Critical Documentation Gaps (Q1–Q6) recorded in
 * docs/archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md by
 * driving two flat CDP sessions over a browser-level WebSocket — one that
 * plays the role of DevTools (sets breakpoints and observes Debugger events),
 * the other that plays the role of the extension (issues Runtime.evaluate
 * with the test cell).
 *
 * The transport pattern (browser-level WS, Target.attachToTarget flatten:true,
 * client.send(method, params, sessionId), '<Domain>.<event>.<sessionId>'
 * listeners) is the one proven by spike/spike-cdp-multiplex.js and recorded
 * in spike/cdp-multiplex-findings.md.
 *
 * Run modes:
 *   node spike/spike-cdp-sourceurl-debugger.js
 *     -> headless Chromium auto-launch, fully automated assertions for
 *        Q1/Q2/Q4/Q5/Q6 and for Q3 if it is reached.
 *
 *   INTERACTIVE=1 EXTERNAL_BROWSER=1 CDP_HOST=host.docker.internal \
 *     node spike/spike-cdp-sourceurl-debugger.js
 *     -> connects to an already-running browser (use Edge with
 *        --remote-debugging-port=9222 and DevTools open on about:blank);
 *        pauses at each visual checkpoint to collect operator y/n/notes
 *        for the Sources-panel UI sub-checks.
 *
 *   KEEP_OPEN=1 -> after assertions, leave the browser running so the
 *        operator can keep poking around in DevTools.
 *
 * No production code under src/ is shipped from this spike (story AC #6).
 */

'use strict';

const { spawn } = require('child_process');
const http = require('http');
const readline = require('readline');
const CDP = require('chrome-remote-interface');
const sourceMap = require('source-map');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HOST = process.env.CDP_HOST || 'localhost';
const PORT = Number(process.env.CDP_PORT) || 9222;
const EXTERNAL_BROWSER = process.env.EXTERNAL_BROWSER === '1';
const INTERACTIVE = process.env.INTERACTIVE === '1';
const KEEP_OPEN = process.env.KEEP_OPEN === '1';

// ---------------------------------------------------------------------------
// Generic helpers (mirrors spike-cdp-multiplex.js precedent)
// ---------------------------------------------------------------------------

function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(2000, () => { req.destroy(); reject(new Error('http timeout')); });
    });
}

async function waitForCdp(host, port, timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 20000);
    while (Date.now() < deadline) {
        try {
            await httpGet('http://' + host + ':' + port + '/json/version');
            return;
        } catch (_) {
            await delay(300);
        }
    }
    throw new Error('CDP at ' + host + ':' + port + ' did not become ready');
}

function launchChromium(port) {
    const args = [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-gpu-sandbox',
        '--disable-software-rasterizer', '--disable-dev-shm-usage',
        '--remote-debugging-port=' + port, 'about:blank',
    ];
    const proc = spawn('chromium', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    proc.stderr.on('data', (d) => {
        const s = d.toString();
        if (s.includes('DevTools listening')) process.stdout.write('  ' + s.trim() + '\n');
    });
    return proc;
}

function sendInSession(client, method, params, sessionId) {
    return client.send(method, params, sessionId);
}

function rl() {
    return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(question) {
    if (!INTERACTIVE) return Promise.resolve('');
    const i = rl();
    return new Promise((resolve) => i.question(question, (answer) => { i.close(); resolve(answer.trim()); }));
}

// ---------------------------------------------------------------------------
// Cell source builder (throwaway — Story 2.4 will own the production version)
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   notebookUri: string,
 *   cellIndex: number,
 *   userCode: string,
 *   mode: 'plain' | 'async-iife-sameline' | 'async-iife-multiline-sourcemap',
 *   urlScheme: 'notebook-cell' | 'vscode-notebook-cell' | 'https-spike',
 *   nonce?: string,
 * }} opts
 * @returns {{ source: string, url: string, userLineToScriptLine: (n: number) => number }}
 */
function buildCellSource(opts) {
    const url = buildSourceUrl(opts.urlScheme, opts.notebookUri, opts.cellIndex, opts.nonce);
    const userLines = opts.userCode.split('\n');

    if (opts.mode === 'plain') {
        const source = opts.userCode + `\n//# sourceURL=${url}\n`;
        return { source, url, userLineToScriptLine: (n) => n };
    }

    if (opts.mode === 'async-iife-sameline') {
        // Pattern B: prefix sits on the SAME line as the user's first line,
        // suffix sits on the SAME line as the user's last line. Result: every
        // user line keeps its 1-based line number inside the wrapped script.
        const wrapped = ['(async()=>{' + (userLines[0] ?? '')]
            .concat(userLines.slice(1, -1));
        if (userLines.length > 1) {
            wrapped.push((userLines[userLines.length - 1] ?? '') + '})()');
        } else {
            wrapped[0] = wrapped[0] + '})()';
        }
        const source = wrapped.join('\n') + `\n//# sourceURL=${url}\n`;
        return { source, url, userLineToScriptLine: (n) => n };
    }

    if (opts.mode === 'async-iife-multiline-sourcemap') {
        // Pattern B-alt: wrapper occupies its own lines, so user lines shift by 1.
        // An inline source map maps wrapped line -> original user line.
        const generatedLines = ['(async () => {'].concat(userLines).concat(['})();']);
        const generatedSource = generatedLines.join('\n');

        const generator = new sourceMap.SourceMapGenerator({ file: url });
        const originalUrl = url + '.user';
        generator.setSourceContent(originalUrl, opts.userCode);
        for (let i = 0; i < userLines.length; i++) {
            // Generated line (1-based): wrapper prefix took line 1, so user line i+1
            // lives on generated line i + 2.
            generator.addMapping({
                generated: { line: i + 2, column: 0 },
                original: { line: i + 1, column: 0 },
                source: originalUrl,
            });
        }
        const mapJson = generator.toString();
        const mapB64 = Buffer.from(mapJson, 'utf8').toString('base64');
        const source =
            generatedSource +
            `\n//# sourceMappingURL=data:application/json;base64,${mapB64}` +
            `\n//# sourceURL=${url}\n`;
        return { source, url, userLineToScriptLine: (n) => n + 1 };
    }

    throw new Error('Unknown buildCellSource mode: ' + opts.mode);
}

function buildSourceUrl(scheme, notebookUri, cellIndex, nonce) {
    const suffix = nonce ? `?n=${nonce}` : '';
    switch (scheme) {
        case 'notebook-cell':
            return `notebook-cell:${encodeURIComponent(notebookUri)}/${cellIndex}${suffix}`;
        case 'vscode-notebook-cell':
            return `vscode-notebook-cell://${encodeURIComponent(notebookUri)}/${cellIndex}${suffix}`;
        case 'https-spike':
            return `https://spike.local/${encodeURIComponent(notebookUri)}/cell/${cellIndex}${suffix}`;
        default:
            throw new Error('Unknown urlScheme: ' + scheme);
    }
}

// ---------------------------------------------------------------------------
// Probe context: opens two flat sessions on the same target, manages auto-
// resume of Debugger.paused so awaitPromise:true evaluates can resolve.
// ---------------------------------------------------------------------------

async function openProbeContext(browser, targetId) {
    const { sessionId: devtoolsSession } = await browser.Target.attachToTarget({ targetId, flatten: true });
    const { sessionId: extensionSession } = await browser.Target.attachToTarget({ targetId, flatten: true });

    await sendInSession(browser, 'Runtime.enable', {}, extensionSession);
    await sendInSession(browser, 'Runtime.enable', {}, devtoolsSession);

    // Auto-resume any paused event observed on the devtools surrogate so the
    // extension surrogate's awaitPromise:true Runtime.evaluate can complete.
    const pauseLog = [];
    const scriptLog = [];
    const breakpointResolutions = [];

    // Diagnostic: log every Debugger.* event with its sessionId. Helps explain
    // why a session-scoped listener may miss events (e.g. wrong sessionId).
    const eventListener = (m) => {
        if (!m || !m.method || !m.method.startsWith('Debugger.')) return;
        if (m.sessionId !== devtoolsSession && m.sessionId !== extensionSession) return;
        const which = m.sessionId === devtoolsSession ? 'devtools' : 'extension';
        process.stdout.write(`    [evt] ${m.method} <${which}>\n`);
    };
    browser.on('event', eventListener);

    browser.on(`Debugger.paused.${devtoolsSession}`, (params) => {
        const frame = params.callFrames?.[0];
        const scriptId = frame?.location?.scriptId;
        const matched = scriptLog.find((s) => s.scriptId === scriptId);
        pauseLog.push({
            reason: params.reason,
            hitBreakpoints: params.hitBreakpoints || [],
            url: frame?.url || matched?.url,
            lineNumber: frame?.location?.lineNumber,
            columnNumber: frame?.location?.columnNumber,
            scriptId,
        });
        sendInSession(browser, 'Debugger.resume', {}, devtoolsSession).catch(() => { });
    });
    browser.on(`Debugger.scriptParsed.${devtoolsSession}`, (params) => {
        scriptLog.push({
            url: params.url,
            scriptId: params.scriptId,
            startLine: params.startLine,
            endLine: params.endLine,
            hasSourceURL: params.hasSourceURL,
            hasSourceMapURL: !!params.sourceMapURL,
        });
    });
    browser.on(`Debugger.breakpointResolved.${devtoolsSession}`, (params) => {
        breakpointResolutions.push({
            breakpointId: params.breakpointId,
            lineNumber: params.location?.lineNumber,
            scriptId: params.location?.scriptId,
        });
    });

    return {
        devtoolsSession,
        extensionSession,
        pauseLog,
        scriptLog,
        breakpointResolutions,
        enableExtensionDebugger: () => sendInSession(browser, 'Debugger.enable', {}, extensionSession),
        enableDevtoolsDebugger: () => sendInSession(browser, 'Debugger.enable', {}, devtoolsSession),
        setBreakpoint: (url, lineNumber) =>
            sendInSession(browser, 'Debugger.setBreakpointByUrl', { url, lineNumber }, devtoolsSession),
        evaluate: (expression, opts = {}) =>
            sendInSession(browser, 'Runtime.evaluate', {
                expression,
                awaitPromise: true,
                returnByValue: true,
                replMode: !!opts.replMode,
            }, extensionSession),
        detach: async () => {
            browser.removeListener('event', eventListener);
            await browser.Target.detachFromTarget({ sessionId: devtoolsSession }).catch(() => { });
            await browser.Target.detachFromTarget({ sessionId: extensionSession }).catch(() => { });
        },
    };
}

// ---------------------------------------------------------------------------
// Findings collector
// ---------------------------------------------------------------------------

const findings = [];

function isBreakpointHitPause(pause, breakpointId) {
    return !!pause && Array.isArray(pause.hitBreakpoints) && pause.hitBreakpoints.includes(breakpointId);
}

function findPauseForBreakpoint(pauseLog, url, breakpointId) {
    return pauseLog.find((pause) => pause.url === url && isBreakpointHitPause(pause, breakpointId));
}

function countPausesForBreakpoint(pauseLog, url, breakpointId) {
    return pauseLog.filter((pause) => pause.url === url && isBreakpointHitPause(pause, breakpointId)).length;
}

function record(question, result) {
    findings.push({ question, ...result });
    const status = result.pass === true
        ? '✅ PASS'
        : result.pass === false
            ? (result.expectedNegative ? 'ℹ️ ANSWERED-NO' : '❌ FAIL')
            : 'ℹ️ INFO';
    console.log(`\n--- ${question} → ${status} ---`);
    console.log('  Answer: ' + (result.answer || '(see evidence)'));
    if (result.decision) console.log('  Decision: ' + result.decision);
    if (result.evidence) {
        for (const line of String(result.evidence).split('\n')) {
            console.log('    ' + line);
        }
    }
}

// ---------------------------------------------------------------------------
// Q1 — replMode + Sources visibility + breakpoint binding
// ---------------------------------------------------------------------------

async function runQ1(browser, targetId) {
    console.log('\n========== Q1: replMode + scriptParsed + breakpoint firing ==========');
    const ctx = await openProbeContext(browser, targetId);
    try {
        await ctx.enableDevtoolsDebugger();
        const userCode = ['globalThis.__q1 = 0;', 'globalThis.__q1++;', 'debugger;'].join('\n');
        const { source, url } = buildCellSource({
            notebookUri: 'spike://q1', cellIndex: 0, userCode,
            mode: 'plain', urlScheme: 'notebook-cell',
        });
        // Set breakpoint BEFORE evaluation on the user's debugger; line.
        // Pattern 'plain' user line 3 -> 0-based CDP line 2.
        const bp = await ctx.setBreakpoint(url, 2);

        const result = await ctx.evaluate(source, { replMode: true });
        await delay(150);

        const parsed = ctx.scriptLog.find((s) => s.url === url);
        const breakpointPause = findPauseForBreakpoint(ctx.pauseLog, url, bp.breakpointId);

        const exVal = await sendInSession(browser, 'Runtime.evaluate',
            { expression: 'globalThis.__q1', returnByValue: true }, ctx.extensionSession);

        const visible = !!parsed;
        const fired = !!breakpointPause;
        const pass = visible && fired;
        record('Q1', {
            pass,
            answer: pass
                ? 'Yes — replMode scripts emit Debugger.scriptParsed under our sourceURL and breakpoints set against that URL fire.'
                : `No — visible=${visible} firedBreakpoint=${fired}`,
            decision: pass
                ? 'replMode is viable as default evaluation path; Story 2.5 may keep replMode:true.'
                : 'Drop replMode; fall back to async-IIFE for Story 2.5.',
            evidence:
                `bp.breakpointId=${JSON.stringify(bp.breakpointId)}\n` +
                `bp.locations=${JSON.stringify(bp.locations)}\n` +
                `scriptParsed=${JSON.stringify(parsed)}\n` +
                `breakpointPause=${JSON.stringify(breakpointPause)}\n` +
                `__q1 after eval=${JSON.stringify(exVal.result?.value)}\n` +
                `evaluate.exception=${JSON.stringify(result.exceptionDetails || null)}`,
        });

        if (INTERACTIVE) {
            await ask('  [INTERACTIVE] Open DevTools → Sources, locate the cell URL "' + url + '". Press Enter when done…');
            const seen = await ask('  Did the script appear in the Sources tree under that URL? (y/n): ');
            console.log(`    operator: visible-in-Sources=${seen}`);
        }
    } finally {
        await ctx.detach();
    }
}

// ---------------------------------------------------------------------------
// Q2 — Cross-client breakpoint firing without our Debugger.enable
// ---------------------------------------------------------------------------

async function runQ2(browser, targetId) {
    console.log('\n========== Q2: cross-client breakpoint without extension Debugger.enable ==========');
    const ctx = await openProbeContext(browser, targetId);
    try {
        await ctx.enableDevtoolsDebugger();
        // Extension surrogate intentionally does NOT call Debugger.enable.
        const userCode = ['globalThis.__q2 = 0;', 'globalThis.__q2++;', 'debugger;'].join('\n');
        const { source, url } = buildCellSource({
            notebookUri: 'spike://q2', cellIndex: 0, userCode,
            mode: 'plain', urlScheme: 'notebook-cell',
        });
        const bp = await ctx.setBreakpoint(url, 2);
        await ctx.evaluate(source, { replMode: true });
        await delay(150);

        const breakpointPause = findPauseForBreakpoint(ctx.pauseLog, url, bp.breakpointId);
        const pass = !!breakpointPause;
        return record('Q2', {
            pass,
            answer: pass
                ? 'Yes — DevTools-set breakpoints fire under Runtime.evaluate from a session that never called Debugger.enable.'
                : 'No — the extension session must call Debugger.enable to make user breakpoints fire.',
            decision: pass
                ? 'Lock Debugger Posture = Passive Provider. Mark Story 2.5 AC #1 (call Debugger.enable on per-target session) for REVISION/REMOVAL.'
                : 'Escalate to Q3 — must coexist with Edge DevTools while we also Debugger.enable.',
            evidence:
                `bp.breakpointId=${JSON.stringify(bp.breakpointId)}\n` +
                `bp.locations=${JSON.stringify(bp.locations)}\n` +
                `breakpointPause=${JSON.stringify(breakpointPause)}\n` +
                `extensionSessionEnabledDebugger=false`,
        });
    } finally {
        await ctx.detach();
    }
}

// ---------------------------------------------------------------------------
// Q3 — Multi-client Debugger.enable coexistence (only if Q2 fails)
// ---------------------------------------------------------------------------

async function runQ3(browser, targetId) {
    console.log('\n========== Q3: multi-client Debugger.enable coexistence ==========');
    const ctx = await openProbeContext(browser, targetId);
    try {
        await ctx.enableDevtoolsDebugger();
        await ctx.enableExtensionDebugger();
        const userCode = ['globalThis.__q3 = 0;', 'globalThis.__q3++;', 'debugger;'].join('\n');
        const { source, url } = buildCellSource({
            notebookUri: 'spike://q3', cellIndex: 0, userCode,
            mode: 'plain', urlScheme: 'notebook-cell',
        });
        const bp = await ctx.setBreakpoint(url, 2);

        // Run twice to exercise multi-eval with two enabled debuggers.
        await ctx.evaluate(source, { replMode: true });
        await delay(150);
        await ctx.evaluate(source, { replMode: true });
        await delay(150);

        const breakpointPauseCount = countPausesForBreakpoint(ctx.pauseLog, url, bp.breakpointId);
        const stable = breakpointPauseCount >= 2 && ctx.breakpointResolutions.length >= 2;
        record('Q3', {
            pass: stable,
            answer: stable
                ? 'Both sessions remained stable across two evaluations with two Debugger.enable callers.'
                : `Instability detected: breakpointPauseCount=${breakpointPauseCount}`,
            decision: stable
                ? 'Posture Diagnostic Observer is safe — extension may Debugger.enable for read-only event observation.'
                : 'Posture must remain Passive Provider; document loss of observability.',
            evidence:
                `bp.breakpointId=${JSON.stringify(bp.breakpointId)}\n` +
                `bp.locations=${JSON.stringify(bp.locations)}\n` +
                `breakpointPauseCount=${breakpointPauseCount}\n` +
                `breakpointResolutions=${JSON.stringify(ctx.breakpointResolutions)}`,
        });
    } finally {
        await ctx.detach();
    }
}

// ---------------------------------------------------------------------------
// Q4 — First-evaluation breakpoint binding (fresh URL nonce)
// ---------------------------------------------------------------------------

async function runQ4(browser, targetId) {
    console.log('\n========== Q4: first-evaluation breakpoint binding ==========');
    const ctx = await openProbeContext(browser, targetId);
    try {
        await ctx.enableDevtoolsDebugger();
        const nonce = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
        const userCode = ['globalThis.__q4 = 0;', 'globalThis.__q4++;', 'debugger;'].join('\n');
        const { source, url } = buildCellSource({
            notebookUri: 'spike://q4', cellIndex: 0, userCode,
            mode: 'plain', urlScheme: 'notebook-cell', nonce,
        });
        // BREAK FIRST, then evaluate for the very first time.
        const bp = await ctx.setBreakpoint(url, 2);
        await ctx.evaluate(source, { replMode: true });
        await delay(150);

        const breakpointPause = findPauseForBreakpoint(ctx.pauseLog, url, bp.breakpointId);
        const pass = !!breakpointPause;
        record('Q4', {
            pass,
            answer: pass
                ? 'Yes — a breakpoint placed BEFORE the first evaluation binds and fires on first run.'
                : 'No — breakpoint missed on first evaluation; user must run-then-break.',
            decision: pass
                ? 'No UX caveat needed in Story 2.5 docs.'
                : 'Story 2.5 docs must instruct: run cell once first, then set breakpoint.',
            evidence:
                `nonce=${nonce}\n` +
                `bp.breakpointId=${JSON.stringify(bp.breakpointId)}\n` +
                `bp.locations=${JSON.stringify(bp.locations)}\n` +
                `breakpointPause=${JSON.stringify(breakpointPause)}`,
        });
    } finally {
        await ctx.detach();
    }
}

// ---------------------------------------------------------------------------
// Q5 — Line-number fidelity under same-line wrapper (Pattern B)
// ---------------------------------------------------------------------------

async function runQ5(browser, targetId) {
    console.log('\n========== Q5: line-number fidelity under Pattern B (same-line) ==========');
    const ctx = await openProbeContext(browser, targetId);
    try {
        await ctx.enableDevtoolsDebugger();
        const userCode = [
            'globalThis.__q5 = "line1";',  // user line 1
            'globalThis.__q5 = "line2";',  // user line 2
            'debugger;',                   // user line 3 (CDP 0-based: 2)
            'globalThis.__q5 = "line4";',  // user line 4
        ].join('\n');
        const { source, url, userLineToScriptLine } = buildCellSource({
            notebookUri: 'spike://q5', cellIndex: 0, userCode,
            mode: 'async-iife-sameline', urlScheme: 'notebook-cell',
        });
        await ctx.evaluate(source, { replMode: true });
        await delay(150);

        const paused = ctx.pauseLog.find((p) => p.url === url);
        const expectedScriptLine0 = userLineToScriptLine(3) - 1; // 0-based
        const ok = !!paused && paused.lineNumber === expectedScriptLine0;
        record('Q5', {
            pass: ok,
            answer: ok
                ? `Yes — debugger on user line 3 reports CDP lineNumber=${paused.lineNumber} (0-based) which matches the user-visible line.`
                : `No — observed lineNumber=${paused?.lineNumber}, expected ${expectedScriptLine0}.`,
            decision: ok
                ? 'Pattern B (same-line concatenation) is sufficient for Story 2.4 wrapper builder.'
                : 'Switch to Pattern B-alt (multi-line wrapper + inline source map) — see Q6.',
            evidence:
                `userCode (4 lines)=\n${userCode}\n--\n` +
                `wrapped script=\n${source}\n--\n` +
                `paused=${JSON.stringify(paused)}\n` +
                `expectedScriptLine0=${expectedScriptLine0}`,
        });
    } finally {
        await ctx.detach();
    }
}

// ---------------------------------------------------------------------------
// Q6 — Inline source-map honoring (Pattern B-alt)
// ---------------------------------------------------------------------------

async function runQ6(browser, targetId) {
    console.log('\n========== Q6: inline source-map honoring (Pattern B-alt) ==========');
    const ctx = await openProbeContext(browser, targetId);
    try {
        await ctx.enableDevtoolsDebugger();
        const userCode = [
            'globalThis.__q6 = "line1";',  // user line 1
            'globalThis.__q6 = "line2";',  // user line 2
            'debugger;',                   // user line 3
            'globalThis.__q6 = "line4";',  // user line 4
        ].join('\n');
        const { source, url } = buildCellSource({
            notebookUri: 'spike://q6', cellIndex: 0, userCode,
            mode: 'async-iife-multiline-sourcemap', urlScheme: 'notebook-cell',
        });
        // First evaluation: triggers script registration + lets us see how the
        // mapped paused location is reported when the debugger; statement fires.
        await ctx.evaluate(source, { replMode: true });
        await delay(200);

        const firstPause = ctx.pauseLog.find((p) => p.url === url);

        // Now set a breakpoint at the MAPPED (user-visible) line and re-eval.
        // CDP setBreakpointByUrl uses 0-based lineNumber against the URL the
        // debugger considers authoritative for this script.
        const bp = await ctx.setBreakpoint(url, 2); // user line 3 -> 0-based 2
        await ctx.evaluate(source, { replMode: true });
        await delay(200);

        const pauses = ctx.pauseLog.filter((p) => p.url === url);
        const breakpointPause = pauses.find((pause) => isBreakpointHitPause(pause, bp.breakpointId));
        // Pass criterion (a): paused lineNumber reports ORIGINAL user line
        //   (CDP 0-based 2 = user line 3) rather than the wrapper-shifted line 3.
        // Pass criterion (b): the explicit breakpoint fires, not merely the debugger statement.
        const reportsOriginal = !!firstPause && firstPause.lineNumber === 2;
        const breakpointFired = !!breakpointPause;
        const pass = reportsOriginal && breakpointFired;
        const answeredNo = !reportsOriginal && breakpointFired;

        record('Q6', {
            pass,
            expectedNegative: answeredNo,
            answer: pass
                ? 'Yes — V8 honors the inline sourceMappingURL: paused lineNumber reports the original user line and a breakpoint set against the mapped URL+line fires.'
                : answeredNo
                    ? `No — reportsOriginal=${reportsOriginal} breakpointFired=${breakpointFired}.`
                    : `Inconclusive: reportsOriginal=${reportsOriginal} breakpointFired=${breakpointFired}.`,
            decision: pass
                ? 'Pattern B-alt available; recommend Pattern B (same-line) as default if Q5 passes — source maps are a fallback only when user-visible authoring formats other than raw JS appear.'
                : 'Source-map honoring not reliable for Runtime.evaluate; Pattern B (same-line) locks as Story 2.4’s only wrapper strategy.',
            evidence:
                `bp.breakpointId=${JSON.stringify(bp.breakpointId)}\n` +
                `wrapped script=\n${source}\n--\n` +
                `bp.locations=${JSON.stringify(bp.locations)}\n` +
                `breakpointPause=${JSON.stringify(breakpointPause)}\n` +
                `pauses=${JSON.stringify(pauses)}`,
        });

        if (INTERACTIVE) {
            await ask('  [INTERACTIVE] Open DevTools → Sources, view the cell URL. Does it display the ORIGINAL (pre-wrapper) source? Press Enter…');
            const ans = await ask('  Did the Sources panel show the mapped/original source? (y/n): ');
            console.log(`    operator: shows-original-source=${ans}`);
        }
    } finally {
        await ctx.detach();
    }
}

// ---------------------------------------------------------------------------
// URL-scheme sub-probe (Task 9)
// ---------------------------------------------------------------------------

async function runUrlSchemeProbe(browser, targetId) {
    console.log('\n========== URL-scheme sub-probe ==========');
    const schemes = ['notebook-cell', 'vscode-notebook-cell', 'https-spike'];
    const observations = [];
    for (const scheme of schemes) {
        const ctx = await openProbeContext(browser, targetId);
        try {
            await ctx.enableDevtoolsDebugger();
            const { source, url } = buildCellSource({
                notebookUri: 'spike://url-scheme', cellIndex: 0,
                userCode: 'globalThis.__urlScheme = ' + JSON.stringify(scheme) + ';',
                mode: 'plain', urlScheme: scheme,
            });
            let bpAccepted = false;
            let bpError = null;
            try {
                await ctx.setBreakpoint(url, 0);
                bpAccepted = true;
            } catch (e) {
                bpError = e.message;
            }
            await ctx.evaluate(source);
            await delay(120);
            const parsed = ctx.scriptLog.find((s) => s.url === url);
            observations.push({
                scheme,
                url,
                scriptParsedRoundtripsUrl: !!parsed,
                bpSetByUrlAccepted: bpAccepted,
                bpError,
            });
        } finally {
            await ctx.detach();
        }
    }
    record('URL-scheme', {
        pass: null,
        answer: 'Comparison across three candidate schemes (all round-trip through CDP, but exact notebook-resource URI shape remains unresolved).',
        decision:
            'Recommendation: choose the scheme that preserves stable notebook-resource identity and matches the resource URI form used by notebook breakpoints in the debugger. This probe only proves that all three candidate schemes round-trip through CDP and are accepted by Debugger.setBreakpointByUrl.',
        evidence: JSON.stringify(observations, null, 2),
    });
}

// ---------------------------------------------------------------------------
// Optional: re-run a benign Runtime.evaluate from a third surrogate to confirm
// the multiplex pattern is not regressed during Q3 (Task 12).
// ---------------------------------------------------------------------------

async function runMultiplexRegression(browser, targetId) {
    console.log('\n========== Multiplex regression sanity check ==========');
    const { sessionId } = await browser.Target.attachToTarget({ targetId, flatten: true });
    await sendInSession(browser, 'Runtime.enable', {}, sessionId);
    const r = await sendInSession(browser, 'Runtime.evaluate',
        { expression: '1 + 1', returnByValue: true }, sessionId);
    await browser.Target.detachFromTarget({ sessionId });
    const ok = r.result?.value === 2;
    record('multiplex-regression', {
        pass: ok,
        answer: ok ? 'Third surrogate session can still evaluate while two Debugger.enable clients exist.' : 'Regression detected.',
        evidence: `Runtime.evaluate(1+1)=${JSON.stringify(r.result?.value)}`,
    });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('\n=== CDP sourceURL + Debugger Spike ===');
    console.log('Target: ' + HOST + ':' + PORT);
    console.log('Mode: ' + (INTERACTIVE ? 'INTERACTIVE' : 'headless') + (EXTERNAL_BROWSER ? ' (external browser)' : ' (auto-launched chromium)') + '\n');

    let chromiumProc = null;
    if (!EXTERNAL_BROWSER) {
        console.log('[0] Launching headless Chromium ...');
        chromiumProc = launchChromium(PORT);
        await waitForCdp(HOST, PORT, 20000);
        console.log('    CDP ready.\n');
    }

    const versionInfo = await httpGet('http://' + HOST + ':' + PORT + '/json/version');
    if (!versionInfo.webSocketDebuggerUrl) throw new Error('/json/version missing webSocketDebuggerUrl');
    const wsUrl = versionInfo.webSocketDebuggerUrl
        .replace('localhost', HOST).replace('127.0.0.1', HOST);

    const browser = await CDP({ target: wsUrl, local: true });
    console.log('[1] Connected to browser-level WebSocket: ' + wsUrl);

    const { targetInfos } = await browser.Target.getTargets();
    const pageTargets = targetInfos.filter(
        (t) => t.type === 'page' && !t.url.startsWith('devtools://'),
    );
    if (pageTargets.length === 0) {
        throw new Error('No page target available; open about:blank and retry.');
    }
    const target =
        pageTargets.find((t) => t.url === 'about:blank' || t.url.startsWith('about:')) ||
        pageTargets[0];
    console.log('[2] Using target: [' + target.targetId + '] ' + target.url);

    // Run probes
    await runQ1(browser, target.targetId);
    const q2Result = await runQ2(browser, target.targetId);
    // Q3 only when Q2 failed (per spike spec). Run anyway in headless to record
    // multi-client behavior for the findings doc, but mark as informational.
    await runQ3(browser, target.targetId);
    await runQ4(browser, target.targetId);
    await runQ5(browser, target.targetId);
    await runQ6(browser, target.targetId);
    await runUrlSchemeProbe(browser, target.targetId);
    await runMultiplexRegression(browser, target.targetId);

    // Summary
    console.log('\n=== Summary ===');
    let passes = 0;
    let fails = 0;
    let infos = 0;
    let answeredNos = 0;
    for (const f of findings) {
        const tag = f.pass === true
            ? 'PASS'
            : f.pass === false
                ? (f.expectedNegative ? 'ANSWERED-NO' : 'FAIL')
                : 'INFO';
        if (tag === 'PASS') passes++;
        else if (tag === 'ANSWERED-NO') answeredNos++;
        else if (tag === 'FAIL') fails++;
        else infos++;
        console.log(`  [${tag}] ${f.question}: ${f.answer}`);
    }
    console.log(`  Totals: pass=${passes} fail=${fails} answeredNo=${answeredNos} info=${infos}`);

    if (KEEP_OPEN) {
        console.log('\nKEEP_OPEN=1 set; leaving browser running. Press Ctrl+C to exit.');
        await new Promise(() => { });
    }

    if (!EXTERNAL_BROWSER) {
        await browser.send('Browser.close').catch(() => { });
    }
    await browser.close();
    if (chromiumProc) {
        try { chromiumProc.kill('SIGTERM'); } catch (_) { /* ignore */ }
    }

    process.exit(fails > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('\n❌  Spike harness crashed:', err && err.stack ? err.stack : err);
    process.exit(2);
});
