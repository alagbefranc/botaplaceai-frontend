-- Insight Templates Seed Data
-- Run this after the migration to populate industry templates
-- Note: org_id is NULL for system templates

-- Healthcare templates
INSERT INTO insight_definitions (org_id, name, description, insight_type, schema, is_template, template_category) VALUES
(NULL, 'Patient Satisfaction', 'Extract patient satisfaction indicators and follow-up needs', 'structured', 
  '{"parameters": [
    {"name": "followup_needed", "type": "boolean", "description": "Does the patient need a follow-up appointment?", "required": true},
    {"name": "primary_concern", "type": "string", "description": "The main health concern discussed", "required": true},
    {"name": "satisfaction_level", "type": "number", "description": "Patient satisfaction 1-5 scale", "required": false},
    {"name": "symptoms_mentioned", "type": "array", "description": "List of symptoms the patient mentioned", "required": false}
  ]}', true, 'healthcare'),

(NULL, 'HIPAA Compliance Check', 'Detect potential PHI and compliance issues', 'structured',
  '{"parameters": [
    {"name": "contains_phi", "type": "boolean", "description": "Does the conversation contain Protected Health Information?", "required": true},
    {"name": "phi_types", "type": "array", "description": "Types of PHI detected (SSN, DOB, medical records, etc.)", "required": false},
    {"name": "compliance_concerns", "type": "array", "description": "Any compliance concerns identified", "required": false}
  ]}', true, 'healthcare');

-- Sales templates
INSERT INTO insight_definitions (org_id, name, description, insight_type, schema, is_template, template_category) VALUES
(NULL, 'Lead Qualification', 'Qualify leads with BANT criteria', 'structured',
  '{"parameters": [
    {"name": "qualification_score", "type": "number", "description": "Lead qualification score 1-100", "required": true},
    {"name": "budget_confirmed", "type": "boolean", "description": "Has budget been discussed or confirmed?", "required": true},
    {"name": "authority", "type": "boolean", "description": "Is this person a decision maker?", "required": true},
    {"name": "need_identified", "type": "string", "description": "The primary business need or pain point", "required": false},
    {"name": "timeline", "type": "string", "description": "Expected purchase timeline", "required": false, "enumValues": ["immediate", "this_quarter", "this_year", "exploring"]}
  ]}', true, 'sales'),

(NULL, 'Objection Handling', 'Track objections raised and how they were addressed', 'structured',
  '{"parameters": [
    {"name": "objections_raised", "type": "array", "description": "List of objections or concerns raised by the prospect", "required": true},
    {"name": "objections_resolved", "type": "array", "description": "Objections that were successfully addressed", "required": false},
    {"name": "resolution_status", "type": "string", "description": "Overall status of objection handling", "required": true, "enumValues": ["all_resolved", "partially_resolved", "unresolved", "no_objections"]},
    {"name": "next_steps", "type": "array", "description": "Agreed next steps or follow-up items", "required": false}
  ]}', true, 'sales');

-- Support templates
INSERT INTO insight_definitions (org_id, name, description, insight_type, schema, is_template, template_category) VALUES
(NULL, 'Ticket Classification', 'Classify support tickets by category and priority', 'structured',
  '{"parameters": [
    {"name": "category", "type": "string", "description": "Ticket category", "required": true, "enumValues": ["billing", "technical", "account", "feature_request", "bug_report", "general_inquiry"]},
    {"name": "priority", "type": "string", "description": "Ticket priority level", "required": true, "enumValues": ["critical", "high", "medium", "low"]},
    {"name": "product_area", "type": "string", "description": "Which product or feature area is affected", "required": false},
    {"name": "requires_escalation", "type": "boolean", "description": "Does this need to be escalated?", "required": true}
  ]}', true, 'support'),

(NULL, 'CSAT Survey', 'Extract customer satisfaction survey data', 'structured',
  '{"parameters": [
    {"name": "rating", "type": "number", "description": "Customer satisfaction rating 1-5", "required": true},
    {"name": "feedback", "type": "string", "description": "Customer feedback or comments", "required": false},
    {"name": "would_recommend", "type": "boolean", "description": "Would the customer recommend the service?", "required": false},
    {"name": "improvement_suggestions", "type": "array", "description": "Suggestions for improvement", "required": false}
  ]}', true, 'support');

-- E-commerce templates
INSERT INTO insight_definitions (org_id, name, description, insight_type, schema, is_template, template_category) VALUES
(NULL, 'Purchase Intent', 'Detect purchase intent and product interests', 'structured',
  '{"parameters": [
    {"name": "has_purchase_intent", "type": "boolean", "description": "Does the user show intent to purchase?", "required": true},
    {"name": "products_mentioned", "type": "array", "description": "Products or categories the user is interested in", "required": false},
    {"name": "price_sensitivity", "type": "string", "description": "How price-sensitive is the customer?", "required": false, "enumValues": ["very_sensitive", "moderate", "not_sensitive", "unknown"]},
    {"name": "barriers_to_purchase", "type": "array", "description": "What is preventing them from buying?", "required": false}
  ]}', true, 'ecommerce');

-- HR/Recruiting templates
INSERT INTO insight_definitions (org_id, name, description, insight_type, schema, is_template, template_category) VALUES
(NULL, 'Candidate Screening', 'Screen job candidates for qualifications', 'structured',
  '{"parameters": [
    {"name": "qualified", "type": "boolean", "description": "Does the candidate meet basic qualifications?", "required": true},
    {"name": "years_experience", "type": "number", "description": "Years of relevant experience", "required": false},
    {"name": "skills_matched", "type": "array", "description": "Required skills the candidate possesses", "required": false},
    {"name": "skills_missing", "type": "array", "description": "Required skills the candidate lacks", "required": false},
    {"name": "culture_fit_notes", "type": "string", "description": "Notes on potential culture fit", "required": false},
    {"name": "recommendation", "type": "string", "description": "Hiring recommendation", "required": true, "enumValues": ["strong_yes", "yes", "maybe", "no", "strong_no"]}
  ]}', true, 'hr');
