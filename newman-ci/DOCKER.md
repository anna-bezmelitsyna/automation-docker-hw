# Docker — лекція (від простих команд до Jenkins)

Практична лекція з Docker: починаємо з найпростіших команд (завантажити образ, запустити
контейнер), а далі переходимо до наших реальних файлів (`Dockerfile`, `docker-compose.yml`,
`Jenkinsfile`, образ `postman-newman-tests`) і до запуску Jenkins у контейнері з доступом через
`http://localhost:8080`.

---

## 1. Що таке Docker

Проблема «у мене на машині працює». Тести Newman потребують Node.js потрібної версії, глобально
встановлений `newman` і репортер `htmlextra`. На іншій машині версії інші — і все ламається.

Docker пакує застосунок **разом з оточенням** (ОС-шар, Node, залежності) в один **образ**.
Образ запускається однаково будь-де: на вашому ноутбуці, у колеги, на CI.

| Термін | Що це |
|---|---|
| **Image (образ)** | Незмінний «зліпок»: ОС-шар + Node + код. З нього створюються контейнери. |
| **Container (контейнер)** | Запущений екземпляр образу. Ізольований процес зі своєю ФС і мережею. |
| **Registry (реєстр)** | Сховище образів. За замовчуванням Docker Hub (`node`, `jenkins/jenkins`, `postman/newman`). |
| **Dockerfile** | Рецепт збірки власного образу (покроково). |
| **Volume (том)** | Папка, проброшена між хостом і контейнером (щоб дані пережили контейнер). |
| **Port mapping** | Проброс порту контейнера на порт хоста (`-p`). |

Образ vs контейнер = клас vs об'єкт. З одного образу можна підняти багато контейнерів.

---

## 2. Перші команди — з чого почати

**Перевірити, що Docker працює:**

```bash
docker version      # версії клієнта та демона
docker info         # загальний стан, скільки образів/контейнерів
```

**Завантажити (спулити) образ із Docker Hub:**

```bash
docker pull hello-world
docker pull node:20-alpine
docker pull postman/newman:alpine
```

