#!/usr/bin/env python3
"""
Native OpenCV ile gelişmiş OMR okuma
Server-side processing - yüksek doğruluk + hız
"""
import sys
import json
import base64
import numpy as np
import cv2
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict


@dataclass
class BubbleRegion:
    question: int
    label: str
    x: float
    y: float
    r: float


@dataclass
class IdDigitBubble:
    digit_index: int
    value: int
    label: str
    x: float
    y: float
    r: float


@dataclass
class AnchorRegion:
    x: float
    y: float
    size: float


@dataclass
class OmrLayout:
    bubbles: List[BubbleRegion]
    anchors: List[AnchorRegion]
    question_count: int
    width: float
    height: float


@dataclass
class OmrResult:
    answers: Dict[int, str]
    confidence: float
    needs_rescan: bool
    anchor_score: float
    per_question: List[Dict[str, Any]]
    warp_engine: str
    processing_time_ms: float
    student_code: Optional[str] = None
    student_code_confidence: float = 0.0


def decode_base64_image(b64_data: str) -> np.ndarray:
    """Base64 -> numpy array (BGR)"""
    if b64_data.startswith('data:'):
        b64_data = b64_data.split(',', 1)[1]
    
    img_bytes = base64.b64decode(b64_data)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    
    if img is None:
        raise ValueError("Görüntü decode edilemedi")
    
    return img


def enhance_image_quality(gray: np.ndarray) -> np.ndarray:
    """Gelişmiş preprocessing - denoise + CLAHE + sharpening"""
    denoised = cv2.bilateralFilter(gray, d=5, sigmaColor=50, sigmaSpace=50)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    opened = cv2.morphologyEx(enhanced, cv2.MORPH_OPEN, kernel)
    gaussian = cv2.GaussianBlur(opened, (0, 0), 2.0)
    sharpened = cv2.addWeighted(opened, 1.5, gaussian, -0.5, 0)
    return sharpened


def detect_omr_quad_advanced(
    gray: np.ndarray, 
    anchors: List[AnchorRegion],
    page_w: float,
    page_h: float
) -> Optional[np.ndarray]:
    """4 köşe tespit - multi-threshold + morphology + advanced scoring"""
    h, w = gray.shape
    detected_anchors = []
    
    for anchor in anchors[:4]:
        exp_x = int(anchor.x * w)
        exp_y = int(anchor.y * h)
        
        roi_r = int(min(w, h) * 0.15)
        x0 = max(0, exp_x - roi_r)
        y0 = max(0, exp_y - roi_r)
        x1 = min(w, exp_x + roi_r)
        y1 = min(h, exp_y + roi_r)
        
        roi = gray[y0:y1, x0:x1]
        if roi.size == 0:
            continue
        
        blurred = cv2.GaussianBlur(roi, (7, 7), 0)
        _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        adaptive = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 17, 8
        )
        combined = cv2.bitwise_and(otsu, adaptive)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            continue
        
        best_score = 0
        best_center = None
        min_area = (roi.shape[0] * roi.shape[1]) * 0.002
        max_area = (roi.shape[0] * roi.shape[1]) * 0.45
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area:
                continue
            
            x_c, y_c, w_c, h_c = cv2.boundingRect(cnt)
            aspect_ratio = w_c / max(1, h_c)
            if aspect_ratio < 0.35 or aspect_ratio > 2.8:
                continue
            
            M = cv2.moments(cnt)
            if M['m00'] < 1:
                continue
            
            cx = M['m10'] / M['m00']
            cy = M['m01'] / M['m00']
            center_x = roi.shape[1] / 2
            center_y = roi.shape[0] / 2
            dist = np.hypot(cx - center_x, cy - center_y)
            perimeter = cv2.arcLength(cnt, True)
            if perimeter > 0:
                compactness = 4 * np.pi * area / (perimeter ** 2)
            else:
                compactness = 0
            
            shape_score = min(1.0, compactness * 1.2)
            dist_score = np.exp(-dist / roi_r)
            score = area * shape_score * dist_score
            
            if score > best_score:
                best_score = score
                best_center = (x0 + cx, y0 + cy)
        
        if best_center:
            detected_anchors.append(best_center)
    
    if len(detected_anchors) < 4:
        return None
    
    points = np.array(detected_anchors[:4], dtype=np.float32)
    center = points.mean(axis=0)
    
    def angle_from_center(pt):
        return np.arctan2(pt[1] - center[1], pt[0] - center[0])
    
    sorted_points = sorted(points, key=angle_from_center)
    quad = np.array(sorted_points, dtype=np.float32)
    
    return quad


