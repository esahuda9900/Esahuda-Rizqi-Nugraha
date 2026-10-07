# Wear-component state machine

Unclassified → PolicyMatched | ReviewRequired  
ReviewRequired → PolicyMatched | RejectedNoCoverage (manual only)  
PolicyMatched → InWarranty | OutOfWarranty  
OutOfWarranty → MarketingEval → MarketingInWarranty | FinalOOW  

Illegal: ReviewRequired → InWarranty tanpa mapping manual.
