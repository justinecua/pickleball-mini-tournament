from django.urls import path

from .views import MatchDetail, Matches, MatchReset, ResetResults, Standings

urlpatterns = []

# Mounted under /api/t/<slug>/.
tournament_urlpatterns = [
    path('matches/', Matches.as_view(), name='matches'),
    path('matches/<int:pk>/', MatchDetail.as_view(), name='match-detail'),
    path('matches/<int:pk>/reset/', MatchReset.as_view(), name='match-reset'),
    path('standings/', Standings.as_view(), name='standings'),
    path('reset-results/', ResetResults.as_view(), name='reset-results'),
]