- `docker pull` тягне образ із реєстру в локальний кеш.
- Ім'я образу = `ім'я:тег`. Без тегу береться `latest` (напр. `node` = `node:latest`).
  Тег фіксує версію — `node:20-alpine` краще за `node:latest`, бо передбачуваний.

**Подивитися, які образи вже є локально:**

```bash
docker images
```

**Запустити перший контейнер:**

```bash
docker run hello-world
```

> Якщо образу немає локально, `docker run` сам його спулить — тобто окремий `docker pull`
> робити необов'язково, але корисно розуміти, що відбувається.

**Зайти всередину контейнера інтерактивно** (помацати руками):

```bash
docker run -it --rm ubuntu bash
# ви в shell усередині Ubuntu; наберіть `exit`, щоб вийти
```

- `-it` — інтерактивний термінал; `--rm` — видалити контейнер після виходу.

**Подивитися контейнери:**

```bash
docker ps           # лише запущені
docker ps -a        # усі, включно зі зупиненими (exited)
```

**Керування контейнером:**

```bash
docker logs <name>          # подивитися вивід контейнера
docker exec -it <name> sh   # зайти у вже працюючий контейнер
docker stop <name>          # зупинити
docker start <name>         # запустити знову
docker rm <name>            # видалити контейнер
```

**Прибирання:**

```bash
docker rmi <образ>          # видалити образ
docker system prune -f      # прибрати зупинені контейнери та висячі образи
```

Це 90% повсякденного Docker. Далі — як зібрати **власний** образ під наші тести.

---

## 3. Наш Dockerfile рядок за рядком

Файл [`Dockerfile`](Dockerfile) — рецепт нашого образу з Newman:

```dockerfile
FROM node:20-alpine            # 1. базовий образ: Node 20 на легкому Alpine Linux
WORKDIR /app                   # 2. робоча папка всередині контейнера
COPY package.json package-lock.json* ./   # 3. спершу маніфести (для кешу)
RUN npm ci --omit=dev || npm install --omit=dev   # 4. встановлення newman + htmlextra
COPY . .                       # 5. копіюємо колекції, оточення, раннер
RUN mkdir -p /app/reports && chmod -R 777 /app/reports   # 6. папка під звіти
ENV REPORTS_DIR=/app/reports   # 7. змінна оточення за замовчуванням
CMD ["node", "run-tests.js"]   # 8. що виконати при старті контейнера
```

Ключові ідеї:

- **`FROM`** — завжди починаємо з готового образу з реєстру (той самий, що тягне `docker pull`).
- **Шари й кеш.** Кожна інструкція — шар. Docker кешує шари й перезбирає лише змінене та все, що
  після. Тому спершу `package.json` + встановлення залежностей (важкий шар), і лише потім
  `COPY . .`. Змінили колекцію — перевстановлення npm не повторюється.
- **`RUN`** виконується під час **збірки**; **`CMD`** — під час **запуску** контейнера.
- **`.dockerignore`** ([файл](.dockerignore)) виключає зі збірки зайве (`node_modules`,
  `reports`, `.git`) — контекст менший, збірка швидша.

---

## 4. Збірка образу — `docker build`

```bash
cd newman-ci
docker build -t postman-newman-tests:local .
```

- `-t postman-newman-tests:local` — ім'я:тег майбутнього образу.
- `.` — **контекст збірки** (поточна папка), який надсилається демону.

Після збірки образ з'явиться у `docker images`.

---

## 5. Запуск контейнера — `docker run`

Найпростіший запуск (тести виконаються, контейнер завершиться):

```bash
docker run --rm postman-newman-tests:local
```

Часті прапори (на наших прикладах):

| Прапор | Призначення | Приклад |
|---|---|---|
| `--rm` | видалити контейнер після завершення | `docker run --rm ...` |
| `-e KEY=val` | передати змінну оточення | `-e ONLY=lecture-1` |
| `-v host:cont` | змонтувати том | `-v "$PWD/reports:/app/reports"` |
| `--name` | задати ім'я контейнеру | `--name newman-run` |
| `-d` | фоновий режим (detached) | для серверів, напр. Jenkins |
| `-it` | інтерактивний TTY | `docker run -it ... sh` |
| `-p host:cont` | проброс порту | `-p 8080:8080` |

Запустити лише частину тест-плану (наша змінна `ONLY`):

```bash
docker run --rm -e ONLY=lecture-1,homework-flow postman-newman-tests:local
```

---

## 6. Томи (volumes) — забрати звіти назовні

Контейнер ізольований: його файли зникнуть разом із ним. Щоб звіти лишилися на хості,
монтуємо папку:

```bash
docker run --rm -v "$PWD/reports:/app/reports" postman-newman-tests:local
# звіти з'являться в ./reports на хості
```

Ліворуч — шлях на хості, праворуч — шлях у контейнері. Зміни видно з обох боків одразу.

> ⚠️ Коли сам Jenkins працює в контейнері, монтування `-v "$PWD/..."` ламається: `$PWD` —
> це шлях усередині контейнера Jenkins, а демон шукає його на хості. Тому в нашому
> [`Jenkinsfile`](Jenkinsfile) звіти забираються через `docker cp` (потік по API, шлях хоста не
> потрібен). Див. розділ 10.

---

## 7. Проброс портів — `-p` (важливо для веб-сервісів)

Newman-контейнеру порт не потрібен — він не сервер, відпрацював і вийшов. Але щойно в контейнері
крутиться **веб-сервіс** (Jenkins, API, БД), його порт зсередини ззовні **не видно**, доки ви
його явно не опублікуєте.

```
-p  ПОРТ_НА_ХОСТІ : ПОРТ_У_КОНТЕЙНЕРІ
```

Приклад: Jenkins усередині слухає порт `8080`. Щоб відкрити його в браузері на хості:

```bash
docker run -d -p 8080:8080 jenkins/jenkins:lts
# тепер http://localhost:8080 → порт 8080 контейнера
```

Корисно знати:

- Можна «з'їхати» по порту: `-p 9090:8080` → на хості `localhost:9090`, усередині так само `8080`.
- Кілька портів — кілька `-p`: `-p 8080:8080 -p 50000:50000`.
- Прив'язати лише до localhost: `-p 127.0.0.1:8080:8080`.
- Без `-p` сервіс доступний лише **всередині** мережі Docker, але не з браузера хоста.
- Перевірити проброшені порти: `docker port <container>`.

---

## 8. docker compose — запуск однією командою

Довгі `docker run ...` незручно повторювати. `compose` описує запуск у YAML.

Наш [`docker-compose.yml`](docker-compose.yml) для Newman:

```yaml
services:
  newman:
    build: .
    image: postman-newman-tests:local
    environment:
      - REPORTS_DIR=/app/reports
    volumes:
      - ./reports:/app/reports
