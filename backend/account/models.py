from django.db import models


class Profile(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE, related_name='profile')
    looking_for_partner = models.BooleanField(default=False)
    partner_note = models.CharField(max_length=160, blank=True)

    def __str__(self):
        return f'Profile of {self.user.username}'
