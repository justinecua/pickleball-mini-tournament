from django.urls import path

from .views import TeamDetail, Teams

urlpatterns = []

# Mounted under /api/t/<slug>/.
tournament_urlpatterns = [
    path('teams/', Teams.as_view(), name='teams'),
    path('teams/<int:pk>/', TeamDetail.as_view(), name='team-detail'),
]
