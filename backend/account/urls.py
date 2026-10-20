from django.urls import path

from .views import Login, Logout, Me, Register, UserDetail, Users

urlpatterns = [
    path('auth/register/', Register.as_view(), name='register'),
    path('auth/login/', Login.as_view(), name='login'),
    path('auth/logout/', Logout.as_view(), name='logout'),
    path('auth/me/', Me.as_view(), name='me'),
    path('users/', Users.as_view(), name='users'),
    path('users/<int:pk>/', UserDetail.as_view(), name='user-detail'),
]
