"""Preference learning, gamified questionnaire, AI insights (paid subscribers)."""
import json
import logging
from datetime import datetime, timezone

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import (
    get_supabase_admin,
    require_paid_llm_access,
    require_paid_plan,
    require_realtor_plan,
    log_llm_usage,
)
from app.llm import has_llm_provider, invoke_llm
from app.preference_learning import (
    GAMIFIED_QUESTIONS,
    apply_response_to_preferences,
    get_learned_profile,
    get_learned_weights,
    signal_from_response,
    top_hidden_preferences,
)

router = APIRouter(prefix="/preferences", tags=["preferences"])
logger = logging.getLogger(__name__)


def _require_llm_provider() -> None:
    if not has_llm_provider():
        raise HTTPException(status_code=503, detail="AI service is not configured")


class StartQuestionnaireBody(BaseModel):
    property_address: str
    assignment_id: str | None = None


class RespondBody(BaseModel):
    session_id: str
    category_id: str
    category_label: str
    question_text: str
    response_value: Literal["love", "like", "neutral", "dislike", "hate"]


class ExplainScoreBody(BaseModel):
    property_address: str
    percentage: int
    categories: list[dict]


class VisitNotesBody(BaseModel):
    property_address: str
    notes: str
    categories: list[dict] | None = None


class RealtorDraftBody(BaseModel):
    client_name: str
    properties: list[dict]
    draft_type: str = "comparison_email"


@router.get("/learned")
async def get_learned(user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    profile = get_learned_profile(supabase, user_id)
    hidden = top_hidden_preferences(profile)
    return {"preferences": profile, "hidden_strengths": hidden}


@router.post("/questionnaire/start")
async def start_questionnaire(body: StartQuestionnaireBody, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    address = (body.property_address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="property_address required")

    if body.assignment_id:
        ar = (
            supabase.table("realtor_property_assignments")
            .select("id, client_user_id, status")
            .eq("id", body.assignment_id)
            .execute()
        )
        if not ar.data or ar.data[0]["client_user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Assignment not found")
        supabase.table("realtor_property_assignments").update(
            {"status": "in_progress", "read_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", body.assignment_id).execute()

    questions = [{"category_id": c[0], "category_label": c[1], "question_text": c[2]} for c in GAMIFIED_QUESTIONS]
    ins = (
        supabase.table("questionnaire_sessions")
        .insert(
            {
                "user_id": user_id,
                "assignment_id": body.assignment_id,
                "property_address": address,
                "questions_total": len(questions),
                "questions_answered": 0,
            }
        )
        .execute()
    )
    session = ins.data[0] if ins.data else None
    if not session:
        raise HTTPException(status_code=500, detail="Could not start questionnaire")
    return {"session_id": session["id"], "questions": questions, "property_address": address}


@router.post("/questionnaire/respond")
async def questionnaire_respond(body: RespondBody, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    sr = supabase.table("questionnaire_sessions").select("*").eq("id", body.session_id).eq("user_id", user_id).execute()
    if not sr.data:
        raise HTTPException(status_code=404, detail="Session not found")

    signal = signal_from_response(body.response_value)
    supabase.table("questionnaire_responses").insert(
        {
            "session_id": body.session_id,
            "user_id": user_id,
            "category_id": body.category_id,
            "category_label": body.category_label,
            "question_text": body.question_text,
            "response_value": body.response_value,
            "signal_score": signal,
        }
    ).execute()

    updated = apply_response_to_preferences(supabase, user_id, body.category_id, body.response_value)
    session = sr.data[0]
    answered = int(session.get("questions_answered") or 0) + 1
    total = int(session.get("questions_total") or 0)
    completed = answered >= total
    patch = {"questions_answered": answered, "completed": completed}
    if completed:
        patch["completed_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("questionnaire_sessions").update(patch).eq("id", body.session_id).execute()

    if completed and session.get("assignment_id"):
        supabase.table("realtor_property_assignments").update(
            {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", session["assignment_id"]).execute()

    return {"updated_preference": updated, "questions_answered": answered, "completed": completed}


@router.get("/insights")
async def preference_insights(user_id: str = Depends(require_paid_llm_access)):
    _require_llm_provider()
    supabase = get_supabase_admin()
    learned = get_learned_profile(supabase, user_id)
    weights = get_learned_weights(supabase, user_id)
    hidden = top_hidden_preferences(learned)

    if not learned:
        return {
            "insight": "Complete a gamified walk-through on a property to start learning your hidden preferences.",
            "hidden_preferences": [],
            "suggestions": [],
        }

    weight_lines = "\n".join(
        f"- {row['category_id']}: weight {row['weight']}/10 (confidence {row.get('confidence', 0)}, n={row.get('response_count', 0)})"
        for row in learned[:12]
    )
    hidden_lines = ", ".join(h["category_id"] for h in hidden) or "none yet"

    log_llm_usage(supabase, user_id, "preference_insights")
    result = await invoke_llm(
        f"""You are a buyer preference coach for a home search app.

LEARNED CATEGORY WEIGHTS (from gamified walk-through responses, EMA formula):
{weight_lines}

STRONG HIDDEN PREFERENCES (high weight, user may not realize):
{hidden_lines}

Write JSON:
1) insight: 2-3 sentences on what this buyer truly values (plain language, no jargon)
2) hidden_preferences: array of {{ "category", "why_surprising", "tip" }} — patterns they may not notice about themselves
3) suggestions: array of {{ "title", "reason" }} — what to prioritize on future tours (not specific addresses)""",
        {
            "type": "object",
            "properties": {
                "insight": {"type": "string"},
                "hidden_preferences": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "category": {"type": "string"},
                            "why_surprising": {"type": "string"},
                            "tip": {"type": "string"},
                        },
                    },
                },
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"title": {"type": "string"}, "reason": {"type": "string"}},
                    },
                },
            },
        },
        feature="preference_insights",
    ) or {}

    if result.get("insight"):
        try:
            supabase.table("preference_insights").insert(
                {
                    "user_id": user_id,
                    "insight_type": "profile",
                    "title": "Your buyer profile",
                    "body": result["insight"],
                    "metadata": result,
                }
            ).execute()
        except Exception:
            pass

    return {**result, "learned_weights": weights}


@router.post("/explain-score")
async def explain_score(body: ExplainScoreBody, user_id: str = Depends(require_paid_llm_access)):
    _require_llm_provider()
    supabase = get_supabase_admin()
    cats = json.dumps(body.categories[:40], indent=2)
    log_llm_usage(supabase, user_id, "explain_score")
    result = await invoke_llm(
        f"""Explain this property score to a home buyer in plain language.
Property: {body.property_address}
Overall score: {body.percentage}/100
Category breakdown (importance weight × score):
{cats}

Rules: Only interpret the numbers provided. Do not invent property facts. Return JSON with:
- summary: 2-3 sentences
- strengths: array of short strings
- tradeoffs: array of short strings
- compare_tip: one sentence on what to weigh if comparing homes""",
        {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "strengths": {"type": "array", "items": {"type": "string"}},
                "tradeoffs": {"type": "array", "items": {"type": "string"}},
                "compare_tip": {"type": "string"},
            },
        },
        feature="explain_score",
    )
    return result or {}


