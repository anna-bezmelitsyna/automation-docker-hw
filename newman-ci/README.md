# newman-ci — запуск Postman-тестів на Jenkins через Newman у Docker

Самодостатній набір для прогону API-тестів (Postman-колекції) **усередині Docker-контейнера**,
з готовим `Jenkinsfile`. Папку можна скопіювати/перенести як є — усі потрібні колекції,
оточення та тест-дані лежать усередині.

> 📘 Лекція з Docker (поняття, команди, проброс портів, запуск Jenkins) — у [DOCKER.md](DOCKER.md).

## Структура

```
newman-ci/
├── collections/        # копії Postman-колекцій
├── environments/       # оточення JSONPlaceholder DEV
├── test-data/          # дані для data-driven прогонів
├── reports/            # сюди складаються звіти (junit + htmlextra + index.html)
├── run-tests.js        # раннер Newman (тест-план + генерація звітів)
├── package.json        # залежності: newman + newman-reporter-htmlextra
├── Dockerfile          # образ node:20-alpine з Newman
├── docker-compose.yml  # локальний запуск у контейнері
├── .dockerignore
├── Jenkinsfile         # pipeline: build image → run у Docker → публікація звітів
├── DOCKER.md           # лекція з Docker на наших прикладах
└── jenkins/            # Jenkins у Docker (Dockerfile + compose з пробросом портів)
```

## Тест-план (`run-tests.js`)

Увімкнені за замовчуванням (зелені проти публічного `jsonplaceholder.typicode.com`):

| Прогін | Колекція |
|---|---|
| `lecture-1` | JSONPlaceholder Lecture |
| `lecture-2-data-driven` | JSONPlaceholder Lecture 2 → папка *Data-driven testing* (`-d posts-test-data.json`) |
| `homework-solutions` | JSONPlaceholder Homework - Solutions |
| `homework-flow` | JSONPlaceholder Homework - Flow |

Вимкнені (`enabled:false`, потребують додаткового налаштування — запускаються через `ONLY=`):
`lecture-2-full` (потрібен реальний mock-URL), `lecture-3` (зовнішні сервіси),
`homework-template` (навчальні «червоні» тести).

## Запуск

### 1. Локально без Docker

```bash
cd newman-ci
npm install
npm test
```

### 2. Локально в Docker (як на CI)

```bash
cd newman-ci
docker compose run --rm newman
# звіти → ./reports/index.html
```

або вручну:

```bash
docker build -t postman-newman-tests:local .
docker run --rm -v "$PWD/reports:/app/reports" postman-newman-tests:local
```

### 3. Jenkins у Docker (доступ через localhost)

Підняти сам Jenkins у контейнері з пробросом портів:

```bash
cd newman-ci/jenkins
docker compose up -d --build
# відкрити http://localhost:8080
docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword   # пароль входу
```

Плагіни **JUnit**, **HTML Publisher**, **Docker Pipeline** вже вшиті в образ, а docker CLI +
проброс `/var/run/docker.sock` дозволяють pipeline збирати й запускати Newman-контейнер.
Подробиці та команди керування — у [DOCKER.md](DOCKER.md#11-запуск-jenkins-у-docker-з-доступом-через-localhost).

### 4. Налаштування job

1. *New Item* → **Pipeline** job → **Pipeline script from SCM**, шлях до скрипту: `newman-ci/Jenkinsfile`.
   (Агент повинен мати доступ до Docker — при запуску Jenkins за інструкцією вище це вже так.)
2. Запустіть. Після збірки доступні:
   - **Test Result** — JUnit (`reports/junit-*.xml`);
   - **Newman HTML Report** — зведений `index.html` з посиланнями на htmlextra-звіти;
   - **Artifacts** — увесь каталог `reports/`.

Параметри job: `ONLY` (підмножина прогонів) і `BAIL` (стоп на першому падінні).

## Змінні оточення

| Змінна | Призначення | За замовчуванням |
|---|---|---|
| `REPORTS_DIR` | каталог звітів | `reports` |
| `NEWMAN_ENV` | шлях до environment-файлу | `environments/JSONPlaceholder.dev.postman_environment.json` |
| `NEWMAN_BAIL` | `true` → стоп на першому падінні | `false` |
| `ONLY` | список прогонів через кому (ігнорує `enabled`) | — |

Приклад: запустити лише два прогони —
```bash
ONLY=lecture-1,homework-flow npm test
```

## Поведінка на CI

- Падіння тестів → код виходу `1` → JUnit позначає збірку **UNSTABLE**.
- Помилка Docker (код ≥125) → збірка **FAILED**.
- Звіти публікуються завжди (`post { always }`), навіть при падіннях.

## Якщо HTML-звіт у Jenkins без стилів

Jenkins за замовчуванням ріже inline-CSS/JS у опублікованих звітах (Content-Security-Policy),
через що htmlextra може виглядати «голим». Лікується на боці Jenkins одним зі способів:

- встановити плагін **OWASP Markup Formatter** / дозволити потрібний CSP, або
- у *Manage Jenkins → Script Console* виконати:
  ```groovy
  System.setProperty("hudson.model.DirectoryBrowserSupport.CSP", "")
  ```
  (після перезапуску значення скидається — для постійного ефекту задайте JVM-параметр
  `-Dhudson.model.DirectoryBrowserSupport.CSP=`). JUnit-вкладка *Test Result* від CSP не залежить.

## Як додати свою колекцію

1. Покладіть `*.postman_collection.json` у `collections/`.
2. Додайте запис у масив `PLAN` у `run-tests.js` (`name`, `collection`, за потреби `folder` / `data`).
3. Якщо потрібні нові змінні оточення — допишіть їх у файл `environments/...` або передайте через `NEWMAN_ENV`.
