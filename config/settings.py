"""
Django settings for config project (Django 5.2).
Secrets are read from the environment (.env file, never committed).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Fills os.environ from .env: DB passwords, ANTHROPIC_API_KEY, AGENT_MODEL...
load_dotenv(BASE_DIR / ".env")


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-dev-only-change-me")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = [h for h in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if h]


# ---------------------------------------------------------------------------
# Application definition
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'chattodashboard',
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # At the top, before CommonMiddleware
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# ---------------------------------------------------------------------------
# Django REST framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",  # Useful for development, to remove in prod
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",  # The chat and ETL views set their own permissions
    ],
    "DEFAULT_THROTTLE_RATES": {"chat": "30/hour"},  # Each question costs LLM calls
}

# Frontend origins (adapt ports: React/Vite = 5173, Next = 3000, etc.)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]
# Only needed while the frontend authenticates with the Django session cookie.
# Remove both lines if the team switches to token / JWT authentication.
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

LOGIN_URL = '/api-auth/login/'
LOGIN_REDIRECT_URL = '/api/chat/threads/'
LOGOUT_REDIRECT_URL = '/api-auth/login/'


# ---------------------------------------------------------------------------
# Databases
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "Chat_To_BI_DW"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5433"),  # PostgreSQL default is 5432
    }
}

# Same database, read-only role: the only connection run_sql is allowed to use.
DATABASES["dw_readonly"] = {
    **DATABASES["default"],
    "USER": os.getenv("DW_READONLY_USER", "dw_reader"),
    "PASSWORD": os.getenv("DW_READONLY_PASSWORD", ""),
    "OPTIONS": {"options": "-c default_transaction_read_only=on"},  # second safety net
}
AGENT_DB_ALIAS = "dw_readonly"


# ---------------------------------------------------------------------------
# Caches
# ---------------------------------------------------------------------------
CACHES = {
    # Dashboard (cache_page), ETL lock, DRF throttling. The ETL clears this one.
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    # Agent query results, chart specs, per-conversation lock. Separate alias:
    # the ETL's cache.clear() must not erase them, and files survive runserver reloads.
    "agent_results": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": str(BASE_DIR / "agent_results_cache"),
        "TIMEOUT": 3600,
        "OPTIONS": {"MAX_ENTRIES": 5000},
    },
}


# ---------------------------------------------------------------------------
# ETL
# ---------------------------------------------------------------------------
# Default CSV used by the ETL process
SOURCE_FILE = BASE_DIR / "data" / "sources" / "Sample - Superstore.csv"


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------
AGENT_MODEL = os.getenv("AGENT_MODEL", "openai/gpt-oss-120b")  # "provider:model"
AGENT_MAX_MODEL_CALLS = 10   # LLM calls per user question (one question = 1 to 4 tool rounds)
AGENT_RECURSION_LIMIT = 30   # LangGraph safety net
AGENT_CHECKPOINT_DB = BASE_DIR / "agent_checkpoints.sqlite3"  # short-term memory
CHART_CATALOG_PATH = os.environ.get(
    "CHART_CATALOG_PATH",
    BASE_DIR / "frontend" / "src" / "chart-engine" / "contract" / "chartCatalog.json",
)          # catalog provided by the frontend


# ---------------------------------------------------------------------------
# Logging (shows the agent's logger.info messages in the terminal)
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"chattodashboard": {"handlers": ["console"], "level": "INFO"}},
}


# ---------------------------------------------------------------------------
# Password validation, i18n, static files
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'