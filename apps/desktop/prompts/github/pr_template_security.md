# Security Review Checklist Template

<!--
This template provides a structured security review framework for pull requests.
Complete each section based on the code changes in this PR.
-->

## Security Review Summary

**PR Title:** <!-- PR title -->
**Reviewer:** <!-- Your name/handle -->
**Review Date:** <!-- YYYY-MM-DD -->
**Review Type:** <!-- Initial / Follow-up / Re-review -->

### Change Classification

- [ ] Bug fix (correcting broken security behavior)
- [ ] New feature (adding new capability)
- [ ] Refactor (restructuring security-related code)
- [ ] Dependency update (security-relevant package update)
- [ ] Configuration change (security-sensitive setting change)
- [ ] Security hardening (explicitly improving security posture)

## Security Focus Areas (OWASP Top 10 2021)

### A01: Broken Access Control
<!-- Check if changes affect authorization, permissions, or access control -->

- [ ] Changes do NOT introduce IDOR vulnerabilities
- [ ] Authorization checks are properly enforced
- [ ] No privilege escalation paths introduced
- [ ] CORS configuration is appropriately restrictive
- [ ] Protected resources cannot be accessed via force browsing

**Notes:**
<!-- Document any access control findings or confirm secure implementation -->

### A02: Cryptographic Failures
<!-- Check for secure handling of sensitive data and cryptographic operations -->

- [ ] No hardcoded secrets, API keys, or passwords
- [ ] No logging of sensitive data (tokens, passwords, PII)
- [ ] Cryptographic operations use secure algorithms (AES-256, RSA-2048+)
- [ ] Keys and secrets are retrieved from secure storage (env vars, secrets managers)
- [ ] Passwords use strong hashing (bcrypt, Argon2, scrypt)

**Notes:**
<!-- Document any cryptographic concerns or confirm secure implementation -->

### A03: Injection
<!-- Check for injection vulnerability prevention -->

- [ ] SQL queries use parameterization (no string concatenation)
- [ ] User input is properly sanitized before use
- [ ] Command execution does not use user-controlled input
- [ ] Output encoding is appropriate for context (HTML, JS, URL, etc.)
- [ ] No eval(), Function(), or dynamic code execution with user input

**Notes:**
<!-- Document any injection concerns or confirm secure implementation -->

### A04: Insecure Design
<!-- Check for secure design patterns and threat modeling -->

- [ ] Rate limiting is implemented for new endpoints/APIs
- [ ] Business logic does not contain bypassable security controls
- [ ] Trust boundaries are properly maintained
- [ ] Security controls are not dependent on client-side validation alone

**Notes:**
<!-- Document any design concerns or confirm secure implementation -->

### A05: Security Misconfiguration
<!-- Check for secure configuration practices -->

- [ ] Debug mode/settings are disabled in production code
- [ ] No default credentials used
- [ ] Unnecessary features/dependencies are not introduced
- [ ] Security headers are appropriately configured
- [ ] Error messages do not expose sensitive information

**Notes:**
<!-- Document any configuration concerns or confirm secure implementation -->

### A06: Vulnerable and Outdated Components
<!-- Check for dependency security -->

- [ ] Updated dependencies do not have known vulnerabilities
- [ ] New dependencies come from trusted sources
- [ ] No packages with poor security track records
- [ ] Integrity checks are used for external resources

**Notes:**
<!-- Document any dependency concerns or confirm secure implementation -->

### A07: Identification and Authentication Failures
<!-- Check for secure authentication patterns -->

- [ ] Session tokens are properly generated and handled
- [ ] Session expiration is enforced
- [ ] Password requirements meet security standards
- [ ] No session fixation vulnerabilities
- [ ] Brute force protection is in place

**Notes:**
<!-- Document any authentication concerns or confirm secure implementation -->

### A08: Software and Data Integrity Failures
<!-- Check for integrity protections -->

- [ ] Deserialization uses safe methods
- [ ] Update mechanisms verify signatures (if applicable)
- [ ] CI/CD pipeline has integrity controls
- [ ] External data sources are validated before use

**Notes:**
<!-- Document any integrity concerns or confirm secure implementation -->

### A09: Security Logging and Monitoring Failures
<!-- Check for adequate security logging -->

- [ ] Authentication events are logged
- [ ] Authorization failures are logged
- [ ] Sensitive operations are audited
- [ ] Logs do NOT contain passwords, tokens, or PII
- [ ] Log injection prevention is in place

**Notes:**
<!-- Document any logging concerns or confirm secure implementation -->

