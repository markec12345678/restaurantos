# 🔴 MANDATORY AI DEVELOPMENT & QA RULES — RESTAURANTOS

These rules apply to every AI coding agent and AI model working on this repository.

## 1. DO NOT CHANGE WORKING CODE WITHOUT PROOF

Do not modify code merely because it could be written differently, a theoretical edge case exists, another architecture looks cleaner, or an additional guard/test/refactor could be added.

Treat existing code as intentional and working unless evidence proves otherwise.

## 2. EVERY BUG MUST BE PROVEN

Before changing code, identify:
- exact file
- exact function/route/component
- exact problem
- reproduction path
- actual impact
- why current behaviour is incorrect
- smallest safe fix

If it cannot be demonstrated or strongly established from the actual code/behaviour, do NOT modify it.

Mark it: UNCONFIRMED — NO CODE CHANGE.

## 3. NEVER FIX THEORETICAL BUGS AS REAL BUGS

Distinguish:
- CONFIRMED BUG
- LIKELY BUG
- UNCONFIRMED / THEORETICAL
- NOT A BUG

Only CONFIRMED BUGS should normally produce code changes.

## 4. MINIMAL PATCH PRINCIPLE

For a confirmed bug:
- make the smallest necessary change
- preserve existing architecture and business logic
- avoid unrelated refactoring
- avoid unnecessary abstractions
- avoid unnecessary API/database changes

Do not use a bug fix as an excuse to redesign the system.

## 5. DO NOT OPTIMIZE FOR TEST COUNT

Add tests only when they protect a confirmed bug fix, important business rule, security boundary, or critical production flow.

More tests do not automatically mean a better system.

## 6. REGRESSION CHECK IS MANDATORY

Before a change, assess what existing functionality could be affected.

After a change, run relevant:
- typecheck
- lint
- unit tests
- integration tests
- E2E tests
- affected API/route checks

Correct or revert changes that introduce regressions.

## 7. SECURITY FINDINGS MUST BE EVIDENCE-BASED

Separate CONFIRMED SECURITY VULNERABILITY from THEORETICAL SECURITY CONCERN.

Do not change authentication, authorization, tenant isolation, fiscalization, payments, or database access merely because a theoretical attack can be imagined. Establish the actual attack path first.

## 8. MULTI-TENANT RULE

RestaurantOS is multi-tenant.

When checking tenant isolation, follow the actual data flow:
request → authentication → tenant/location resolution → authorization → database query → returned data.

Do not report a tenant-isolation vulnerability merely because a tenant filter is not visible in one query if the restriction is correctly enforced elsewhere in the actual execution path.

## 9. DO NOT REOPEN FIXED ISSUES

Check the current repository HEAD before reporting a problem.

Do not report deleted endpoints, obsolete code paths, historical vulnerabilities, or issues already fixed by current authorization/validation.

## 10. STOP CONDITION

STOP making changes when:
- no confirmed HIGH/CRITICAL issue remains
- relevant tests pass
- no reproducible regression exists
- remaining findings are theoretical or low-impact

Do not modify code simply to produce another QA round.

"Nothing to change" is a valid result.

## REQUIRED FINDING FORMAT

STATUS: CONFIRMED / LIKELY / UNCONFIRMED / NOT A BUG
FILE:
LOCATION:
EVIDENCE:
REPRODUCTION:
IMPACT:
MINIMAL FIX:
REGRESSION RISK:

## REQUIRED FINAL AUDIT SUMMARY

Report:
- Confirmed bugs
- Fixed bugs
- Unconfirmed findings
- Theoretical findings
- Tests added
- Tests passed
- Regressions
- Remaining production blockers
- STOP / CONTINUE

Do not inflate the result.

## 🔴 FINAL RULE

WHEN IN DOUBT: DO NOT CHANGE THE CODE.

FIRST PROVE THE PROBLEM.
