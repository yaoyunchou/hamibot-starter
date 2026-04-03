"""
无障碍布局树：压缩、可交互元素提取、结构指纹、弹框候选。
输入为 dumpActiveWindowLayout 产出的 dict 树（或 JSON 反序列化结果）。
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any, Optional


DEFAULT_MAX_DEPTH = 8

_DIALOG_ID_PAT = re.compile(
    r"dialog|popup|mask|overlay|modal|float|sheet|guide|reward|ad[_-]?|coupon|notice",
    re.I,
)
_CLOSE_TEXT_PAT = re.compile(r"关闭|取消|跳过|不再|我知道了|X|×|✕|dismiss|close|cancel", re.I)
_CONFIRM_TEXT_PAT = re.compile(r"确定|确认|领取|立即|好的|同意|允许|开通", re.I)


def _bounds_area(b: list[int] | None) -> int:
    if not b or len(b) < 4:
        return 0
    l, t, r, bot = b[0], b[1], b[2], b[3]
    return max(0, r - l) * max(0, bot - t)


def _node_sig(n: dict[str, Any]) -> str:
    cls = str(n.get("cls") or "")
    eid = str(n.get("id") or "")
    return f"{cls}|{eid}"


def compute_fingerprint(tree: dict[str, Any] | None) -> str:
    """结构指纹：cls + id 骨架（忽略动态 text）。"""
    if not tree:
        return hashlib.sha256(b"").hexdigest()

    parts: list[str] = []

    def walk(node: dict[str, Any], depth: int) -> None:
        parts.append(_node_sig(node))
        ch = node.get("children")
        if isinstance(ch, list) and ch:
            for c in ch:
                if isinstance(c, dict):
                    walk(c, depth + 1)

    walk(tree, 0)
    raw = "|".join(parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _is_interactive(n: dict[str, Any]) -> bool:
    for k in ("clickable", "scrollable", "longClickable", "editable", "checkable"):
        v = n.get(k)
        if v is True:
            return True
    return False


def _heuristic_effect(
    n: dict[str, Any],
    bounds: list[int],
    screen_w: int,
    screen_h: int,
    in_popup_hint: bool,
) -> str:
    text = (n.get("text") or "") + " " + (n.get("desc") or "")
    text = text.strip()
    eid = str(n.get("id") or "")
    bottom_zone = bounds[3] > screen_h * 0.82 if len(bounds) >= 4 else False
    if bottom_zone and ("首页" in text or "消息" in text or "我的" in text or "发布" in text):
        return f"可能：底部 Tab 切换（{text[:20]}）"
    if _CLOSE_TEXT_PAT.search(text) or _CLOSE_TEXT_PAT.search(eid):
        return "可能：关闭弹窗/遮罩"
    if _CONFIRM_TEXT_PAT.search(text):
        return "可能：确认或领取类操作"
    if n.get("scrollable"):
        return "可能：滚动列表或内容区"
    if n.get("editable"):
        return "可能：输入文字"
    if in_popup_hint or _DIALOG_ID_PAT.search(eid):
        return "可能：与弹层/浮层交互"
    return "可能：点击触发界面变化"


def _compress_node(
    n: dict[str, Any],
    depth: int,
    max_depth: int,
) -> dict[str, Any] | None:
    if depth > max_depth:
        return None
    cls = n.get("cls") or ""
    text = (n.get("text") or "").strip() or None
    desc = (n.get("desc") or "").strip() or None
    eid = (n.get("id") or "").strip() or None
    bounds = n.get("bounds")
    children_in = n.get("children")
    kids: list[dict[str, Any]] = []
    if isinstance(children_in, list) and depth < max_depth:
        for c in children_in:
            if isinstance(c, dict):
                cc = _compress_node(c, depth + 1, max_depth)
                if cc is not None:
                    kids.append(cc)
    has_label = bool(text or desc or eid)
    if not has_label and not kids:
        return None
    out: dict[str, Any] = {"cls": cls}
    if text:
        out["text"] = text
    if desc:
        out["desc"] = desc
    if eid:
        out["id"] = eid
    if isinstance(bounds, list) and len(bounds) >= 4:
        out["bounds"] = [int(x) for x in bounds[:4]]
    for k in ("clickable", "scrollable", "longClickable", "editable", "checkable", "selected"):
        if n.get(k) is True:
            out[k] = True
    if kids:
        out["children"] = kids
    return out


def compress_tree(tree: dict[str, Any] | None, max_depth: int = DEFAULT_MAX_DEPTH) -> str:
    """压缩为缩进文本，供 LLM 阅读。"""
    if not tree:
        return ""

    slim = _compress_node(tree, 0, max_depth)
    if slim is None:
        return ""

    lines: list[str] = []

    def emit(node: dict[str, Any], indent: int) -> None:
        pad = "  " * indent
        cls = node.get("cls") or ""
        bits = [f"[{cls}]"]
        if node.get("id"):
            bits.append(f"#{node['id']}")
        if node.get("text"):
            bits.append(f'text="{node["text"][:80]}"')
        if node.get("desc"):
            bits.append(f'desc="{str(node["desc"])[:60]}"')
        b = node.get("bounds")
        if isinstance(b, list) and len(b) >= 4:
            bits.append(f"{b[0]},{b[1]},{b[2]},{b[3]}")
        flags = []
        for k in ("clickable", "scrollable", "editable", "selected"):
            if node.get(k):
                flags.append(k)
        if flags:
            bits.append(f"({','.join(flags)})")
        lines.append(pad + " ".join(bits))
        for ch in node.get("children") or []:
            emit(ch, indent + 1)

    emit(slim, 0)
    return "\n".join(lines)


@dataclass
class ActionableElement:
    ref: str
    action_type: str
    text: str
    desc: str
    element_id: str
    bounds: list[int]
    predicted_effect: str
    context: str = ""


def extract_actionable_elements(
    tree: dict[str, Any] | None,
    *,
    screen_bounds: Optional[list[int]] = None,
) -> list[ActionableElement]:
    """提取可交互元素，分配 C01、C02 … ref。"""
    if not tree:
        return []
    sw, sh = 1080, 2400
    if screen_bounds and len(screen_bounds) >= 4:
        sw = max(1, screen_bounds[2] - screen_bounds[0])
        sh = max(1, screen_bounds[3] - screen_bounds[1])

    root_b = tree.get("bounds")
    root_area = _bounds_area(root_b if isinstance(root_b, list) else None) or (sw * sh)

    popup_candidates: list[list[int]] = []

    def collect_popup_bounds(node: dict[str, Any]) -> None:
        b = node.get("bounds")
        eid = str(node.get("id") or "")
        if not isinstance(b, list) or len(b) < 4:
            ch = node.get("children")
            if isinstance(ch, list):
                for c in ch:
                    if isinstance(c, dict):
                        collect_popup_bounds(c)
            return
        area = _bounds_area(b)
        if area > root_area * 0.35 and (_DIALOG_ID_PAT.search(eid) or _DIALOG_ID_PAT.search(str(node.get("cls") or ""))):
            popup_candidates.append([int(x) for x in b[:4]])
        ch = node.get("children")
        if isinstance(ch, list):
            for c in ch:
                if isinstance(c, dict):
                    collect_popup_bounds(c)

    collect_popup_bounds(tree)

    def center_in_popup(bounds: list[int]) -> bool:
        if not popup_candidates or len(bounds) < 4:
            return False
        cx = (bounds[0] + bounds[2]) // 2
        cy = (bounds[1] + bounds[3]) // 2
        for pb in popup_candidates:
            if len(pb) >= 4 and pb[0] <= cx <= pb[2] and pb[1] <= cy <= pb[3]:
                return True
        return False

    found: list[ActionableElement] = []
    idx = 0

    def walk(node: dict[str, Any], parent_hint: str) -> None:
        nonlocal idx
        if not _is_interactive(node):
            ch = node.get("children")
            if isinstance(ch, list):
                for c in ch:
                    if isinstance(c, dict):
                        ph = parent_hint
                        t = node.get("text") or node.get("id")
                        if t:
                            ph = f"{parent_hint}/{t}" if parent_hint else str(t)
                        walk(c, ph)
            return
        idx += 1
        ref = f"C{idx:02d}"
        b = node.get("bounds")
        bounds = [int(x) for x in b[:4]] if isinstance(b, list) and len(b) >= 4 else [0, 0, 0, 0]
        if node.get("scrollable"):
            atype = "scroll"
        elif node.get("editable"):
            atype = "edit"
        elif node.get("longClickable"):
            atype = "long_click"
        elif node.get("checkable"):
            atype = "check"
        else:
            atype = "click"
        in_popup = center_in_popup(bounds)
        pred = _heuristic_effect(node, bounds, sw, sh, in_popup)
        txt = str(node.get("text") or "")
        dsc = str(node.get("desc") or "")
        eid = str(node.get("id") or "")
        ctx = parent_hint[:200] if parent_hint else ""
        found.append(
            ActionableElement(
                ref=ref,
                action_type=atype,
                text=txt,
                desc=dsc,
                element_id=eid,
                bounds=bounds,
                predicted_effect=pred,
                context=ctx,
            )
        )
        ch = node.get("children")
        if isinstance(ch, list):
            for c in ch:
                if isinstance(c, dict):
                    walk(c, parent_hint)

    walk(tree, "")
    return found


def actionable_elements_to_prompt_lines(elements: list[ActionableElement]) -> str:
    lines = [f"可交互元素（共 {len(elements)} 个）:"]
    for e in elements:
        b = ",".join(str(x) for x in e.bounds)
        lines.append(
            f"[{e.ref}] {e.action_type} | id={e.element_id[:40]} | text={e.text[:40]} | desc={e.desc[:40]} | bounds={b} | → {e.predicted_effect}"
        )
    return "\n".join(lines)


def analyze_layout_tree(tree: dict[str, Any] | None, *, max_depth: int = DEFAULT_MAX_DEPTH) -> dict[str, Any]:
    """一次调用返回压缩文本、元素列表、指纹。"""
    root_bounds = tree.get("bounds") if isinstance(tree, dict) else None
    els = extract_actionable_elements(tree, screen_bounds=root_bounds if isinstance(root_bounds, list) else None)
    return {
        "fingerprint": compute_fingerprint(tree),
        "compressed_text": compress_tree(tree, max_depth=max_depth),
        "actionable_elements": els,
        "actionable_lines": actionable_elements_to_prompt_lines(els),
    }


def tree_to_json_serializable_elements(elements: list[ActionableElement]) -> list[dict[str, Any]]:
    return [
        {
            "ref": e.ref,
            "action_type": e.action_type,
            "text": e.text,
            "desc": e.desc,
            "element_id": e.element_id,
            "bounds": e.bounds,
            "predicted_effect": e.predicted_effect,
            "context": e.context,
        }
        for e in elements
    ]


def elements_from_dicts(raw: list[dict[str, Any]] | None) -> list[ActionableElement]:
    if not raw:
        return []
    out: list[ActionableElement] = []
    for d in raw:
        out.append(
            ActionableElement(
                ref=str(d.get("ref") or ""),
                action_type=str(d.get("action_type") or "click"),
                text=str(d.get("text") or ""),
                desc=str(d.get("desc") or ""),
                element_id=str(d.get("element_id") or ""),
                bounds=list(d.get("bounds") or [0, 0, 0, 0]),
                predicted_effect=str(d.get("predicted_effect") or ""),
                context=str(d.get("context") or ""),
            )
        )
    return out
