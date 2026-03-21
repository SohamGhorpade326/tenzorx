"""
All Ollama/Mistral prompts in one place.
Agents import from here — never hardcode prompts inside agent files.
"""

# ── PurchaseRequestAgent ──────────────────────────────────────────

PR_CLASSIFY_SYSTEM = (
    "You are an enterprise procurement classifier. "
    "Respond ONLY with valid JSON. No preamble, no explanation."
)

PR_CLASSIFY_PROMPT = """
Classify the following purchase category into one of the valid codes.

Category entered by user: "{raw_category}"

Valid category codes: {valid_codes}

Return ONLY this JSON:
{{
  "category_code": "<one of the valid codes above>",
  "confidence": "<high|medium|low>",
  "reason": "<one sentence>"
}}
"""

# ── VendorSelectionAgent ──────────────────────────────────────────

VENDOR_REASON_SYSTEM = (
    "You are an enterprise procurement analyst. "
    "Write a concise, professional 2-sentence explanation for a vendor selection decision. "
    "Be specific — include numbers."
)

VENDOR_REASON_PROMPT = """
Write a 2-sentence explanation for selecting this vendor for a procurement order.

Selected vendor  : {selected_vendor}
Unit price       : ₹{unit_price:,}
Lead time        : {lead_time} days
Quality rating   : {quality_rating}/5
Selection score  : {score}/100
Total candidates : {total_candidates}
Item being ordered: {item_name} (qty: {quantity})

Be concise and specific. Mention price and lead time in your explanation.
"""

# ── InvoiceMatchingAgent ──────────────────────────────────────────

INVOICE_DISPUTE_SYSTEM = (
    "You are an enterprise accounts payable specialist. "
    "Write a professional vendor dispute notice. Be firm but polite."
)

INVOICE_DISPUTE_PROMPT = """
Write a vendor dispute notice for the following invoice discrepancy.

Vendor name     : {vendor_name}
Invoice number  : {invoice_id}
PO number       : {po_id}
Discrepancy     : {discrepancy_details}
Variance amount : ₹{variance_amount:,.2f}

Write a 3-4 sentence professional email body requesting the vendor to issue a revised invoice.
Do not include subject line or greeting — just the body text.
"""