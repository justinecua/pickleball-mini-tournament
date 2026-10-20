from django.db import models


class Announcement(models.Model):
    tournament = models.ForeignKey('event.Tournament', on_delete=models.CASCADE, related_name='announcements')
    title = models.CharField(max_length=120)
    body = models.TextField(blank=True)
    pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-pinned', '-created_at']

    def __str__(self):
        return self.title
