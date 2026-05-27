# Team 3 Feedback

## Strengths

We think Team 3’s repository is extremely well organized and documented. One of the strongest aspects of the project is the clarity of the README and setup instructions. The step-by-step instructions for setting up and using Manta were very detailed and easy to follow, and the setup process felt smooth without much confusion. The README also includes a useful command reference table, which makes it easier for users and contributors to understand the available functionality of the program.

Another major strength is the amount of documentation present throughout the repository. The Architecture Decision Records (ADRs) provide a strong level of transparency into important technical decisions and demonstrate thoughtful planning by the team. The structure of the documentation overall feels intentional and standardized.

The code itself is also very well commented, making it easier to understand the implementation and logic behind important features. This is especially useful for contributors or reviewers unfamiliar with the specific project direction like us. In addition, the repository contains documentation that explains the structure and purpose of different parts of the repo, which improves maintainability.

From the sprint video, the team also appears to have strong communication and planning. The project progression looked well thought out, and tasks seemed to be distributed effectively among team members. The inclusion of team bonding photos at the end of the presentation was also a nice touch because it showed good team culture and collaboration.

Another strong point is the the auto-fix CI bot which could help a lot.

Overall, Team 3’s repository showed us much organization, clear planning, and a solid understanding of documentation practices.

---

## Improvements

One area that could be improved is the high-level explanation of the project itself. While the README provides excellent setup instructions and command references, it doesn't immediately explain what the project is, what problem it solves, or the purpose/functionality of Manta before entering the “Getting Started” section. As a new reviewer, it took some time to fully understand the overall goal of the project.

Adding a short introduction section near the top of the README that explains the purpose, core functionality, and intended use case of the project would improve accessibility for new users and contributors. This would help readers quickly understand the “big picture” before diving into setup instructions or technical documentation. Part of this responsiblity is the MVP, though, so we understand if that just hasn't been updated yet.

Another area for improvement is the changelog. Currently, the `CHANGELOG.md` file appears mostly empty or incomplete. Keeping the changelog updated would improve project tracking and make development progress easier to follow over time. We've noted it down as something we need to improve on as well.

There are also a large number of files and directories throughout the repository. While the organization is generally strong, grouping or simplifying some of the external files/directories further could improve readability and navigation even more.

Additionally, while the code comments are helpful, more formal code documentation or inline documentation could strengthen maintainability in the future. This would especially help as the codebase grows larger and more contributors become involved.

A smaller issue noticed was the  `.DS_Store` files inside some directories despite being listed in `.gitignore`. Removing these files would help keep the repository cleaner.

Finally, additional testing coverage such as end-to-end (E2E) and unit tests could further improve confidence in the project as development continues.

---

## Questions

- Was there a specific reason your team chose Bun as a dependency/runtime? Did it provide functionality or performance benefits compared to other alternatives?
- Were other approaches or technologies considered before deciding on the current architecture?
- Are there plans to expand formal testing coverage with additional E2E or unit tests later in development?
- Is the current repository structure finalized, or are there plans to simplify/group certain folders and files further?

---

## Suggestions

One practical improvement would be adding a short project overview section near the top of the README before the setup instructions, or somewhere else dedicated. This section could briefly explain:

- What Manta is
- What problem it solves
- The main features/functionality
- The intended audience or use case

This would make the project easier to understand immediately for outside reviewers and future contributors.

Another suggestion would be to continue expanding documentation quality by adding more formal inline code documentation and keeping the `CHANGELOG.md` updated regularly with meaningful version updates and feature additions.

Implementing Semantic Versioning and release tracking as the project goes on is probably a good idea, as well as e2e testing.

Overall, Team 3’s project stands out because of its strong documentation, organization, and planning. The repository already feels professional and maintainable, and most suggested improvements are focused on making the project even easier for new users and contributors to immediately understand and navigate. We are looking forward to your guys' finished product.