"""
Cloud Translation API v3 / v3beta1 proxy — service account (cloud-platform), Supabase JWT + admin plan.

https://cloud.google.com/translate/docs/quickstarts
https://translation.googleapis.com/v3/ and .../v3beta1/

**v3beta1** exposes a subset of v3 (no romanizeText, adaptive MT, models, datasets, glossary patch/entries, etc.).

`project_id` / IDs in paths should be URL-encoded when they contain special characters.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from app.dependencies import require_admin_plan
from app.translate_v3 import translate_configured, translate_request

router = APIRouter(prefix="/google/translate", tags=["google-translate"])


def _tr_api_version(request: Request) -> str:
    return "v3beta1" if "/google/translate/v3beta1/" in request.url.path else "v3"


def _require_tr() -> None:
    if not translate_configured():
        raise HTTPException(
            status_code=503,
            detail="Translation API not configured (GOOGLE_TRANSLATE_SA_JSON_PATH).",
        )


async def _e(method: str, path: str, **kwargs: Any) -> Any:
    try:
        return await translate_request(method, path, **kwargs)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- projects.* ---


@router.post("/v3/projects/{project_id}:romanizeText")
async def tr_projects_romanize_text(
    project_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    return await _e("POST", f"projects/{project_id}:romanizeText", json_body=body)


@router.get("/v3/projects/{project_id}/supportedLanguages")
@router.get("/v3beta1/projects/{project_id}/supportedLanguages")
async def tr_projects_supported_languages(
    project_id: str,
    request: Request,
    model: str | None = Query(None),
    display_language_code: str | None = Query(None, alias="displayLanguageCode"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    params: dict[str, Any] = {}
    if model:
        params["model"] = model
    if display_language_code:
        params["displayLanguageCode"] = display_language_code
    return await _e(
        "GET",
        f"projects/{project_id}/supportedLanguages",
        api_version=_tr_api_version(request),
        params=params if params else None,
    )


@router.post("/v3/projects/{project_id}:translateText")
@router.post("/v3beta1/projects/{project_id}:translateText")
async def tr_projects_translate_text(
    project_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    return await _e(
        "POST",
        f"projects/{project_id}:translateText",
        api_version=_tr_api_version(request),
        json_body=body,
    )


@router.post("/v3/projects/{project_id}:detectLanguage")
@router.post("/v3beta1/projects/{project_id}:detectLanguage")
async def tr_projects_detect_language(
    project_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    return await _e(
        "POST",
        f"projects/{project_id}:detectLanguage",
        api_version=_tr_api_version(request),
        json_body=body,
    )


# --- projects.locations (list / get) ---


@router.get("/v3/projects/{project_id}/locations")
@router.get("/v3beta1/projects/{project_id}/locations")
async def tr_locations_list(
    project_id: str,
    request: Request,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    extra_location_types: list[str] | None = Query(None, alias="extraLocationTypes"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}"
    params: dict[str, Any] = {}
    if filter_:
        params["filter"] = filter_
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if extra_location_types:
        params["extraLocationTypes"] = extra_location_types
    return await _e(
        "GET",
        f"{parent}/locations",
        api_version=_tr_api_version(request),
        params=params if params else None,
    )


@router.get("/v3/projects/{project_id}/locations/{location_id}")
@router.get("/v3beta1/projects/{project_id}/locations/{location_id}")
async def tr_locations_get(
    project_id: str,
    location_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    return await _e(
        "GET",
        f"projects/{project_id}/locations/{location_id}",
        api_version=_tr_api_version(request),
    )


# --- projects.locations.* methods ---


@router.post("/v3/projects/{project_id}/locations/{location_id}:batchTranslateText")
@router.post("/v3beta1/projects/{project_id}/locations/{location_id}:batchTranslateText")
async def tr_batch_translate_text(
    project_id: str,
    location_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}:batchTranslateText",
        api_version=_tr_api_version(request),
        json_body=body,
        timeout=600.0,
    )


@router.post("/v3/projects/{project_id}/locations/{location_id}:adaptiveMtTranslate")
async def tr_adaptive_mt_translate(
    project_id: str,
    location_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e("POST", f"{parent}:adaptiveMtTranslate", json_body=body)


@router.post("/v3/projects/{project_id}/locations/{location_id}:romanizeText")
async def tr_locations_romanize_text(
    project_id: str,
    location_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e("POST", f"{parent}:romanizeText", json_body=body)


@router.get("/v3/projects/{project_id}/locations/{location_id}/supportedLanguages")
@router.get("/v3beta1/projects/{project_id}/locations/{location_id}/supportedLanguages")
async def tr_locations_supported_languages(
    project_id: str,
    location_id: str,
    request: Request,
    model: str | None = Query(None),
    display_language_code: str | None = Query(None, alias="displayLanguageCode"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if model:
        params["model"] = model
    if display_language_code:
        params["displayLanguageCode"] = display_language_code
    return await _e(
        "GET",
        f"{parent}/supportedLanguages",
        api_version=_tr_api_version(request),
        params=params if params else None,
    )


@router.post("/v3/projects/{project_id}/locations/{location_id}:batchTranslateDocument")
@router.post("/v3beta1/projects/{project_id}/locations/{location_id}:batchTranslateDocument")
async def tr_batch_translate_document(
    project_id: str,
    location_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}:batchTranslateDocument",
        api_version=_tr_api_version(request),
        json_body=body,
        timeout=600.0,
    )


@router.post("/v3/projects/{project_id}/locations/{location_id}:translateText")
@router.post("/v3beta1/projects/{project_id}/locations/{location_id}:translateText")
async def tr_locations_translate_text(
    project_id: str,
    location_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}:translateText",
        api_version=_tr_api_version(request),
        json_body=body,
    )


@router.post("/v3/projects/{project_id}/locations/{location_id}:translateDocument")
@router.post("/v3beta1/projects/{project_id}/locations/{location_id}:translateDocument")
async def tr_translate_document(
    project_id: str,
    location_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}:translateDocument",
        api_version=_tr_api_version(request),
        json_body=body,
        timeout=300.0,
    )


@router.post("/v3/projects/{project_id}/locations/{location_id}:refineText")
@router.post("/v3beta1/projects/{project_id}/locations/{location_id}:refineText")
async def tr_refine_text(
    project_id: str,
    location_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}:refineText",
        api_version=_tr_api_version(request),
        json_body=body,
    )


@router.post("/v3/projects/{project_id}/locations/{location_id}:detectLanguage")
@router.post("/v3beta1/projects/{project_id}/locations/{location_id}:detectLanguage")
async def tr_locations_detect_language(
    project_id: str,
    location_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}:detectLanguage",
        api_version=_tr_api_version(request),
        json_body=body,
    )


# --- models ---


@router.get("/v3/projects/{project_id}/locations/{location_id}/models/{model_id}")
async def tr_models_get(
    project_id: str,
    location_id: str,
    model_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/models/{model_id}"
    return await _e("GET", name)


@router.delete("/v3/projects/{project_id}/locations/{location_id}/models/{model_id}")
async def tr_models_delete(
    project_id: str,
    location_id: str,
    model_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/models/{model_id}"
    return await _e("DELETE", name)


@router.get("/v3/projects/{project_id}/locations/{location_id}/models")
async def tr_models_list(
    project_id: str,
    location_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    return await _e("GET", f"{parent}/models", params=params if params else None)


@router.post("/v3/projects/{project_id}/locations/{location_id}/models")
async def tr_models_create(
    project_id: str,
    location_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e("POST", f"{parent}/models", json_body=body, timeout=600.0)


# --- operations ---


@router.get("/v3/projects/{project_id}/locations/{location_id}/operations")
@router.get("/v3beta1/projects/{project_id}/locations/{location_id}/operations")
async def tr_operations_list(
    project_id: str,
    location_id: str,
    request: Request,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    return_partial_success: bool | None = Query(None, alias="returnPartialSuccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if filter_:
        params["filter"] = filter_
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if return_partial_success is not None:
        params["returnPartialSuccess"] = return_partial_success
    return await _e(
        "GET",
        f"{name}/operations",
        api_version=_tr_api_version(request),
        params=params if params else None,
    )


@router.get("/v3/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
@router.get("/v3beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
async def tr_operations_get(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/operations/{operation_id}"
    return await _e("GET", name, api_version=_tr_api_version(request))


@router.delete("/v3/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
@router.delete("/v3beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
async def tr_operations_delete(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/operations/{operation_id}"
    return await _e("DELETE", name, api_version=_tr_api_version(request))


@router.post("/v3/projects/{project_id}/locations/{location_id}/operations/{operation_id}:cancel")
@router.post("/v3beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}:cancel")
async def tr_operations_cancel(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/operations/{operation_id}"
    return await _e(
        "POST",
        f"{name}:cancel",
        api_version=_tr_api_version(request),
        json_body=body,
    )


@router.post("/v3/projects/{project_id}/locations/{location_id}/operations/{operation_id}:wait")
@router.post("/v3beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}:wait")
async def tr_operations_wait(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/operations/{operation_id}"
    return await _e(
        "POST",
        f"{name}:wait",
        api_version=_tr_api_version(request),
        json_body=body,
        timeout=600.0,
    )


# --- datasets ---


@router.post("/v3/projects/{project_id}/locations/{location_id}/datasets/{dataset_id}:importData")
async def tr_datasets_import_data(
    project_id: str,
    location_id: str,
    dataset_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    d = f"projects/{project_id}/locations/{location_id}/datasets/{dataset_id}"
    return await _e("POST", f"{d}:importData", json_body=body, timeout=600.0)


@router.post("/v3/projects/{project_id}/locations/{location_id}/datasets")
async def tr_datasets_create(
    project_id: str,
    location_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e("POST", f"{parent}/datasets", json_body=body, timeout=600.0)


@router.get("/v3/projects/{project_id}/locations/{location_id}/datasets")
async def tr_datasets_list(
    project_id: str,
    location_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e("GET", f"{parent}/datasets", params=params if params else None)


@router.get("/v3/projects/{project_id}/locations/{location_id}/datasets/{dataset_id}")
async def tr_datasets_get(
    project_id: str,
    location_id: str,
    dataset_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/datasets/{dataset_id}"
    return await _e("GET", name)


@router.post("/v3/projects/{project_id}/locations/{location_id}/datasets/{dataset_id}:exportData")
async def tr_datasets_export_data(
    project_id: str,
    location_id: str,
    dataset_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    d = f"projects/{project_id}/locations/{location_id}/datasets/{dataset_id}"
    return await _e("POST", f"{d}:exportData", json_body=body, timeout=600.0)


@router.delete("/v3/projects/{project_id}/locations/{location_id}/datasets/{dataset_id}")
async def tr_datasets_delete(
    project_id: str,
    location_id: str,
    dataset_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/datasets/{dataset_id}"
    return await _e("DELETE", name)


@router.get("/v3/projects/{project_id}/locations/{location_id}/datasets/{dataset_id}/examples")
async def tr_examples_list(
    project_id: str,
    location_id: str,
    dataset_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}/datasets/{dataset_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    return await _e("GET", f"{parent}/examples", params=params if params else None)


# --- glossaries ---


@router.patch("/v3/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}")
async def tr_glossaries_patch(
    project_id: str,
    location_id: str,
    glossary_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}"
    params = {"updateMask": update_mask} if update_mask else None
    return await _e("PATCH", name, params=params, json_body=body, timeout=600.0)


@router.get("/v3/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}")
@router.get("/v3beta1/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}")
async def tr_glossaries_get(
    project_id: str,
    location_id: str,
    glossary_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}"
    return await _e("GET", name, api_version=_tr_api_version(request))


@router.delete("/v3/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}")
@router.delete("/v3beta1/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}")
async def tr_glossaries_delete(
    project_id: str,
    location_id: str,
    glossary_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}"
    return await _e("DELETE", name, api_version=_tr_api_version(request), timeout=600.0)


@router.post("/v3/projects/{project_id}/locations/{location_id}/glossaries")
@router.post("/v3beta1/projects/{project_id}/locations/{location_id}/glossaries")
async def tr_glossaries_create(
    project_id: str,
    location_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}/glossaries",
        api_version=_tr_api_version(request),
        json_body=body,
        timeout=600.0,
    )


@router.get("/v3/projects/{project_id}/locations/{location_id}/glossaries")
@router.get("/v3beta1/projects/{project_id}/locations/{location_id}/glossaries")
async def tr_glossaries_list(
    project_id: str,
    location_id: str,
    request: Request,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    return await _e(
        "GET",
        f"{parent}/glossaries",
        api_version=_tr_api_version(request),
        params=params if params else None,
    )


# --- glossary entries ---


@router.delete(
    "/v3/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}/glossaryEntries/{entry_id}"
)
async def tr_glossary_entries_delete(
    project_id: str,
    location_id: str,
    glossary_id: str,
    entry_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = (
        f"projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}"
        f"/glossaryEntries/{entry_id}"
    )
    return await _e("DELETE", name)


@router.get(
    "/v3/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}/glossaryEntries/{entry_id}"
)
async def tr_glossary_entries_get(
    project_id: str,
    location_id: str,
    glossary_id: str,
    entry_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = (
        f"projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}"
        f"/glossaryEntries/{entry_id}"
    )
    return await _e("GET", name)


@router.patch(
    "/v3/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}/glossaryEntries/{entry_id}"
)
async def tr_glossary_entries_patch(
    project_id: str,
    location_id: str,
    glossary_id: str,
    entry_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = (
        f"projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}"
        f"/glossaryEntries/{entry_id}"
    )
    return await _e("PATCH", name, json_body=body)


@router.get("/v3/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}/glossaryEntries")
async def tr_glossary_entries_list(
    project_id: str,
    location_id: str,
    glossary_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e("GET", f"{parent}/glossaryEntries", params=params if params else None)


@router.post("/v3/projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}/glossaryEntries")
async def tr_glossary_entries_create(
    project_id: str,
    location_id: str,
    glossary_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}/glossaries/{glossary_id}"
    return await _e("POST", f"{parent}/glossaryEntries", json_body=body)


# --- adaptive MT datasets ---


@router.delete(
    "/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}"
)
async def tr_adaptive_datasets_delete(
    project_id: str,
    location_id: str,
    dataset_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}"
    return await _e("DELETE", name)


@router.get("/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}")
async def tr_adaptive_datasets_get(
    project_id: str,
    location_id: str,
    dataset_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = f"projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}"
    return await _e("GET", name)


@router.post("/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets")
async def tr_adaptive_datasets_create(
    project_id: str,
    location_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e("POST", f"{parent}/adaptiveMtDatasets", json_body=body)


@router.get("/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets")
async def tr_adaptive_datasets_list(
    project_id: str,
    location_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    return await _e("GET", f"{parent}/adaptiveMtDatasets", params=params if params else None)


@router.post(
    "/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}:importAdaptiveMtFile"
)
async def tr_adaptive_import_file(
    project_id: str,
    location_id: str,
    dataset_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    p = f"projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}"
    return await _e("POST", f"{p}:importAdaptiveMtFile", json_body=body, timeout=600.0)


@router.get(
    "/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}/adaptiveMtSentences"
)
async def tr_adaptive_sentences_list_dataset(
    project_id: str,
    location_id: str,
    dataset_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e("GET", f"{parent}/adaptiveMtSentences", params=params if params else None)


# --- adaptive MT files ---


@router.delete(
    "/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}/adaptiveMtFiles/{file_id}"
)
async def tr_adaptive_files_delete(
    project_id: str,
    location_id: str,
    dataset_id: str,
    file_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = (
        f"projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}"
        f"/adaptiveMtFiles/{file_id}"
    )
    return await _e("DELETE", name)


@router.get(
    "/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}/adaptiveMtFiles/{file_id}"
)
async def tr_adaptive_files_get(
    project_id: str,
    location_id: str,
    dataset_id: str,
    file_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    name = (
        f"projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}"
        f"/adaptiveMtFiles/{file_id}"
    )
    return await _e("GET", name)


@router.get(
    "/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}/adaptiveMtFiles"
)
async def tr_adaptive_files_list(
    project_id: str,
    location_id: str,
    dataset_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = f"projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e("GET", f"{parent}/adaptiveMtFiles", params=params if params else None)


@router.get(
    "/v3/projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}/"
    "adaptiveMtFiles/{file_id}/adaptiveMtSentences"
)
async def tr_adaptive_sentences_list_file(
    project_id: str,
    location_id: str,
    dataset_id: str,
    file_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_tr()
    parent = (
        f"projects/{project_id}/locations/{location_id}/adaptiveMtDatasets/{dataset_id}"
        f"/adaptiveMtFiles/{file_id}"
    )
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e("GET", f"{parent}/adaptiveMtSentences", params=params if params else None)
