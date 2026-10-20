"""Notice endpoints - thin wrappers around announcements/queries.py."""

from rest_framework import status

from core.responses import respond
from core.views import TournamentView

from .queries import createAnnouncement, deleteAnnouncement, getAnnouncement, getAnnouncements, updateAnnouncement


class Announcements(TournamentView):
    def get(self, request):
        return respond(getAnnouncements(self.tid))

    def post(self, request):
        return respond(createAnnouncement(self.tid, request.data), status.HTTP_201_CREATED)


class AnnouncementDetail(TournamentView):
    def get(self, request, pk):
        return respond(getAnnouncement(self.tid, pk))

    def patch(self, request, pk):
        return respond(updateAnnouncement(self.tid, pk, request.data))

    put = patch

    def delete(self, request, pk):
        return respond(deleteAnnouncement(self.tid, pk), status.HTTP_204_NO_CONTENT)
