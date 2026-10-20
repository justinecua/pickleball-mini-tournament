from django.contrib import admin

from .models import Announcement


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['title', 'tournament', 'pinned', 'created_at']
    list_filter = ['tournament']
