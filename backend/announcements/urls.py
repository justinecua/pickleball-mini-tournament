from django.urls import path

from .views import AnnouncementDetail, Announcements

urlpatterns = []

# Mounted under /api/t/<slug>/.
tournament_urlpatterns = [
    path('announcements/', Announcements.as_view(), name='announcements'),
    path('announcements/<int:pk>/', AnnouncementDetail.as_view(), name='announcement-detail'),
]