```

Запуск:

```bash
docker compose run --rm newman     # зібрати (якщо треба) і прогнати тести
```

`compose run` зручний для разових задач (тести), `compose up -d` — для сервісів (Jenkins, нижче).

---

## 9. Поведінка та життєвий цикл контейнера

Стани: `created → running → exited`. Контейнер живе, поки живий його головний процес
(наш `node run-tests.js`); процес завершився — контейнер `exited`.

Важливі нюанси:

- **Код виходу контейнера = код виходу головного процесу.** Наш раннер виходить `1` при падінні
  тестів і `0`, якщо все зелене — це й ловить CI.
- **`--rm`** видаляє контейнер одразу після виходу (не накопичується сміття).
- **`exited` ≠ видалений.** Без `--rm` контейнер лишається в `docker ps -a` (з нього можна `docker cp`).
- **`restart: unless-stopped`** (див. Jenkins) піднімає сервіс знову після перезавантаження.

---

## 10. Як це працює на Jenkins (Newman у Docker)

Наш [`Jenkinsfile`](Jenkinsfile) на кожному запуску:

1. **збирає образ** — `docker build -t postman-newman-tests:<BUILD_NUMBER> .`;
2. **запускає контейнер** (`docker create` + `docker start`), проганяючи тест-план;
3. **забирає звіти** — `docker cp <container>:/app/reports/. reports/`;
4. **публікує** JUnit (`reports/junit-*.xml`), HTML-звіт (`index.html`) та артефакти.

Розділення кодів виходу:

- падіння тестів (`exit 1`) → JUnit позначає збірку **UNSTABLE** (жовта);
- помилка Docker (`exit ≥ 125`, образ не зібрався / демон недоступний) → **FAILED** (червона).

---

## 11. Запуск Jenkins у Docker з доступом через localhost

Щоб Jenkins сам працював у контейнері й при цьому міг запускати Newman-контейнери, потрібно:
docker CLI усередині Jenkins + доступ до Docker-демона хоста через сокет. Усе зібрано в
[`jenkins/`](jenkins/).

[`jenkins/Dockerfile`](jenkins/Dockerfile) — Jenkins LTS + docker CLI + потрібні плагіни.
[`jenkins/docker-compose.yml`](jenkins/docker-compose.yml) — проброс портів і сокета:

```yaml
services:
  jenkins:
    build: .
    user: root
    ports:
      - "8080:8080"     # веб-інтерфейс → http://localhost:8080
      - "50000:50000"   # підключення агентів
    volumes:
      - jenkins_home:/var/jenkins_home              # дані Jenkins переживуть перестворення
      - /var/run/docker.sock:/var/run/docker.sock   # доступ до Docker хоста (DooD)
```

### Запуск

```bash
cd newman-ci/jenkins
docker compose up -d --build       # зібрати образ Jenkins і підняти у фоні
```

Відкрити в браузері: **http://localhost:8080**

Пароль першого входу:

```bash
docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Далі у веб-інтерфейсі: вставити пароль → *Install suggested plugins* → створити адміна.
Плагіни **JUnit**, **HTML Publisher**, **Docker Pipeline** вже вшиті в образ.

### Створити job для наших тестів

1. *New Item* → ім'я → **Pipeline** → OK.
2. Розділ *Pipeline* → *Pipeline script from SCM* → **Git** → URL вашого репозиторію →
   **Script Path:** `newman-ci/Jenkinsfile`.
   > Контейнер Jenkins ізольований від файлів на хості, тому проєкт має лежати в Git-репозиторії,
   > до якого Jenkins дотягнеться. Просто «вставити скрипт» не вийде: pipeline робить `docker build .`
   > і йому потрібні файли з репозиторію.
3. *Build Now*. Після збірки з'являться **Test Result**, **Newman HTML Report** та артефакти.

### Керування

```bash
docker compose logs -f jenkins     # дивитися лог старту/роботи
docker compose stop                # зупинити (дані збережуться в томі jenkins_home)
docker compose down                # видалити контейнер (том із даними лишається)
docker compose down -v             # видалити разом із даними Jenkins
```

> Якщо HTML-звіт відкривається без стилів — це Content-Security-Policy Jenkins.
> Лікування описано в [README.md](README.md#якщо-html-звіт-у-jenkins-без-стилів).

---

## 12. Шпаргалка команд

```bash
# Образи
docker pull node:20-alpine                     # завантажити образ із реєстру
docker build -t postman-newman-tests:local .   # зібрати свій образ
docker images                                  # список образів
docker rmi postman-newman-tests:local          # видалити образ

# Контейнери (наші тести)
docker run --rm postman-newman-tests:local                       # прогнати все
docker run --rm -e ONLY=lecture-1 postman-newman-tests:local     # частину плану
docker run --rm -v "$PWD/reports:/app/reports" postman-newman-tests:local  # зі звітами

# Compose
docker compose run --rm newman      # тести (newman-ci/)
docker compose up -d --build        # Jenkins у фоні (newman-ci/jenkins/)
docker compose down                 # зупинити і видалити

# Діагностика
docker ps -a                        # усі контейнери
docker logs -f <name>               # логи
docker exec -it <name> sh           # усередину контейнера
docker port <name>                  # проброшені порти
docker system prune -f              # прибирання
```
