from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from pathlib import Path


def spa_index(request):
    index = Path(settings.BASE_DIR) / 'frontend_build' / 'index.html'
    return HttpResponse(index.read_bytes(), content_type='text/html')


urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT auth
    path('api/auth/token/',         TokenObtainPairView.as_view(),  name='token_obtain'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(),     name='token_refresh'),

    # Apps
    path('api/courses/',       include('courses.urls')),
    path('api/users/',         include('users.urls')),
    path('api/documents/',     include('documents.urls')),
    path('api/notifications/', include('notifications.urls')),

    # React SPA catch-all
    re_path(r'^(?!api/|admin/).*$', spa_index),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
