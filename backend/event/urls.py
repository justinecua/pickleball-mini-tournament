from django.urls import path

from .views import Summary, Timeline, TimelineDetail, TournamentDetail, Tournaments

urlpatterns = [
    path('tournaments/', Tournaments.as_view(), name='tournaments'),
]

# Mounted under /api/t/<slug>/.
tournament_urlpatterns = [
    path('', TournamentDetail.as_view(), name='tournament'),
    path('timeline/', Timeline.as_view(), name='timeline'),
    path('timeline/<int:pk>/', TimelineDetail.as_view(), name='timeline-detail'),
    path('summary/', Summary.as_view(), name='summary'),
]
