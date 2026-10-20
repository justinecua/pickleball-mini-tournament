from django.contrib import admin
from django.urls import include, path

from announcements.urls import tournament_urlpatterns as announcement_urls
from event.urls import tournament_urlpatterns as event_urls
from matches.urls import tournament_urlpatterns as match_urls
from registration.urls import tournament_urlpatterns as registration_urls
from teams.urls import tournament_urlpatterns as team_urls

# One app per feature; each owns its endpoints under /api/. Everything that belongs to a
# single tournament lives under /api/t/<slug>/.
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('account.urls')),
    path('api/', include('event.urls')),
    path('api/', include('registration.urls')),
    path('api/t/<slug:slug>/', include(event_urls + team_urls + match_urls + registration_urls + announcement_urls)),
]
