from django.contrib import admin

from .models import Entry


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = ['name', 'captain', 'partner', 'status', 'confirmed_at', 'checked_in_at', 'slot']
    list_filter = ['tournament', 'status']
