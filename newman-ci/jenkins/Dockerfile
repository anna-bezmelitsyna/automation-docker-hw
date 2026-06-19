# Jenkins LTS + docker CLI усередині.
# CLI потрібен, щоб pipeline (Jenkinsfile) міг збирати і запускати контейнер Newman,
# звертаючись до Docker-демона хоста через змонтований сокет (Docker-outside-of-Docker).
FROM jenkins/jenkins:lts-jdk17

USER root

# Лише клієнт docker (демон беремо з хоста через /var/run/docker.sock).
# У Debian 13 (trixie) CLI винесений в окремий пакет docker-cli; docker.io — це демон.
RUN apt-get update \
 && apt-get install -y --no-install-recommends docker-cli \
 && rm -rf /var/lib/apt/lists/* \
 && docker --version

# Попередньо встановимо потрібні плагіни, щоб не ставити руками після першого старту.
RUN jenkins-plugin-cli --plugins \
      workflow-aggregator \
      docker-workflow \
      junit \
      htmlpublisher \
      git

USER jenkins
