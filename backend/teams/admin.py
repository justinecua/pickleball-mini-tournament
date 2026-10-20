from django.contrib import admin

from .models import Team


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'player1', 'player2', 'bracket', 'seed']
    list_filter = ['tournament', 'bracket']
