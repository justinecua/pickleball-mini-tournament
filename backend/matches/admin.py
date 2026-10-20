from django.contrib import admin

from .models import Match


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['code', 'label', 'stage', 'court', 'start_time', 'team1', 'team2', 'score1', 'score2', 'status']
    list_filter = ['tournament', 'stage', 'court', 'status']
