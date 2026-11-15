// Runs the page's landing-layer worker (web/suit-worker.js) in a Node worker thread, for tests/bench_workers.mjs.
import { parentPort } from 'node:worker_threads';
globalThis.self = { postMessage: (m, t) => parentPort.postMessage(m, t) };
parentPort.on('message', (data) => self.onmessage({ data }));
await import('../web/suit-worker.js');
