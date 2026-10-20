from django.urls import path

from .views import (
    AddEntry, CheckIn, Draw, Entries, Invite, JoinEntry, LeaveEntry, MyEntry, PairPlayers, RemoveEntry, SoloPlayers,
    Swap,
)

# Invite codes and tickets are unique across tournaments, so they work without one.
urlpatterns = [
    path('entries/join/', JoinEntry.as_view(), name='join-entry'),
    path('entries/invite/<str:code>/', Invite.as_view(), name='invite'),
    path('checkin/<str:token>/', CheckIn.as_view(), name='checkin'),
]

# Mounted under /api/t/<slug>/.
tournament_urlpatterns = [
    path('entries/', Entries.as_view(), name='entries'),
    path('entries/mine/', MyEntry.as_view(), name='my-entry'),
    path('entries/add/', AddEntry.as_view(), name='add-entry'),
    path('entries/<int:pk>/leave/', LeaveEntry.as_view(), name='leave-entry'),
    path('entries/<int:pk>/remove/', RemoveEntry.as_view(), name='remove-entry'),
    path('host/solo/', SoloPlayers.as_view(), name='solo-players'),
    path('host/pair/', PairPlayers.as_view(), name='pair-players'),
    path('host/draw/', Draw.as_view(), name='draw'),
    path('host/swap/', Swap.as_view(), name='swap'),
]
