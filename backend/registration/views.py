"""Registration, check-in and draw endpoints - thin wrappers around registration/queries.py.
The acting user always comes from the login token."""

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from core.permissions import IsHost, is_host, overrides
from core.responses import respond
from core.views import TournamentView

from .queries import (
    addEntry, checkIn, createEntry, getEntries, getInvite, getMyEntry, getSoloPlayers, getTicket, joinEntry,
    leaveEntry, pairPlayers, removeEntry, runDraw, swapSlots, ticket_tournament,
)


class Entries(TournamentView):
    """Anyone can see a tournament's teams; creating one needs an account."""

    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsAuthenticated()]

    def get(self, request):
        return respond(getEntries(self.tid, request.user.id, self.is_host))

    def post(self, request):
        return respond(createEntry(self.tid, request.user.id, request.data), status.HTTP_201_CREATED)


class MyEntry(TournamentView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return respond(getMyEntry(self.tid, request.user.id))


class LeaveEntry(TournamentView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        return respond(leaveEntry(self.tid, request.user.id, pk))


class Invite(APIView):
    permission_classes = [AllowAny]

    def get(self, request, code):
        return respond(getInvite(code))


class JoinEntry(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return respond(joinEntry(request.user.id, request.data))


class CheckIn(APIView):
    """Any signed-in user can see a ticket's status; only that tournament's host can check a team in."""

    permission_classes = [IsAuthenticated]

    def get(self, request, token):
        return respond(getTicket(token))

    def post(self, request, token):
        return respond(checkIn(token, is_host(request.user, ticket_tournament(token))))


class AddEntry(TournamentView):
    permission_classes = [IsHost]

    def post(self, request):
        return respond(addEntry(self.tid, request.data, overrides(request)), status.HTTP_201_CREATED)


class RemoveEntry(TournamentView):
    permission_classes = [IsHost]

    def post(self, request, pk):
        return respond(removeEntry(self.tid, pk, overrides(request)))


class SoloPlayers(TournamentView):
    permission_classes = [IsHost]

    def get(self, request):
        return respond(getSoloPlayers(self.tid))


class PairPlayers(TournamentView):
    permission_classes = [IsHost]

    def post(self, request):
        return respond(pairPlayers(self.tid, request.data, overrides(request)), status.HTTP_201_CREATED)


class Draw(TournamentView):
    permission_classes = [IsHost]

    def post(self, request):
        return respond(runDraw(self.tid, force=overrides(request)))


class Swap(TournamentView):
    permission_classes = [IsHost]

    def post(self, request):
        return respond(swapSlots(self.tid, request.data, overrides(request)))
