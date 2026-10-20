"""Account endpoints - thin wrappers around account/queries.py.
The acting user always comes from the login token."""

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from core.permissions import IsAdmin
from core.responses import respond

from .queries import deleteUser, getMe, getUsers, login, logout, register, updateMe, updateUser


class Register(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return respond(register(request.data), status.HTTP_201_CREATED)


class Login(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return respond(login(request.data))


class Logout(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request.user.id)
        return respond(None, status.HTTP_204_NO_CONTENT)


class Me(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return respond(getMe(request.user.id))

    def patch(self, request):
        return respond(updateMe(request.user.id, request.data))


class Users(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return respond(getUsers())


class UserDetail(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        return respond(updateUser(request.user.id, pk, request.data))

    put = patch

    def delete(self, request, pk):
        return respond(deleteUser(request.user.id, pk), status.HTTP_204_NO_CONTENT)
