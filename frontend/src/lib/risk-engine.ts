/**
 * Risk Assessment & Loan Offer Engine
 * Simple rule-based system for loan origination
 */

export interface LoanOffer {
  status: 'approved' | 'rejected' | 'pending';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  amount?: number;
  interestRate?: number;
  tenure?: number;
  emi?: number;
  reason?: string;
}

interface ExtractedData {
  income: number | null;
  hasExistingLoans: boolean;
  consentGiven: boolean;
  occupation: string;
  loanPurpose: string;
}

/**
 * Extract key financial data from transcripts
 */
export function extractFinancialData(transcripts: string[]): ExtractedData {
  // Ensure all items are strings and filter out undefined/null/empty
  const cleanTranscripts = (transcripts || [])
    .filter(t => t !== null && t !== undefined)
    .map(t => String(t).toLowerCase());
  
  const combinedText = cleanTranscripts.join(' ');
  
  // Income extraction - look for patterns like "50000", "fifty thousand", etc
  let income: number | null = null;
  const incomeMatch = combinedText.match(/(\d+)(?:\s*(?:thousand|lakh|rupee|rs))?/);
  if (incomeMatch) {
    let amount = parseInt(incomeMatch[1]);
    // If small number, likely thousands
    if (amount < 1000) amount *= 1000;
    income = amount;
  }
  
  // Existing loans check
  const hasExistingLoans = 
    combinedText.includes('yes') && combinedText.includes('loan') ||
    combinedText.includes('servicing') ||
    combinedText.includes('existing');
  
  // Loan purpose extraction
  const loanPurpose = 
    combinedText.includes('home') ? 'Home Loan' :
    combinedText.includes('car') || combinedText.includes('vehicle') ? 'Auto Loan' :
    combinedText.includes('business') ? 'Business Loan' :
    combinedText.includes('education') ? 'Education Loan' :
    combinedText.includes('personal') ? 'Personal Loan' :
    'General Purpose';

  // Occupation extraction (simplified)
  const occupation =
    combinedText.includes('engineer') ? 'Engineer' :
    combinedText.includes('doctor') ? 'Doctor' :
    combinedText.includes('teacher') ? 'Teacher' :
    combinedText.includes('business') ? 'Business Owner' :
    combinedText.includes('employment') || combinedText.includes('employee') ? 'Employed' :
    'Self-Employed';

  return {
    income,
    hasExistingLoans,
    consentGiven: false, // Set separately
    occupation,
    loanPurpose,
  };
}

/**
 * Validate consent from transcript and explicit checkbox
 * PRIORITY: If checkbox is checked, that's sufficient for consent
 * Don't depend 100% on Whisper transcription accuracy
 */
export function validateConsent(transcript: string, checkboxChecked: boolean): boolean {
  // Checkbox is primary signal - if checked, consent is valid
  if (checkboxChecked) {
    return true;
  }
  
  // Fallback: Check transcript for consent keywords
  const text = transcript.toLowerCase();
  const hasConfirm = text.includes('confirm') || text.includes('confirmed');
  const hasConsent = text.includes('consent') || text.includes('agree');
  const hasAccurate = text.includes('accurate') || text.includes('information');
  
  return hasConfirm || hasConsent || hasAccurate;
}

/**
 * Calculate risk level based on extracted data
 */
export function calculateRiskLevel(data: ExtractedData): 'LOW' | 'MEDIUM' | 'HIGH' {
  // No consent = automatic rejection
  if (!data.consentGiven) return 'HIGH';
  
  // Very low income = high risk
  if (!data.income || data.income < 20000) return 'HIGH';
  
  // Low income = medium risk
  if (data.income < 50000) return 'MEDIUM';
  
  // Existing loans = medium risk
  if (data.hasExistingLoans) return 'MEDIUM';
  
  return 'LOW';
}

/**
 * Generate loan offer based on risk level
 */
export function generateLoanOffer(
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
  consentGiven: boolean
): LoanOffer {
  // No consent = rejection
  if (!consentGiven) {
    return {
      status: 'rejected',
      riskLevel: 'HIGH',
      reason: 'Consent not provided for loan processing',
    };
  }

  // Risk-based offers
  if (riskLevel === 'LOW') {
    return {
      status: 'approved',
      riskLevel: 'LOW',
      amount: 500000,
      interestRate: 9.5,
      tenure: 60, // months
      emi: calculateEMI(500000, 9.5, 60),
      reason: 'Strong financial profile with low risk',
    };
  }

  if (riskLevel === 'MEDIUM') {
    return {
      status: 'approved',
      riskLevel: 'MEDIUM',
      amount: 250000,
      interestRate: 12.5,
      tenure: 48,
      emi: calculateEMI(250000, 12.5, 48),
      reason: 'Approved with standard terms',
    };
  }

  // HIGH RISK
  return {
    status: 'rejected',
    riskLevel: 'HIGH',
    reason: 'Application declined due to risk assessment',
  };
}

/**
 * Simple EMI calculation
 * Formula: EMI = [P × R × (1+R)^N] / [(1+R)^N - 1]
 * Simplified for demo: EMI ≈ (Amount + Interest) / Tenure
 */
function calculateEMI(principal: number, annualRate: number, months: number): number {
  const monthlyRate = annualRate / 12 / 100;
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, months);
  const denominator = Math.pow(1 + monthlyRate, months) - 1;
  return Math.round((principal * numerator) / denominator);
}

/**
 * Generate audit trail summary
 */
export function generateAuditTrail(data: {
  sessionId: string;
  timestamp: string;
  location?: { latitude: number; longitude: number };
  documentsUploaded: string[];
  consentStatus: boolean;
  riskLevel: string;
}): string {
  return JSON.stringify(data, null, 2);
}
