"""
Google Chat API v1 proxy — service account (+ optional impersonation), Supabase JWT + admin plan.

https://developers.google.com/workspace/chat

Query/body fields use snake_case in FastAPI where aliased; forwarded to Google as camelCase.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from app.dependencies import require_admin_plan
from app.google_chat_v1 import (
    chat_configured,
    chat_request,
    chat_request_bytes,
    chat_upload_attachment,
)

router = APIRouter(prefix="/google/chat", tags=["google-chat"])


def _require_chat() -> None:
    if not chat_configured():
        raise HTTPException(
            status_code=503,
            detail="Google Chat not configured (GOOGLE_CHAT_SA_JSON_PATH).",
        )


async def _e(method: str, path: str, **kwargs: Any) -> Any:
    try:
        return await chat_request(method, path, **kwargs)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- media ---


@router.get("/v1/media/{resource_path:path}")
async def chat_media_download(
    resource_path: str,
    alt: str | None = Query(None),
    fields: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    params: dict[str, Any] = {}
    if alt is not None:
        params["alt"] = alt
    if fields:
        params["fields"] = fields
    try:
        body, ct = await chat_request_bytes("GET", f"media/{resource_path}", params=params or None)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return Response(content=body, media_type=ct or "application/octet-stream")


@router.post("/v1/spaces/{space_id}/attachments:upload")
async def chat_media_upload(
    space_id: str,
    filename: str = Query(..., description="Attachment filename including extension"),
    file: UploadFile = File(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    content = await file.read()
    ct = file.content_type or "application/octet-stream"
    try:
        return await chat_upload_attachment(
            f"spaces/{space_id}",
            filename=filename,
            file_bytes=content,
            content_type=ct,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- spaces (literals before /{space_id}) ---


@router.get("/v1/spaces")
async def chat_spaces_list(
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    return await _e("GET", "spaces", params=params if params else None)


@router.get("/v1/spaces:search")
async def chat_spaces_search(
    query: str = Query(...),
    use_admin_access: bool | None = Query(None, alias="useAdminAccess"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    order_by: str | None = Query(None, alias="orderBy"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    params: dict[str, Any] = {"query": query}
    if use_admin_access is not None:
        params["useAdminAccess"] = use_admin_access
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if order_by:
        params["orderBy"] = order_by
    return await _e("GET", "spaces:search", params=params)


@router.post("/v1/spaces")
async def chat_spaces_create(
    body: dict[str, Any] = Body(...),
    request_id: str | None = Query(None, alias="requestId"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    params = {"requestId": request_id} if request_id else None
    return await _e("POST", "spaces", params=params, json_body=body)


@router.post("/v1/spaces:setup")
async def chat_spaces_setup(
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    return await _e("POST", "spaces:setup", json_body=body)


@router.get("/v1/spaces:findDirectMessage")
async def chat_spaces_find_direct_message(
    name: str = Query(..., description="users/{user}"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    return await _e("GET", "spaces:findDirectMessage", params={"name": name})


@router.get("/v1/spaces/{space_id}")
async def chat_spaces_get(
    space_id: str,
    use_admin_access: bool | None = Query(None, alias="useAdminAccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}"
    params = {"useAdminAccess": use_admin_access} if use_admin_access is not None else None
    return await _e("GET", n, params=params)


@router.patch("/v1/spaces/{space_id}")
async def chat_spaces_patch(
    space_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str = Query(..., alias="updateMask"),
    use_admin_access: bool | None = Query(None, alias="useAdminAccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}"
    params: dict[str, Any] = {"updateMask": update_mask}
    if use_admin_access is not None:
        params["useAdminAccess"] = use_admin_access
    return await _e("PATCH", n, params=params, json_body=body)


@router.delete("/v1/spaces/{space_id}")
async def chat_spaces_delete(
    space_id: str,
    use_admin_access: bool | None = Query(None, alias="useAdminAccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}"
    params = {"useAdminAccess": use_admin_access} if use_admin_access is not None else None
    return await _e("DELETE", n, params=params)


@router.post("/v1/spaces/{space_id}:completeImport")
async def chat_spaces_complete_import(
    space_id: str,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    return await _e("POST", f"spaces/{space_id}:completeImport", json_body=body)


# --- spaces.messages ---


@router.post("/v1/spaces/{space_id}/messages")
async def chat_messages_create(
    space_id: str,
    body: dict[str, Any] = Body(...),
    thread_key: str | None = Query(None, alias="threadKey"),
    request_id: str | None = Query(None, alias="requestId"),
    message_reply_option: str | None = Query(None, alias="messageReplyOption"),
    message_id: str | None = Query(None, alias="messageId"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    parent = f"spaces/{space_id}"
    params: dict[str, Any] = {}
    if thread_key:
        params["threadKey"] = thread_key
    if request_id:
        params["requestId"] = request_id
    if message_reply_option:
        params["messageReplyOption"] = message_reply_option
    if message_id:
        params["messageId"] = message_id
    return await _e("POST", f"{parent}/messages", params=params or None, json_body=body)


@router.get("/v1/spaces/{space_id}/messages")
async def chat_messages_list(
    space_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    order_by: str | None = Query(None, alias="orderBy"),
    show_deleted: bool | None = Query(None, alias="showDeleted"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    parent = f"spaces/{space_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    if order_by:
        params["orderBy"] = order_by
    if show_deleted is not None:
        params["showDeleted"] = show_deleted
    return await _e("GET", f"{parent}/messages", params=params or None)


@router.get("/v1/spaces/{space_id}/messages/{message_id}")
async def chat_messages_get(space_id: str, message_id: str, _admin: str = Depends(require_admin_plan)):
    _require_chat()
    return await _e("GET", f"spaces/{space_id}/messages/{message_id}")


@router.put("/v1/spaces/{space_id}/messages/{message_id}")
async def chat_messages_update(
    space_id: str,
    message_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str = Query(..., alias="updateMask"),
    allow_missing: bool | None = Query(None, alias="allowMissing"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}/messages/{message_id}"
    params: dict[str, Any] = {"updateMask": update_mask}
    if allow_missing is not None:
        params["allowMissing"] = allow_missing
    return await _e("PUT", n, params=params, json_body=body)


@router.patch("/v1/spaces/{space_id}/messages/{message_id}")
async def chat_messages_patch(
    space_id: str,
    message_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str = Query(..., alias="updateMask"),
    allow_missing: bool | None = Query(None, alias="allowMissing"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}/messages/{message_id}"
    params: dict[str, Any] = {"updateMask": update_mask}
    if allow_missing is not None:
        params["allowMissing"] = allow_missing
    return await _e("PATCH", n, params=params, json_body=body)


@router.delete("/v1/spaces/{space_id}/messages/{message_id}")
async def chat_messages_delete(
    space_id: str,
    message_id: str,
    force: bool | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}/messages/{message_id}"
    params = {"force": force} if force is not None else None
    return await _e("DELETE", n, params=params)


# --- spaces.messages.attachments ---


@router.get("/v1/spaces/{space_id}/messages/{message_id}/attachments/{attachment_id}")
async def chat_attachments_get(
    space_id: str,
    message_id: str,
    attachment_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}/messages/{message_id}/attachments/{attachment_id}"
    return await _e("GET", n)


# --- spaces.messages.reactions ---


@router.post("/v1/spaces/{space_id}/messages/{message_id}/reactions")
async def chat_reactions_create(
    space_id: str,
    message_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    parent = f"spaces/{space_id}/messages/{message_id}"
    return await _e("POST", f"{parent}/reactions", json_body=body)


@router.get("/v1/spaces/{space_id}/messages/{message_id}/reactions")
async def chat_reactions_list(
    space_id: str,
    message_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    parent = f"spaces/{space_id}/messages/{message_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    return await _e("GET", f"{parent}/reactions", params=params or None)


@router.delete("/v1/spaces/{space_id}/messages/{message_id}/reactions/{reaction_id}")
async def chat_reactions_delete(
    space_id: str,
    message_id: str,
    reaction_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}/messages/{message_id}/reactions/{reaction_id}"
    return await _e("DELETE", n)


# --- spaces.members ---


@router.get("/v1/spaces/{space_id}/members")
async def chat_members_list(
    space_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    show_groups: bool | None = Query(None, alias="showGroups"),
    show_invited: bool | None = Query(None, alias="showInvited"),
    use_admin_access: bool | None = Query(None, alias="useAdminAccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    parent = f"spaces/{space_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    if show_groups is not None:
        params["showGroups"] = show_groups
    if show_invited is not None:
        params["showInvited"] = show_invited
    if use_admin_access is not None:
        params["useAdminAccess"] = use_admin_access
    return await _e("GET", f"{parent}/members", params=params or None)


@router.get("/v1/spaces/{space_id}/members/{member_id:path}")
async def chat_members_get(
    space_id: str,
    member_id: str,
    use_admin_access: bool | None = Query(None, alias="useAdminAccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}/members/{member_id}"
    params = {"useAdminAccess": use_admin_access} if use_admin_access is not None else None
    return await _e("GET", n, params=params)


@router.post("/v1/spaces/{space_id}/members")
async def chat_members_create(
    space_id: str,
    body: dict[str, Any] = Body(...),
    use_admin_access: bool | None = Query(None, alias="useAdminAccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    parent = f"spaces/{space_id}"
    params = {"useAdminAccess": use_admin_access} if use_admin_access is not None else None
    return await _e("POST", f"{parent}/members", params=params, json_body=body)


@router.patch("/v1/spaces/{space_id}/members/{member_id:path}")
async def chat_members_patch(
    space_id: str,
    member_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str = Query(..., alias="updateMask"),
    use_admin_access: bool | None = Query(None, alias="useAdminAccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}/members/{member_id}"
    params: dict[str, Any] = {"updateMask": update_mask}
    if use_admin_access is not None:
        params["useAdminAccess"] = use_admin_access
    return await _e("PATCH", n, params=params, json_body=body)


@router.delete("/v1/spaces/{space_id}/members/{member_id:path}")
async def chat_members_delete(
    space_id: str,
    member_id: str,
    use_admin_access: bool | None = Query(None, alias="useAdminAccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"spaces/{space_id}/members/{member_id}"
    params = {"useAdminAccess": use_admin_access} if use_admin_access is not None else None
    return await _e("DELETE", n, params=params)


# --- spaces.spaceEvents ---


@router.get("/v1/spaces/{space_id}/spaceEvents")
async def chat_space_events_list(
    space_id: str,
    filter_: str = Query(..., alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    parent = f"spaces/{space_id}"
    params: dict[str, Any] = {"filter": filter_}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e("GET", f"{parent}/spaceEvents", params=params)


@router.get("/v1/spaces/{space_id}/spaceEvents/{event_id}")
async def chat_space_events_get(space_id: str, event_id: str, _admin: str = Depends(require_admin_plan)):
    _require_chat()
    return await _e("GET", f"spaces/{space_id}/spaceEvents/{event_id}")


# --- customEmojis ---


@router.post("/v1/customEmojis")
async def chat_custom_emojis_create(body: dict[str, Any] = Body(...), _admin: str = Depends(require_admin_plan)):
    _require_chat()
    return await _e("POST", "customEmojis", json_body=body)


@router.get("/v1/customEmojis")
async def chat_custom_emojis_list(
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    return await _e("GET", "customEmojis", params=params or None)


@router.get("/v1/customEmojis/{emoji_id:path}")
async def chat_custom_emojis_get(emoji_id: str, _admin: str = Depends(require_admin_plan)):
    _require_chat()
    return await _e("GET", f"customEmojis/{emoji_id}")


@router.delete("/v1/customEmojis/{emoji_id:path}")
async def chat_custom_emojis_delete(emoji_id: str, _admin: str = Depends(require_admin_plan)):
    _require_chat()
    return await _e("DELETE", f"customEmojis/{emoji_id}")


# --- users.spaces (read state, notification) ---


@router.get("/v1/users/{user_id}/spaces/{space_id}/spaceReadState")
async def chat_users_spaces_get_space_read_state(
    user_id: str,
    space_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"users/{user_id}/spaces/{space_id}/spaceReadState"
    return await _e("GET", n)


@router.patch("/v1/users/{user_id}/spaces/{space_id}/spaceReadState")
async def chat_users_spaces_update_space_read_state(
    user_id: str,
    space_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str = Query(..., alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"users/{user_id}/spaces/{space_id}/spaceReadState"
    return await _e("PATCH", n, params={"updateMask": update_mask}, json_body=body)


@router.get("/v1/users/{user_id}/spaces/{space_id}/threads/{thread_id}/threadReadState")
async def chat_users_threads_get_thread_read_state(
    user_id: str,
    space_id: str,
    thread_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"users/{user_id}/spaces/{space_id}/threads/{thread_id}/threadReadState"
    return await _e("GET", n)


@router.get("/v1/users/{user_id}/spaces/{space_id}/spaceNotificationSetting")
async def chat_space_notification_get(
    user_id: str,
    space_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"users/{user_id}/spaces/{space_id}/spaceNotificationSetting"
    return await _e("GET", n)


@router.patch("/v1/users/{user_id}/spaces/{space_id}/spaceNotificationSetting")
async def chat_space_notification_patch(
    user_id: str,
    space_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str = Query(..., alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_chat()
    n = f"users/{user_id}/spaces/{space_id}/spaceNotificationSetting"
    return await _e("PATCH", n, params={"updateMask": update_mask}, json_body=body)