def warp_perspective_omr(
    img: np.ndarray,
    quad: np.ndarray,
    out_w: int,
    out_h: int
) -> np.ndarray:
    """Perspektif düzeltme"""
    dst_points = np.array([
        [0, 0],
        [out_w - 1, 0],
        [out_w - 1, out_h - 1],
        [0, out_h - 1]
    ], dtype=np.float32)
    
    M = cv2.getPerspectiveTransform(quad, dst_points)
    warped = cv2.warpPerspective(
        img, M, (out_w, out_h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=255
    )
    
    return warped


def sample_bubble_advanced(
    gray: np.ndarray,
    w: int,
    h: int,
    cx: int,
    cy: int,
    r_px: int
) -> float:
    """3-ring sampling + kontrast normalize"""
    inner_r = r_px * 0.36
    mid_r1 = r_px * 0.56
    mid_r2 = r_px * 0.80
    outer_r1 = r_px * 0.88
    outer_r2 = r_px * 1.15
    
    inner_vals = []
    mid_vals = []
    outer_vals = []
    
    step = max(1, r_px // 7)
    
    for dy in range(-int(r_px * 1.2), int(r_px * 1.2) + 1, step):
        for dx in range(-int(r_px * 1.2), int(r_px * 1.2) + 1, step):
            dist = np.hypot(dx, dy)
            x = cx + dx
            y = cy + dy
            
            if x < 0 or y < 0 or x >= w or y >= h:
                continue
            
            val = gray[y, x]
            
            if dist <= inner_r:
                inner_vals.append(255 - val)
            elif mid_r1 <= dist <= mid_r2:
                mid_vals.append(255 - val)
            elif outer_r1 <= dist <= outer_r2:
                outer_vals.append(val)
    
    if not inner_vals:
        return 0.0
    
    inner = np.mean(inner_vals) / 255.0
    mid = np.mean(mid_vals) / 255.0 if mid_vals else inner * 0.5
    paper = np.mean(outer_vals) / 255.0 if outer_vals else 0.92
    
    mark = max(inner, mid * 0.88)
    contrast = paper - (1.0 - mark)
    contrast_boost = 0.65 + min(0.35, contrast * 0.6)
    paper_penalty = 1.0 if paper > 0.85 else max(0.7, paper / 0.85)
    
    final_mark = max(0.0, mark - (1.0 - paper) * 0.25) * contrast_boost * paper_penalty
    
    return final_mark


def decode_student_id_digits(
    enhanced: np.ndarray,
    decode_w: int,
    decode_h: int,
    id_bubbles: List[IdDigitBubble],
    decode_params: Dict[str, float],
) -> Tuple[str, float]:
    """5 haneli öğrenci no. (H1–H5)"""
    if not id_bubbles:
        return "", 0.0

    per_digit: Dict[int, List[Dict[str, Any]]] = {}
    for b in id_bubbles:
        if b.digit_index not in per_digit:
            per_digit[b.digit_index] = []
        cx = int(b.x * decode_w)
        cy = int(b.y * decode_h)
        r_px = max(6, int(b.r * decode_w * 1.1))
        mark = sample_bubble_advanced(enhanced, decode_w, decode_h, cx, cy, r_px)
        per_digit[b.digit_index].append({"value": b.value, "mark": mark, "label": b.label})

    blank_min = decode_params["blank_min"]
    margin_min = decode_params["margin_min"]
    ratio_min = decode_params["ratio_min"]

    digits: List[str] = []
    ok_count = 0
    for idx in sorted(per_digit.keys()):
        marks = per_digit[idx]
        if not marks:
            digits.append("")
            continue
        mark_vals = [m["mark"] for m in marks]
        min_m = min(mark_vals)
        max_m = max(mark_vals)
        span = max_m - min_m
        normalized = [(m["mark"] - min_m) / span for m in marks] if span > 0.02 else mark_vals
        sorted_i = sorted(range(len(normalized)), key=lambda i: normalized[i], reverse=True)
        best_i = sorted_i[0]
        second_i = sorted_i[1] if len(sorted_i) > 1 else None
        best_m = normalized[best_i]
        second_m = normalized[second_i] if second_i is not None else 0.0
        margin = best_m - second_m
        ratio = best_m / max(0.03, second_m)
        ambiguous = best_m < blank_min or margin < margin_min or ratio < ratio_min
        if ambiguous:
            digits.append("")
        else:
            digits.append(marks[best_i]["label"])
            ok_count += 1

    code = "".join(digits)
    conf = ok_count / max(1, len(per_digit))
    return code, conf


def _params_dict(raw: Optional[Dict[str, Any]]) -> Dict[str, float]:
    d = raw or {}
    return {
        "blank_min": float(d.get("blank_min", 0.35)),
        "margin_min": float(d.get("margin_min", 0.22)),
        "ratio_min": float(d.get("ratio_min", 2.0)),
        "needs_rescan_confidence": float(d.get("needs_rescan_confidence", 0.75)),
        "needs_rescan_anchor": float(d.get("needs_rescan_anchor", 0.8)),
    }


def decode_omr_advanced(
    img: np.ndarray,
    layout: OmrLayout,
    max_question: Optional[int] = None,
    decode_params: Optional[Dict[str, Any]] = None,
    id_digit_bubbles: Optional[List[IdDigitBubble]] = None,
) -> OmrResult:
    """Native OpenCV ile tam OMR decode"""
    import time
    start_time = time.time()
    p = _params_dict(decode_params)
    
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()
    
    h_orig, w_orig = gray.shape
    
    quad = detect_omr_quad_advanced(gray, layout.anchors, layout.width, layout.height)
    
    warp_engine = "opencv_native"
    anchor_score = 1.0 if quad is not None else 0.0
    
    decode_w = 1200
    decode_h = int(decode_w * (layout.height / layout.width))
    
    if quad is not None:
        warped_gray = warp_perspective_omr(gray, quad, decode_w, decode_h)
    else:
        warped_gray = cv2.resize(gray, (decode_w, decode_h), interpolation=cv2.INTER_LINEAR)
        warp_engine = "fallback_resize"
    
    enhanced = enhance_image_quality(warped_gray)
    
    max_q = max_question or layout.question_count
    bubbles = [b for b in layout.bubbles if b.question <= max_q]
    
    per_question: Dict[int, List[Dict[str, Any]]] = {}
    
    for bubble in bubbles:
        q = bubble.question
        if q not in per_question:
            per_question[q] = []
        
        cx = int(bubble.x * decode_w)
        cy = int(bubble.y * decode_h)
        r_px = max(8, int(bubble.r * decode_w * 1.18))
        
        mark = sample_bubble_advanced(enhanced, decode_w, decode_h, cx, cy, r_px)
        
        per_question[q].append({
            'label': bubble.label,
            'mark': mark,
            'question': q
        })
    
    answers = {}
    per_q_results = []
    
    for q in sorted(per_question.keys()):
        marks = per_question[q]
        
        if not marks:
            continue
        
        mark_vals = [m['mark'] for m in marks]
        min_mark = min(mark_vals)
        max_mark = max(mark_vals)
        span = max_mark - min_mark
        
        if span > 0.02:
            normalized = [(m['mark'] - min_mark) / span for m in marks]
        else:
            normalized = mark_vals
        
        sorted_indices = sorted(range(len(normalized)), key=lambda i: normalized[i], reverse=True)
        best_idx = sorted_indices[0]
        second_idx = sorted_indices[1] if len(sorted_indices) > 1 else None
        
        best_mark = normalized[best_idx]
        second_mark = normalized[second_idx] if second_idx is not None else 0.0
        
        margin = best_mark - second_mark
        ratio = best_mark / max(0.03, second_mark)
        
        blank_min = p["blank_min"]
        margin_min = p["margin_min"]
        ratio_min = p["ratio_min"]
        
        row_max = max_mark
        row_quiet = row_max < 0.12
        
        double_mark = (second_mark >= blank_min * 0.80 and 
                      margin < margin_min * 1.3 and 
                      ratio < ratio_min * 1.05)
        
        ambiguous = (row_quiet or 
                    best_mark < blank_min or 
                    margin < margin_min or 
                    ratio < ratio_min or 
                    double_mark)
        
        best_label = marks[best_idx]['label']
        
        if not ambiguous:
            answers[q] = best_label
        
        per_q_results.append({
            'question': q,
            'label': best_label if not ambiguous else '',
            'fill': float(best_mark),
            'ambiguous': ambiguous
        })
    
    valid_answers = len([r for r in per_q_results if not r['ambiguous']])
    total_questions = len(per_q_results)
    confidence = valid_answers / max(1, total_questions)
    
    needs_rescan = (
        confidence < p["needs_rescan_confidence"]
        or anchor_score < p["needs_rescan_anchor"]
    )
    
    student_code = ""
    student_code_confidence = 0.0
    if id_digit_bubbles:
        student_code, student_code_confidence = decode_student_id_digits(
            enhanced, decode_w, decode_h, id_digit_bubbles, p
        )

    processing_time = (time.time() - start_time) * 1000
    
    return OmrResult(
        answers=answers,
        confidence=confidence,
        needs_rescan=needs_rescan,
        anchor_score=anchor_score,
        per_question=per_q_results,
        warp_engine=warp_engine,
        processing_time_ms=processing_time,
        student_code=student_code or None,
        student_code_confidence=student_code_confidence,
    )


def main():
    """CLI interface - JSON stdin/stdout"""
    try:
        input_data = json.load(sys.stdin)
        
        layout_data = input_data['layout']
        bubbles = [BubbleRegion(**b) for b in layout_data['bubbles']]
        anchors = [AnchorRegion(**a) for a in layout_data['anchors']]
        
        layout = OmrLayout(
            bubbles=bubbles,
            anchors=anchors,
            question_count=layout_data['question_count'],
            width=layout_data['width'],
            height=layout_data['height']
        )
        
        img = decode_base64_image(input_data['image'])
        max_question = input_data.get('maxQuestion')
        
        decode_params = layout_data.get("decode_params")
        id_raw = layout_data.get("id_digit_bubbles") or []
        id_bubbles = [
            IdDigitBubble(
                digit_index=int(b["digit_index"]),
                value=int(b["value"]),
                label=str(b.get("label", b["value"])),
                x=float(b["x"]),
                y=float(b["y"]),
                r=float(b["r"]),
            )
            for b in id_raw
        ]
        result = decode_omr_advanced(img, layout, max_question, decode_params, id_bubbles)
        
        output = {
            'success': True,
            'result': asdict(result)
        }
        print(json.dumps(output))
        
    except Exception as e:
        error_output = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_output))
        sys.exit(1)


if __name__ == '__main__':
    main()
