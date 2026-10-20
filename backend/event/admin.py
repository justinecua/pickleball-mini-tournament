from django.contrib import admin

from .models import Court, TimelineEvent, Tournament


class CourtInline(admin.TabularInline):
    model = Court
    extra = 0


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'host', 'date', 'start_time', 'registration_open', 'drawn_at']
    inlines = [CourtInline]


@admin.register(TimelineEvent)
class TimelineEventAdmin(admin.ModelAdmin):
    list_display = ['tournament', 'order', 'start_time', 'end_time', 'activity', 'games']
    list_filter = ['tournament']
