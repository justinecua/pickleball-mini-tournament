"""Used by the data migrations that moved the single-event app to multi-tournament."""


def default_tournament(apps):
    """The tournament existing rows move into: the first one, created if there is none."""
    Tournament = apps.get_model('event', 'Tournament')
    found = Tournament.objects.order_by('id').first()
    if found is None:
        found = Tournament.objects.create(slug='pickleball-mini-tournament', name='Pickleball Mini Tournament')
    return found


def assign_tournament(app_label, model_name):
    def forwards(apps, schema_editor):
        Model = apps.get_model(app_label, model_name)
        if Model.objects.filter(tournament__isnull=True).exists():
            Model.objects.filter(tournament__isnull=True).update(tournament=default_tournament(apps))
    return forwards
