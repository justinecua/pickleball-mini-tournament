"""Team (bracket slot) endpoints - thin wrappers around teams/queries.py."""

from core.responses import respond
from core.views import TournamentView

from .queries import getTeam, getTeams, updateTeam


class Teams(TournamentView):
    def get(self, request):
        return respond(getTeams(self.tid))


class TeamDetail(TournamentView):
    def get(self, request, pk):
        return respond(getTeam(self.tid, pk))

    def patch(self, request, pk):
        return respond(updateTeam(self.tid, pk, request.data))

    put = patch
