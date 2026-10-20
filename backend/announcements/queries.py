"""
A tournament's notices, shown on its overview ("Bulletin") and managed from
the host's Notices tab. Pinned notices sort first, then newest.

Example:
    createAnnouncement(1, {"title": "Courts open at 5:30", "pinned": True})
    -> {"id": 3, "title": "Courts open at 5:30", "body": "", "pinned": True, ...}
"""

from django.db import transaction

from core.db import Invalid, aware, connection, field_error, now, row, rows, to_bool, to_text

SELECT = 'SELECT id, title, body, pinned, created_at FROM announcements_announcement WHERE tournament_id = %s'
ORDER = ' ORDER BY pinned DESC, created_at DESC'


def announcement_dict(a):
    return {
        'id': a['id'],
        'title': a['title'],
        'body': a['body'],
        'pinned': bool(a['pinned']),
        'created_at': aware(a['created_at']),
    }


def latest(cursor, tid, limit):
    cursor.execute(SELECT + ORDER + ' LIMIT %s;', [tid, limit])
    return [announcement_dict(a) for a in rows(cursor)]


def _fetch(cursor, tid, announcement_id):
    cursor.execute(SELECT + ' AND id = %s;', [tid, announcement_id])
    found = row(cursor)
    return announcement_dict(found) if found else None


def _clean(data, partial):
    fields = {}
    if 'title' in data or not partial:
        fields['title'] = to_text(data.get('title'), 'title', 120, required=True)
    if 'body' in data or not partial:
        fields['body'] = '' if data.get('body') is None else str(data.get('body'))
    if 'pinned' in data or not partial:
        fields['pinned'] = to_bool(data.get('pinned', False))
    return fields


def getAnnouncements(tid):
    with connection().cursor() as cursor:
        cursor.execute(SELECT + ORDER + ';', [tid])
        return [announcement_dict(a) for a in rows(cursor)]


def getAnnouncement(tid, announcement_id):
    with connection().cursor() as cursor:
        found = _fetch(cursor, tid, announcement_id)
    return found or {'error': 'Not found.', 'status': 404}


def createAnnouncement(tid, data):
    try:
        fields = _clean(data, partial=False)
    except Invalid as exc:
        return field_error(exc)
    with transaction.atomic(), connection().cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO announcements_announcement (tournament_id, title, body, pinned, created_at)
            VALUES (%s, %s, %s, %s, %s) RETURNING id;
            """,
            [tid, fields['title'], fields['body'], fields['pinned'], now()],
        )
        return _fetch(cursor, tid, cursor.fetchone()[0])


def updateAnnouncement(tid, announcement_id, data):
    try:
        fields = _clean(data, partial=True)
    except Invalid as exc:
        return field_error(exc)
    with transaction.atomic(), connection().cursor() as cursor:
        if _fetch(cursor, tid, announcement_id) is None:
            return {'error': 'Not found.', 'status': 404}
        if fields:
            assignments = ', '.join(f'{field} = %s' for field in fields)
            cursor.execute(
                f'UPDATE announcements_announcement SET {assignments} WHERE id = %s;', [*fields.values(), announcement_id]
            )
        return _fetch(cursor, tid, announcement_id)


def deleteAnnouncement(tid, announcement_id):
    with connection().cursor() as cursor:
        cursor.execute(
            'DELETE FROM announcements_announcement WHERE id = %s AND tournament_id = %s;', [announcement_id, tid]
        )
        if cursor.rowcount == 0:
            return {'error': 'Not found.', 'status': 404}
    return None
