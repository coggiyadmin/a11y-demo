# Accessibility scanner comparison

Snapshot generated 2026-10-09 from the `smoke` suite (38 pages).

This is a corpus result, not a universal ranking. “Target detected” means the tool emitted an automated finding mapped to at least one expected WCAG criterion on a known-defect page. “Target clean” means it did not report a criterion declared clean by that corrected control; it does not prove conformance.

## Summary

| Tool | Known-defect pages with target detected | Corrected controls target-clean | Expected criteria matched | Run errors |
|---|---:|---:|---:|---:|
| axe-core 4.14.0 | 9/23 (39%) | 15/15 (100%) | 9/38 (24%) | 0 |
| Pa11y / HTML_CodeSniffer 10.0.0 | 6/23 (26%) | 15/15 (100%) | 6/38 (16%) | 0 |
| IBM Equal Access 4.0.34 | 10/23 (43%) | 15/15 (100%) | 10/38 (26%) | 0 |
| Lighthouse accessibility 13.5.0 | 9/23 (39%) | 15/15 (100%) | 9/38 (24%) | 0 |

Expected-criterion matching is conservative: it only credits findings whose tool metadata maps to a WCAG success criterion. A tool can flag a page while still receiving no criterion credit when its public result does not expose that mapping.

## What this snapshot shows

- The union of all four tools detected a target criterion on 12/23 known-defect pages (52%). 11 were missed by every tool in the default page-load configuration.
- The largest target-page count was 10/23, from IBM Equal Access.
- IBM Equal Access uniquely detected `keyboard-div_button`, `scenario-touch_targets`, `delivery-iframe_same_origin`.
- All tools left all 15 corrected controls clean for their declared criteria.
- Common misses: `static-anim_no_reduced_motion`, `static-field_no_visible_label`, `patterns-tabs`, `patterns-form-errors`, `color-status_color_only`, `color-placeholder_contrast`, `media-video_no_captions`, `state-invalid`, `scenario-meaningful_sequence`, `surface-email_contrast_darkmode`, `delivery-shadow_dom_closed`.

## Case matrix

Legend: `T` target criterion found, `o` automated finding outside this case’s declared criteria, `.` no automated finding, `E` scan error.

| Case | Expected | axe-core | Pa11y / HTML_CodeSniffer | IBM Equal Access | Lighthouse accessibility |
|---|---|---:|---:|---:|---:|
| `static-img_no_alt` | known defect | T | T | T | T |
| `static-safe_img` | corrected control | . | . | . | . |
| `static-viewport_no_zoom` | known defect | T | . | . | T |
| `static-safe_viewport` | corrected control | . | . | . | . |
| `static-anim_no_reduced_motion` | known defect | o | . | o | . |
| `static-safe_anim_reduced_motion` | corrected control | . | . | . | . |
| `static-field_no_visible_label` | known defect | . | o | . | . |
| `static-lang_missing` | known defect | T | T | T | T |
| `keyboard-div_button` | known defect | . | . | T | . |
| `keyboard-safe_native_button` | corrected control | . | . | . | . |
| `patterns-tabs` | known defect | o | . | o | o |
| `patterns-safe_tabs` | corrected control | . | . | . | . |
| `patterns-form-errors` | known defect | . | o | . | . |
| `patterns-safe_form-errors` | corrected control | . | . | . | . |
| `color-status_color_only` | known defect | . | . | . | . |
| `color-safe_status_color_only` | corrected control | . | . | . | . |
| `color-placeholder_contrast` | known defect | . | o | . | . |
| `color-safe_placeholder_contrast` | corrected control | . | . | . | . |
| `media-video_no_captions` | known defect | . | . | . | . |
| `media-safe_video_no_captions` | corrected control | . | . | . | . |
| `state-invalid` | known defect | . | o | . | . |
| `state-safe_invalid` | corrected control | . | . | . | . |
| `state-timed-out` | known defect | T | T | o | T |
| `state-safe_timed-out` | corrected control | . | o | . | . |
| `scenario-meaningful_sequence` | known defect | . | . | . | . |
| `scenario-safe_meaningful_sequence` | corrected control | . | . | . | . |
| `scenario-label_in_name` | known defect | T | . | T | T |
| `scenario-safe_label_in_name` | corrected control | . | . | . | . |
| `scenario-touch_targets` | known defect | . | o | T | . |
| `scenario-safe_touch_targets` | corrected control | . | o | . | . |
| `surface-email_contrast_darkmode` | known defect | . | . | . | . |
| `surface-safe_email_contrast_darkmode` | corrected control | . | . | . | . |
| `delivery-server_html` | known defect | T | T | T | T |
| `delivery-client_js` | known defect | T | T | T | T |
| `delivery-client_js_delayed` | known defect | T | T | T | T |
| `delivery-iframe_same_origin` | known defect | . | . | T | . |
| `delivery-shadow_dom_open` | known defect | T | . | T | T |
| `delivery-shadow_dom_closed` | known defect | . | . | . | . |