### A10: Server-Side Request Forgery (SSRF)
<!-- Check for SSRF prevention -->

- [ ] User-controlled URLs are validated against allowlists
- [ ] Internal IP ranges are blocked (127.0.0.1, 169.254.169.254, 10.x.x.x, etc.)
- [ ] URL redirects are validated before following
- [ ] No ability to probe internal network via URL parameters

**Notes:**
<!-- Document any SSRF concerns or confirm secure implementation -->

## Language-Specific Security Checks

### TypeScript/JavaScript
<!-- Check for TypeScript/JavaScript-specific vulnerabilities -->

- [ ] No prototype pollution vulnerabilities
- [ ] No ReDoS (catastrophic regex backtracking)
- [ ] No unsafe use of innerHTML or document.write()
- [ ] postMessage uses origin verification
- [ ] No use of Math.random() for security-sensitive operations

**Notes:**
<!-- Document any TypeScript/JavaScript-specific concerns -->

### Python
<!-- Check for Python-specific vulnerabilities -->

- [ ] No pickle deserialization of untrusted data
- [ ] No SSTI (Server-Side Template Injection)
- [ ] subprocess uses shell=False
- [ ] No eval() or exec() with user input
- [ ] Path operations are protected against traversal

**Notes:**
<!-- Document any Python-specific concerns -->

## Additional Security Considerations

### Input Validation
- [ ] All user inputs are validated
- [ ] Data types are checked
- [ ] Size/length limits are enforced
- [ ] Format validation uses allowlists where possible

### Data Exposure
- [ ] API responses do not expose sensitive data unintentionally
- [ ] Debug endpoints are not accessible in production
- [ ] Stack traces are not exposed to end users
- [ ] File paths are not exposed in error messages

### Third-Party Integrations
- [ ] Webhook URLs are validated and secured
- [ ] External API calls use appropriate authentication
- [ ] Secrets are not exposed in client-side code
- [ ] CORS policies are correctly configured

## Security Review Findings

### Critical Issues (Blocks Merge)
<!-- Document any critical security issues that must be fixed -->

| Issue | File | Line | Description | Suggested Fix |
|-------|------|------|-------------|---------------|
|      |      |      |             |               |

### High Severity Issues (Blocks Merge)
<!-- Document any high-severity security issues that should be fixed -->

| Issue | File | Line | Description | Suggested Fix |
|-------|------|------|-------------|---------------|
|      |      |      |             |               |

### Medium Severity Issues (Recommended)
<!-- Document any medium-severity security improvements -->

| Issue | File | Line | Description | Suggested Fix |
|-------|------|------|-------------|---------------|
|      |      |      |             |               |

### Low Severity Suggestions (Optional)
<!-- Document any low-severity security suggestions -->

| Issue | File | Line | Description | Suggested Fix |
|-------|------|------|-------------|---------------|
|      |      |      |             |               |

## Security Review Sign-Off

### Approvals

| Role | Reviewer | Date | Status |
|------|----------|------|--------|
| Security Review | <!-- Name --> | <!-- Date --> | [ ] Approved [ ] Changes Requested |
| Code Owner | <!-- Name --> | <!-- Date --> | [ ] Approved [ ] Changes Requested |

### Conditions for Approval

- [ ] No critical issues found
- [ ] No high-severity issues found
- [ ] All medium-severity issues have been addressed or risk accepted with justification
- [ ] Security review checklist is complete
- [ ] Evidence is documented for all findings

### Risk Acceptance (if applicable)

<!-- If any issues are accepted as risk, document justification here -->

**Risk:** <!-- Description of accepted risk -->
**Justification:** <!-- Why this risk is acceptable -->
**Compensating Controls:** <!-- What mitigates this risk -->
**Approved By:** <!-- Name and date -->

---

## Security Best Practices Reminder

When conducting security reviews, ensure:

1. **Evidence-based findings** - Always cite actual code, never assume vulnerabilities
2. **Context matters** - Consider how code is deployed and used
3. **Defense in depth** - Multiple layers of security are better than single points
4. **Least privilege** - Code should only have permissions it needs
5. **Secure defaults** - Default configurations should be secure
6. **Fail securely** - Errors should not expose sensitive information or bypass security
7. **OWASP references** - Use OWASP guidelines and cheat sheets for reference

## References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [SANS Top 25](https://www.sans.org/top25-software-errors/)

---

*This template follows OWASP secure coding guidelines and should be used for all security-sensitive code changes.*
