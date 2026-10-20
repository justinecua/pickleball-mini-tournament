"""Schedule and scoring endpoints - thin wrappers around matches/queries.py."""

from core.permissions import IsHost
from core.responses import respond
from core.views import TournamentView

from .queries import getMatch, getMatches, getStandings, resetMatch, resetResults, updateMatch


class Matches(TournamentView):
    def get(self, request):
        return respond(getMatches(self.tid, request.query_params.get('stage')))


class MatchDetail(TournamentView):
    def get(self, request, pk):
        return respond(getMatch(self.tid, pk))

    def patch(self, request, pk):
        return respond(updateMatch(self.tid, pk, request.data))

    put = patch


class MatchReset(TournamentView):
    def post(self, request, pk):
        return respond(resetMatch(self.tid, pk))


class Standings(TournamentView):
    def get(self, request):
        return respond(getStandings(self.tid))


class ResetResults(TournamentView):
    permission_classes = [IsHost]

    def post(self, request):
        return respond(resetResults(self.tid))