## Gaps visible in this snapshot

### axe-core

Known-defect pages with no target-criterion finding (14): `static-anim_no_reduced_motion`, `static-field_no_visible_label`, `keyboard-div_button`, `patterns-tabs`, `patterns-form-errors`, `color-status_color_only`, `color-placeholder_contrast`, `media-video_no_captions`, `state-invalid`, `scenario-meaningful_sequence`, `scenario-touch_targets`, `surface-email_contrast_darkmode`, `delivery-iframe_same_origin`, `delivery-shadow_dom_closed`.

Corrected controls with a declared-criterion finding (0): none.

### Pa11y / HTML_CodeSniffer

Known-defect pages with no target-criterion finding (17): `static-viewport_no_zoom`, `static-anim_no_reduced_motion`, `static-field_no_visible_label`, `keyboard-div_button`, `patterns-tabs`, `patterns-form-errors`, `color-status_color_only`, `color-placeholder_contrast`, `media-video_no_captions`, `state-invalid`, `scenario-meaningful_sequence`, `scenario-label_in_name`, `scenario-touch_targets`, `surface-email_contrast_darkmode`, `delivery-iframe_same_origin`, `delivery-shadow_dom_open`, `delivery-shadow_dom_closed`.

Corrected controls with a declared-criterion finding (0): none.

### IBM Equal Access

Known-defect pages with no target-criterion finding (13): `static-viewport_no_zoom`, `static-anim_no_reduced_motion`, `static-field_no_visible_label`, `patterns-tabs`, `patterns-form-errors`, `color-status_color_only`, `color-placeholder_contrast`, `media-video_no_captions`, `state-invalid`, `state-timed-out`, `scenario-meaningful_sequence`, `surface-email_contrast_darkmode`, `delivery-shadow_dom_closed`.

Corrected controls with a declared-criterion finding (0): none.

### Lighthouse accessibility

Known-defect pages with no target-criterion finding (14): `static-anim_no_reduced_motion`, `static-field_no_visible_label`, `keyboard-div_button`, `patterns-tabs`, `patterns-form-errors`, `color-status_color_only`, `color-placeholder_contrast`, `media-video_no_captions`, `state-invalid`, `scenario-meaningful_sequence`, `scenario-touch_targets`, `surface-email_contrast_darkmode`, `delivery-iframe_same_origin`, `delivery-shadow_dom_closed`.

Corrected controls with a declared-criterion finding (0): none.

## Interpretation limits

- The suite is intentionally representative, not the full corpus. Use `--suite all` for all definite broken and corrected browser fixtures.
- Target-page detection is coarser than criterion-level recall. The JSON result retains rule IDs, mapped criteria and per-page counts for deeper analysis.
- Dynamic states, complete journeys, display conditions, keyboard behavior, user tasks and assisted-technology behavior need drivers or people; a default page-load scan cannot settle them.
- Lighthouse uses axe-derived accessibility audits, so it is a product-level configuration comparison, not an independent rules engine.
- Durations are retained for diagnostics only and are not a performance ranking.

