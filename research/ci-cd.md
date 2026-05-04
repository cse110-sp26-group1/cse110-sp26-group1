# Research Summary: CI/CD Pipelines, Testing, and Quality Strategy
**Target Directory:** `/research/`

---

## Overview
This research document outlines the strategies, tooling, and workflows required to build a repeatable, observable, and automated **CI/CD pipeline** for the Agent Issue Tracker (AIT) project. Per our project requirements, our focus is heavily weighted toward **process over product**, meaning our automation and quality pipelines directly impact our evaluation.

---

## 1. Automated Pipeline Infrastructure: GitHub Actions
As required by the project specifications, all continuous integration and continuous deployment automation must reside within **GitHub Actions**. 

### The CI Pipeline Lifecycle
To ensure early and consistent quality gates, the pipeline will execute on every **Push** and **Pull Request (PR)** to our repository.

[Developer Push] ➔ [Trigger Workflow] ➔ [Static Analysis] ➔ [Unit/E2E Tests] ➔ [Release/Deploy]

### Key Components of the CI Workflow
* **Fail-Fast Policy:** The pipeline is designed to check lower-cost steps (like linting and documentation validation) before running more intensive test suites.
* **Build Verification:** The CI pipeline validates the repository incrementally on all branch pushes to ensure any bugs are identified before code review.

---

## 2. Quality & Static Analysis Strategy

Our specification explicitly states that **linting and quality checks** must be performed via our CI pipeline. 

### Tooling Selection
* **Linters and Formatters:** Use **ESLint** and **Prettier** to perform automated checks on software artifacts.
* **Documentation Enforcement:** The project spec requires that code documentation be maintained incrementally. Commenting using **JSDocs** must be followed and verified via the pipeline.

---

## 3. The Testing Matrix
The project emphasizes **early verifiable testing efforts** over late additions, and requires demonstration of both unit and end-to-end (e2e) tests. Testing will be divided into two primary tiers using modern tooling.

| Test Level | Goal | Recommended Tool | Project Integration Point |
| :--- | :--- | :--- | :--- |
| **Unit Testing** | Verify isolated utility functions and core CRUD logic. | **Vitest** (Native ESM support for Vanilla JS) | Runs on every PR commit. Must pass before any PR merge. |
| **End-to-End (E2E)** | Emulate full user and agent workflows in a browser. | **Playwright** (Built-in tracing for debugging) | Runs on pre-release or staged deployments to prevent regression. |

### Enforcing PR Isolation
To maintain strict software quality standards, work batches above 300 Lines of Code (LoC) MUST follow a pull-request path with review and evaluation by another human on the team. The automated CI checks act as a complementary layer to peer review.

---

## 4. Continuous Deployment & Release Strategy
Continuous Delivery automates release readiness, guaranteeing our application is always functional and testable.

### Automated Deployment Path
Per the technical requirements, the application must deploy seamlessly to **GitHub Pages** or **Cloudflare**.

* **Staging Build:** A dedicated staging build triggers on PR updates to allow early testing and evaluation.
* **Production Build:** Merges into the main branch trigger the deployment steps directly to the live production site.

### Automated Release Governance
* **Semantic Versioning (SemVer):** All version changes must strictly follow `Major.Minor.Patch` updates.
* **Conventional Commits:** By committing changes using consistent formatting (e.g., `feat:`, `fix:`, `docs:`), we can manage the repository incrementally and build our **Changelog** automatically.

---

## Key Takeaways for Our Team
* **Process >> Product:** Our pipeline provides the observable quality evidence our TA and Professor are evaluating.
* **Integrate Early:** Do not defer testing until the end. Set up unit test structures immediately during Week 5's initial planning.
* **Transparent Automation:** Document all major CI/CD configuration changes as Architectural Decision Records (ADRs) using the MADR format.

---

## Sources
* **CSE 110 Teams #1-5 Sp 26 Project Specification**
