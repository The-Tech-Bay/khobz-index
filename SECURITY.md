# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `1.0.x` methodology / `khobz-index` main | Yes |

Security fixes apply to the current main branch and the latest published methodology release.

## Reporting a vulnerability

**Do not** open a public GitHub Issue for security vulnerabilities.

Email **security@thebay.ma** with:

- A description of the issue and potential impact
- Steps to reproduce (if applicable)
- Affected components (pipeline, closed API Worker, landing, data archive)

We aim to acknowledge reports within **5 business days** and provide a remediation timeline when confirmed.

## Scope

In scope:

- This repository’s pipeline, archive tooling, and closed API Worker code
- Published data integrity issues that could mislead consumers (also use the [Source correction](.github/ISSUE_TEMPLATE/source_correction.md) template for non-security data errors)

Out of scope:

- The Karama mobile app (report via the Karama project)
- Third-party data providers (FAO, WFP, Cloudflare, GitHub)
- Social engineering or physical attacks

## Disclosure

We follow coordinated disclosure. Please allow reasonable time to patch before public disclosure. We credit reporters in release notes when they agree.

## Data corrections vs security

Incorrect KKI values from source data or methodology bugs are **not** security vulnerabilities — use the **Source correction** issue template instead.
