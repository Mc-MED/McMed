#!/bin/sh
set -e

# Komenda podana przy starcie kontenera (np. cron job: python manage.py send_recert_reminders)
# → uruchom ją zamiast serwera
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 1 \
    --threads 4 \
    --timeout 120 \
    --max-requests 500 \
    --max-requests-jitter 50
