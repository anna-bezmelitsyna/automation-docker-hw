#!/usr/bin/env node
/**
 * Newman test runner.
 *
 * Проганяє набір Postman-колекцій і генерує звіти (cli + junit + htmlextra).
 * Один і той самий файл працює локально (`node run-tests.js`), у Docker і в Jenkins.
 *
 * Конфігурація прогонів — масив PLAN нижче. Кожен елемент = один запуск newman.
 *
 * Змінні оточення:
 *   REPORTS_DIR  — куди писати звіти           (за замовчуванням ./reports)
 *   NEWMAN_ENV   — шлях до environment-файлу    (за замовчуванням environments/JSONPlaceholder.dev...)
 *   NEWMAN_BAIL  — "true" → стоп на першому падінні
 *   ONLY         — список імен прогонів через кому (наприклад ONLY=lecture-1,homework-flow);
 *                  запускає вказані прогони навіть якщо enabled:false
 */
'use strict';

const fs = require('fs');
const path = require('path');
const newman = require('newman');

const REPORTS_DIR = process.env.REPORTS_DIR || 'reports';
const ENV = process.env.NEWMAN_ENV || 'environments/JSONPlaceholder.dev.postman_environment.json';
const BAIL = process.env.NEWMAN_BAIL === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// Тест-план. enabled:true — входить у прогін за замовчуванням.
// Зелені проти публічного https://jsonplaceholder.typicode.com перевірені вручну.
// ─────────────────────────────────────────────────────────────────────────────
const PLAN = [
  {
    name: 'lecture-1',
    enabled: true,
    collection: 'collections/JSONPlaceholder Lecture.postman_collection.json',
  },
  {
    name: 'lecture-2-data-driven',
    enabled: true,
    collection: 'collections/JSONPlaceholder Lecture 2.postman_collection.json',
    folder: '2. Data-driven testing (JSON-файли)',
    data: 'test-data/posts-test-data.json',
  },
  {
    name: 'homework-solutions',
    enabled: true,
    collection: 'collections/JSONPlaceholder Homework - Solutions.postman_collection.json',
  },
  {
    name: 'homework-flow',
    enabled: true,
    collection: 'collections/JSONPlaceholder Homework - Flow.postman_collection.json',
  },

  // ── Вимкнені за замовчуванням (запустити можна через ONLY=...) ───────────────
  // Повна Lecture 2: папка "Mock servers" потребує реальний mockUrl в environment.
  {
    name: 'lecture-2-full',
    enabled: false,
    collection: 'collections/JSONPlaceholder Lecture 2.postman_collection.json',
  },
  // Lecture 3: ходить у зовнішні сервіси (petstore тощо) — можливі нестабільні падіння.
  {
    name: 'lecture-3',
    enabled: false,
    collection: 'collections/JSONPlaceholder Lecture 3.postman_collection.json',
  },
  // Шаблон ДЗ: містить навчальні «червоні» тести (демонстрація setNextRequest).
  {
    name: 'homework-template',
    enabled: false,
    collection: 'collections/JSONPlaceholder Homework.postman_collection.json',
  },
];

function selectPlan() {
  const only = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
  if (only.length) return PLAN.filter(p => only.includes(p.name));
  return PLAN.filter(p => p.enabled);
}

function runOne(spec) {
  return new Promise((resolve) => {
    const options = {
      collection: spec.collection,
      reporters: ['cli', 'junit', 'htmlextra'],
      reporter: {
        junit: { export: path.join(REPORTS_DIR, `junit-${spec.name}.xml`) },
        htmlextra: {
          export: path.join(REPORTS_DIR, `report-${spec.name}.html`),
          title: `Newman — ${spec.name}`,
          titleSize: 4,
        },
      },
      bail: BAIL,
      color: 'on',
    };
    if (fs.existsSync(ENV)) options.environment = ENV;
    if (spec.folder) options.folder = spec.folder;
    if (spec.data) options.iterationData = spec.data;

    console.log(`\n=== ▶ ${spec.name}  (${spec.collection})${spec.folder ? ' › ' + spec.folder : ''} ===`);

    newman.run(options, (err, summary) => {
      const stats = summary && summary.run && summary.run.stats;
      const failures = (summary && summary.run && summary.run.failures) || [];
      resolve({
        name: spec.name,
        collection: spec.collection,
        error: err ? String(err.message || err) : null,
        failed: err ? -1 : failures.length,
        assertions: stats ? stats.assertions.total : 0,
        requests: stats ? stats.requests.total : 0,
      });
    });
  });
}

function writeIndex(results) {
  const rows = results.map(r => {
    const ok = !r.error && r.failed === 0;
    return `      <tr class="${ok ? 'ok' : 'bad'}">
        <td>${ok ? '✅' : '❌'}</td>
        <td><a href="report-${r.name}.html">${r.name}</a></td>
        <td>${r.requests}</td>
        <td>${r.assertions}</td>
        <td>${r.error ? 'ERROR' : r.failed}</td>
      </tr>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Newman — зведений звіт</title>
  <style>
    body { font-family: system-ui, "Segoe UI", Arial, sans-serif; margin: 2rem; background:#0f172a; color:#e2e8f0; }
    h1 { font-size: 1.4rem; margin-bottom: .25rem; }
    p.sub { color:#94a3b8; margin-top:0; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { padding: .5rem .75rem; border-bottom: 1px solid #334155; text-align: left; }
    th { color:#94a3b8; font-weight:600; }
    a { color:#38bdf8; text-decoration:none; }
    a:hover { text-decoration:underline; }
    tr.bad td { background:#3f1d2e; }
  </style>
</head>
<body>
  <h1>Newman — зведений звіт</h1>
  <p class="sub">Натисніть на прогін, щоб відкрити докладний htmlextra-звіт.</p>
  <table>
    <thead>
      <tr><th></th><th>Прогін</th><th>Запити</th><th>Assertions</th><th>Падінь</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>
`;
  fs.writeFileSync(path.join(REPORTS_DIR, 'index.html'), html);
}

(async () => {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const plan = selectPlan();
  if (!plan.length) {
    console.error('Тест-план порожній. Перевірте прапорці enabled або змінну ONLY.');
    process.exit(2);
  }

  console.log(`Newman runner: ${plan.length} прогін(ів), оточення: ${ENV}, звіти → ${REPORTS_DIR}/`);

  const results = [];
  for (const spec of plan) {
    results.push(await runOne(spec));
  }

  writeIndex(results);

  console.log('\n================ ПІДСУМОК ================');
  let bad = 0;
  for (const r of results) {
    const ok = !r.error && r.failed === 0;
    if (!ok) bad++;
    const status = ok ? '✅ PASS' : '❌ FAIL';
    const detail = r.error ? `ERROR: ${r.error}` : `assertions=${r.assertions} failed=${r.failed}`;
    console.log(`${status}  ${r.name.padEnd(24)} ${detail}`);
  }
  console.log('=========================================');
  console.log(`Прогонів: ${results.length}, з помилками: ${bad}`);

  process.exit(bad > 0 ? 1 : 0);
})();
