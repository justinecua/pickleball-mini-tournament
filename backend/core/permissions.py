from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_host(user, tournament):
    """The tournament's host, or a site admin (is_staff), may manage it."""
    if not (user and user.is_authenticated) or tournament is None:
        return False
    return bool(user.is_staff or user.id == tournament['host_id'])


class IsAdminOrReadOnly(BasePermission):
    """Anyone can read; only admins (is_staff) can change things."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_staff)


class IsHostOrReadOnly(BasePermission):
    """Anyone can read a tournament; only its host (or an admin) can change it. Needs a TournamentView."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return is_host(request.user, view.tournament)


class IsHost(BasePermission):
    def has_permission(self, request, view):
        return is_host(request.user, view.tournament)
