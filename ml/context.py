"""Contextual match features for World Cup 2026: travel, rest, and altitude.

These are computable from the schedule + venue + team home-base data we already
have (unlike squad data, which is released later). Altitude is applied as a small,
bounded, well-justified adjustment to a team's expected goals — playing well above
your home altitude measurably reduces attacking output (Mexico City sits at
~2,240 m). Travel and rest are quantified for display and carry only a marginal
effect, so the model stays calibrated.

Everything here is transparent and bounded; magnitudes are intentionally
conservative and documented in the Model Lab.
"""
from __future__ import annotations
import math

# Altitude effect: no penalty until ~1,000 m above a team's home altitude, then a
# linear ramp, capped. A sea-level team at Mexico City loses ~12% attacking output.
ALT_THRESHOLD_M = 1000.0
ALT_FULL_M = 4000.0
ALT_MAX_PENALTY = 0.12

# Rest: a small bonus/penalty around a 4-day baseline between matches.
REST_BASELINE_DAYS = 4.0
REST_PER_DAY = 0.01
REST_CAP = 0.04


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def altitude_penalty(home_altitude: float | None, venue_altitude: float) -> float:
    """Fraction by which to reduce a team's expected goals (0..ALT_MAX_PENALTY)."""
    if home_altitude is None:
        home_altitude = 0.0
    delta = venue_altitude - home_altitude
    if delta <= ALT_THRESHOLD_M:
        return 0.0
    frac = (delta - ALT_THRESHOLD_M) / (ALT_FULL_M - ALT_THRESHOLD_M)
    return round(min(max(frac, 0.0), 1.0) * ALT_MAX_PENALTY, 4)


def rest_factor(rest_days: float | None) -> float:
    """Multiplicative tweak to expected goals from days of rest (~1.0)."""
    if rest_days is None:
        return 1.0
    adj = (rest_days - REST_BASELINE_DAYS) * REST_PER_DAY
    return 1.0 + max(min(adj, REST_CAP), -REST_CAP)


def context_for_team(home_lat, home_lng, home_alt, venue, rest_days):
    """Bundle of context features + the multiplicative goal factor for one team."""
    travel = None
    if home_lat is not None and home_lng is not None:
        travel = round(haversine_km(home_lat, home_lng, venue["lat"], venue["lng"]))
    alt_pen = altitude_penalty(home_alt, venue["altitude"])
    rest = rest_factor(rest_days)
    goal_factor = round((1.0 - alt_pen) * rest, 4)
    return {
        "travelKm": travel,
        "altitudePenalty": alt_pen,
        "restDays": rest_days,
        "goalFactor": goal_factor,
    }
