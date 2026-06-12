"""Context-feature tests (travel, rest, altitude). Run: python3 tests/test_context.py"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml"))
import context  # noqa: E402

failures = []


def check(name, cond):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if not cond:
        failures.append(name)


def test_altitude():
    sea = context.altitude_penalty(0, 2240)        # sea-level team at Mexico City
    check("sea-level team penalised at altitude", 0.03 < sea <= context.ALT_MAX_PENALTY)
    check("home team unpenalised", context.altitude_penalty(2240, 2240) == 0.0)
    check("high-altitude team unpenalised (<1000m delta)",
          context.altitude_penalty(1339, 2240) == 0.0)
    check("penalty is capped", context.altitude_penalty(0, 9000) == context.ALT_MAX_PENALTY)
    check("penalty monotonic in altitude",
          context.altitude_penalty(0, 1800) < context.altitude_penalty(0, 2600))


def test_rest():
    check("baseline rest is neutral", abs(context.rest_factor(4) - 1.0) < 1e-9)
    check("more rest helps", context.rest_factor(8) > 1.0)
    check("less rest hurts", context.rest_factor(2) < 1.0)
    check("rest effect is capped", context.rest_factor(100) <= 1.0 + context.REST_CAP + 1e-9)
    check("missing rest is neutral", context.rest_factor(None) == 1.0)


def test_travel():
    check("zero distance for same point", context.haversine_km(40, -74, 40, -74) < 1e-6)
    d = context.haversine_km(40.81, -74.07, 19.43, -99.13)  # NY/NJ -> Mexico City
    check("plausible NY->Mexico City distance", 3000 < d < 3600)


def test_bundle():
    venue = {"lat": 19.43, "lng": -99.13, "altitude": 2240}
    c = context.context_for_team(51.5, -0.13, 11, venue, rest_days=3)  # England-like
    check("goal factor reduced at altitude", c["goalFactor"] < 1.0)
    check("travel computed", c["travelKm"] and c["travelKm"] > 5000)


if __name__ == "__main__":
    print("Context tests:")
    for fn in [test_altitude, test_rest, test_travel, test_bundle]:
        fn()
    if failures:
        sys.exit(f"\n{len(failures)} test(s) failed: {failures}")
    print("\nAll context tests passed.")
