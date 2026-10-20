"""Base view for endpoints under /api/t/<slug>/: loads the tournament before permissions are checked."""

from rest_framework.exceptions import NotFound
from rest_framework.views import APIView

from .db import connection
from .permissions import IsHostOrReadOnly, is_host


class TournamentView(APIView):
    permission_classes = [IsHostOrReadOnly]

    def dispatch(self, request, *args, slug=None, **kwargs):
        self.slug = slug
        return super().dispatch(request, *args, **kwargs)

    def initial(self, request, *args, **kwargs):
        # Imported here: event.queries imports from every app.
        from event.queries import load_tournament

        with connection().cursor() as cursor:
            self.tournament = load_tournament(cursor, self.slug)
        if self.tournament is None:
            raise NotFound('No tournament here.')
        self.tid = self.tournament['id']
        super().initial(request, *args, **kwargs)

    @property
    def is_host(self):
        return is_host(self.request.user, self.tournament)
