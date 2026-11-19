#!/usr/bin/env python3
"""Grammar-check draft Supabase migrations. This does NOT migrate a database."""
from pathlib import Path
from pglast import parse_sql
root = Path(__file__).resolve().parent.parent
for filename in (
    "supabase/migrations/09_lockdown_public_visit_access.sql",
    "supabase/migrations/10_client_guardian_preregistration.sql",
    "supabase/migrations/11_returning_visitor_otp.sql",
    "supabase/migrations/12_guardian_registry_operations.sql",
    "supabase/migrations/13_required_visitor_phone_otp.sql",
    "supabase/migrations/14_opt_in_visitor_location.sql",
):
    content = (root / filename).read_text(encoding="utf-8")
    parse_sql(content)
    print(f"SQL grammar valid: {filename}")
