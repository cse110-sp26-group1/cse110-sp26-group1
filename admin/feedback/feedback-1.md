# Team 2 Feedback

## Strengths

Team 2’s project showed us a strong amount of planning, organization, and research. Based on the sprint/status video and repository structure, it's clear the team spent time thinking through both the technical direction of the project and how tasks should be distributed among team members. The usage of GitHub Issues for task management and organization was especially clear, and it helped show active collaboration throughout development.

One major strength is the project’s focus. The idea of creating a VS Code extension for AI issue tracking is unique compared to many traditional web-based approaches. Choosing a development environment users already interact with daily could improve workflow efficiency. The concept itself feels practical and relevant to developers using AI tools during software development, and something our team didn't really consider.

The repositories are generally clean and organized. The user manual and quickstart documentation were also useful because they attempted to make onboarding easier for users unfamiliar with the project. It also looked really nice.

Another strong point was the amount of research shown throughout the project. The sprint video demonstrated thoughtful planning and task distribution among team members. It was also good to see that responsibilities were divided clearly and tracked through GitHub Issues and labels. The README reminders and organization methods help communication and make expectations visible to contributors.

Additionally, the project appears to emphasize responsible AI usage and issue tracking rather than trying to overcomplicate. Overall we look forward to seeing how it will further pan out!

---

## Improvements

One of the biggest difficulties while reviewing the project was repository navigation. Having multiple repositories (project public repo, docs repo, and group repo) makes it somewhat confusing to understand where important files, source code, and documentation are located. From an outside perspective, it takes extra effort to determine which repository should be referenced for setup, implementation details, or active development.

There is also a significant amount of folder nesting in the public project repository, which makes locating documentation and source files harder than necessary. Some linked documentation pages redirect to another repository, which creates additional confusion. A clearer documentation structure or a centralized navigation page would make the project much easier to review and maintain.

Another issue was inconsistency between the sprint video and the current state of the repositories. In the video, there appeared to be many GitHub Issues, active tags, and project tracking details, but some of these were difficult to find when looking at the repositories directly. So it was hard for us to actually see the true project status. One of our teammates was also just wondering where all the code was at.

The large number of labels/tags on GitHub Issues can also become overwhelming. While organization is important, having too many labels may reduce readability and make issue tracking harder. Just a nitpick, since you guys might have a different perspective on that.

Some of us also had difficulty locating the actual source code in the repositories. If the codebase is still being reorganized or updated, it may help to clearly indicate where active source files are located and which repositories are currently maintained.

Meeting notes and documentation updates also appear somewhat outdated in certain sections

---

## Questions

- What made your team decide to create a VS Code extension instead of using a standalone web application or CLI-based tool?
- Did you consider creating your own issue tracker UI instead of integrating directly into VS Code? If so, what were the pros and cons?
- Are there specific advantages or limitations that come from choosing a VS Code extension architecture?
- Does the extension only work within VS Code, or are there plans for compatibility with other IDEs/editors?
- Was there a reason for using a large number of GitHub issue labels/tags, and how does your team currently manage them efficiently?
- Is the current repository structure temporary, or do you plan to consolidate repositories/documentation later?

---

## Suggestions

A strong improvement would be creating a centralized “repo guide” or navigation page that explains where everything is located across repositories. This would help both reviewers and future contributors quickly understand the project structure without needing to search through multiple repos and nested folders.

It may also help to consolidate some directories if possible. Combining documentation and code into a more unified structure could improve accessibility and reduce confusion for outside contributors or future project maintainers like this class mentioned.

Another useful addition would be a demo video or GIF showing the current UI and extension workflow. Since the project focuses heavily on usability inside VS Code, visual demonstrations would make it easier to understand how the extension works and what features are currently implemented.

For project management, converting TODO markdown files into GitHub Issues could improve visibility and collaboration because contributors can track progress directly through GitHub’s issue system.

Adding Semantic Versioning, ADRs, and a higher-level system overview in the root README would also improve the repo. 

Overall, we think Team 2 has a strong and interesting project idea with clear effort put into research, organization, and planning. Most of the suggested improvements mainly relate to repository navigation, documentation accessibility, and project visibility rather than the project concept itself. The foundation of the project appears solid, and improving the developer/reviewer experience would make the project significantly easier to understand and contribute to.