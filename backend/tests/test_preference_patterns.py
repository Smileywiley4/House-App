"""Tests for preference pattern aggregation (privacy-safe summary)."""
from app.preference_patterns import (
    aggregate_from_scores,
    aggregate_from_weights,
    build_summary_line,
    public_card_payload,
)


def test_aggregate_top_importance_across_homes():
    rows = [
        {
            "scores": [
                {"category_id": "schools", "category_label": "Schools", "importance": 9, "score": 7},
                {"category_id": "hvac", "category_label": "HVAC", "importance": 3, "score": 8},
            ]
        },
        {
            "scores": [
                {"category_id": "schools", "category_label": "Schools", "importance": 10, "score": 5},
                {"category_id": "roof_quality", "category_label": "Roof Quality", "importance": 8, "score": 6},
            ]
        },
    ]
    pattern = aggregate_from_scores(rows, top_n=3)
    assert pattern["homes_scored"] == 2
    assert pattern["source"] == "scores"
    labels = [p["label"] for p in pattern["top_priorities"]]
    assert labels[0] == "Schools"
    assert "Roof Quality" in labels


def test_public_payload_excludes_pii_fields():
    pattern = aggregate_from_weights({"schools": 9, "hvac": 2}, {"schools": "Schools", "hvac": "HVAC"})
    card = public_card_payload(pattern, include_first_name=False, full_name="Jordan Lee")
    assert card["display_name"] is None
    assert card["privacy"]["includes_address"] is False
    assert card["privacy"]["includes_price"] is False
    assert card["privacy"]["includes_photo"] is False
    assert "Jordan" not in card["summary_line"]
    assert "address" not in card
    assert "price" not in card


def test_summary_line_with_first_name_opt_in():
    top = [{"label": "Natural light", "avg_importance": 9}]
    line = build_summary_line(14, top + [{"label": "Quiet street"}, {"label": "Move-in ready"}], first_name="Alex")
    assert "14 homes" in line
    assert "Alex's" in line
    assert "Natural light" in line
