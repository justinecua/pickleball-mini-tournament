"""
queries.py functions return plain data, or {"error": ...} when something is
wrong. respond() turns that into an HTTP response with the same status codes
and error shapes the frontend already handles:

  {"error": msg}                      -> 400 {"detail": msg}
  {"error": msg, "status": 404}       -> 404 {"detail": msg}
  {"error": msg, "fields": {...}}     -> 400 {field: [msg, ...]}
"""

from rest_framework import status as http
from rest_framework.response import Response


def respond(result, status=http.HTTP_200_OK):
    if isinstance(result, dict) and 'error' in result:
        payload = result.get('fields') or {'detail': result['error']}
        return Response(payload, status=result.get('status', http.HTTP_400_BAD_REQUEST))
    if result is None and status == http.HTTP_204_NO_CONTENT:
        return Response(status=status)
    return Response(result, status=status)
