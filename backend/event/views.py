"""Tournament endpoints (directory, details and courts, run of show, overview) - thin wrappers around event/queries.py."""

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from core.responses import respond
from core.views import TournamentView

from .queries import (
    createTimelineEvent, createTournament, deleteTimelineEvent, deleteTournament, getSummary, getTimeline,
    getTimelineEvent, getTournament, listTournaments, updateTimelineEvent, updateTournament,
)


class Tournaments(APIView):
    """Anyone can browse tournaments; any signed-in user can host one."""

    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsAuthenticated()]

    def get(self, request):
        return respond(listTournaments(request.user.id))

    def post(self, request):
        return respond(createTournament(request.user.id, request.data), status.HTTP_201_CREATED)


class TournamentDetail(TournamentView):
    def get(self, request):
        return respond(getTournament(self.tid, request.user.id, self.is_host))

    def patch(self, request):
        return respond(updateTournament(self.tid, request.data, request.user.id))

    put = patch

    def delete(self, request):
        return respond(deleteTournament(self.tid), status.HTTP_204_NO_CONTENT)


class Timeline(TournamentView):
    def get(self, request):
        return respond(getTimeline(self.tid))

    def post(self, request):
        return respond(createTimelineEvent(self.tid, request.data), status.HTTP_201_CREATED)


class TimelineDetail(TournamentView):
    def get(self, request, pk):
        return respond(getTimelineEvent(self.tid, pk))

    def patch(self, request, pk):
        return respond(updateTimelineEvent(self.tid, pk, request.data))

    put = patch

    def delete(self, request, pk):
        return respond(deleteTimelineEvent(self.tid, pk), status.HTTP_204_NO_CONTENT)


class Summary(TournamentView):
    def get(self, request):
        return respond(getSummary(self.tid))