@router.post("/visit-notes-to-scores")
async def visit_notes_to_scores(body: VisitNotesBody, user_id: str = Depends(require_paid_llm_access)):
    _require_llm_provider()
    supabase = get_supabase_admin()
    cat_hint = json.dumps(body.categories or [], indent=2)
    log_llm_usage(supabase, user_id, "visit_notes_to_scores")
    result = await invoke_llm(
        f"""Convert open-house visit notes into category scores 1-10.

Property: {body.property_address}
Notes:
{body.notes}

Categories to score (use id field in response):
{cat_hint}

Return JSON: {{ "scores": [{{ "id": "category_id", "score": number, "rationale": "string" }}] }}
Only score categories mentioned or strongly implied. Be conservative.""",
        {
            "type": "object",
            "properties": {
                "scores": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "score": {"type": "number"},
                            "rationale": {"type": "string"},
                        },
                    },
                }
            },
        },
        feature="visit_notes_to_scores",
    )
    return result or {"scores": []}


@router.post("/realtor-draft")
async def realtor_draft(
    body: RealtorDraftBody,
    user_id: str = Depends(require_realtor_plan),
    _llm_user_id: str = Depends(require_paid_llm_access),
):
    _require_llm_provider()
    supabase = get_supabase_admin()
    log_llm_usage(supabase, user_id, "realtor_draft")
    props = json.dumps(body.properties[:10], indent=2)
    result = await invoke_llm(
        f"""Write a professional email draft for a realtor to send their buyer client.

Client: {body.client_name}
Draft type: {body.draft_type}
Properties / comparisons:
{props}

Return JSON: {{ "subject": "string", "body": "string" }}
Warm, concise, no fabricated listing details not in the data.""",
        {
            "type": "object",
            "properties": {"subject": {"type": "string"}, "body": {"type": "string"}},
        },
        feature="realtor_draft",
    )
    return result or {}
