from enum import Enum


class PRStatus(str, Enum):
    VALIDATED   = "VALIDATED"
    INCOMPLETE  = "INCOMPLETE"
    DUPLICATE   = "DUPLICATE"
    PENDING_REVIEW = "PENDING_REVIEW"


class BudgetStatus(str, Enum):
    APPROVED  = "APPROVED"
    AT_RISK   = "AT_RISK"
    BLOCKED   = "BLOCKED"


class VendorStatus(str, Enum):
    SELECTED       = "SELECTED"
    NO_VENDOR      = "NO_VENDOR"
    SINGLE_SOURCE  = "SINGLE_SOURCE"


class POStatus(str, Enum):
    DRAFT    = "DRAFT"
    SENT     = "SENT"
    FAILED   = "FAILED"
    CANCELLED = "CANCELLED"


class GRMatchStatus(str, Enum):
    FULL     = "FULL"
    PARTIAL  = "PARTIAL"
    MISMATCH = "MISMATCH"


class InvoiceMatchResult(str, Enum):
    CLEAN   = "CLEAN"
    PARTIAL = "PARTIAL"
    FAILED  = "FAILED"


class PaymentStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    BLOCKED   = "BLOCKED"
    PAID      = "PAID"


class AuditStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    RETRY   = "RETRY"
    SKIPPED = "SKIPPED"
    INFO    = "INFO"


class ReviewStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED         = "APPROVED"
    REJECTED         = "REJECTED"


class RunStatus(str, Enum):
    RUNNING   = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED    = "FAILED"
    PARTIAL   = "PARTIAL"