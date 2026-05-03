# UI Design

## Topics

- Hierarchy/Contrast
- Consistency
- Accessibility
- Proximity

## Hierarchy and Contrast

For this project, visual hierarchy and contrast would be particularly important so that the user can intuitively use the AIT. Hierarchy is made with visually sectioning features, there should be headers, lists, footers, descriptions, and side panels so that the design does not become muddled. 

As for contrast, the design can use color and lines to visually separate items. Both hierarchy and contrast are methods to separate features and navigation. Color and hierarchy should be used in this situation to visually categorize and quick navigation.

## Consistency

Consistency is important throughout the design so that even when using new features they are easily navigate because of existing UI features. Font, color, size, shape, and tools should have consistency. Ex: Deciding between using scroll bars, switches, progress bars, drop down menus so there is not too many types of navigations. 

## Accessibility

The product should be accessible for various audiences and features should be easily reachable. 

## Proximity

The product should categorize commonly used features together so that the user can have proximity with features. Features that are often used together should appear close to each other so that the user does not have to have to switch from page to page or area to area. Ex. The navigation bar appears close to the search bar and includes features to search all in one area.

## Prototype

I wanted to use AI to make a front-end prototype after Powell mentioned it in class

- 

```
# Agent Issue Tracker
## Context
Description: Issue tracking comes in many shapes and sizes. From the basics of GitHub issues to performance-minded
systems like Linear, to the battleship known as JIRA. In the world of AI doing much of the work we want to revisit issue
trackers and build one of our own from the ground up that fits into our AI workflow.
Can an agent read our issues? Can we track our tokens, budget, and time? Are there versions for we humans and some
better suited for the agent? We probably need less reporting and less friction so we can plan at AI-level speeds. It’s just a
CRUD (Create, Read, Update, and Delete) application for sure, but it’s the domain details that will make this perennial app
challenging, especially if it has to integrate with other systems in the software engineering process.

## Prompt
Make a front-end prototype please. Please build this with a standard-based HTML, CSS without a framework, vanilla JavaScript without a framework. 
 - Any server-side based technologies must work on Cloudflare or Github pages only
 - Take into consideration the UI color psychology map
 - Intuitive interface 
 - prioritize clarity, consistency, and accessibility
 - In an MD file, explain UI/UX choices made for the Agent Issue Tracker front-end prototype and a list of features that require UI/UX desicions
 - Visual Heirarchy 

```

The results can be viewed (Agent Issue Tracker)[https://akt014.github.io/ait-frontend-prototype/]

### Prototype Review

The prototype appears similar to existing online AIT, generally it is a good skeleton

- Did take into consideration features, visual hierarchy, consistency, color psychology, accessibility, clarity, interaction patterns
- Visualizes token usage
- Filter and search system
- Clean UI
- Date issue was made
- multiple tags
- priority list

Features that could be changed is taking into consideration:

- Removing the comfortable/compact feature that changes how the issues appear
- Making the issues clickable from the box rather the title
- Accessibility of changing the status of issue → allow users to check off issues like a list, rather then going in to edit
- Adding more color
- Changing how the tags appear

# Summary

UI is important and influences the user’s perception of a product. For our AIT we should take into consideration

- Usage of color, color is used to categorize and identify. It should definitely used as indicator for different tags and statuses for issues. However, for the general site it should not include too many colors or conflicts to direct focus where needed.
    - blue/green/muted neutrals for general site
    - yellow/red/orange/grey/etc for tags
- Hierarchy in features should be implemented. Features should be categorized so there is proximity in commonly used features. Take advantage of:
    - font/size/bold/italics
    - color
    - line
    - size
    - white space
    - shapes
- Consistency and accessibility is necessary, types of implementations should be limited and navigation should be logical where features can be used without struggle by a diverse audience and their various devices
- Making design intuitive, similarity to existing UI so that users can easily navigate the website and use it without second guessing
    - making issues editable by clicking on the issue
    - having editable text slightly darker to indicate it is an area they can be typed in
    - buttons having a small shadow and changing colors when clicked
    - buttons changing colors to show they are selected
    - steps that are often executed should be easily accessible
    - changing status of issues
        - creating new issues
        - editing issues
        - searching
    - tag system for the search system

## Sources

- https://www.figma.com/resource-library/ui-design-principles/
- https://medium.com/@erikdkennedy/7-rules-for-creating-gorgeous-ui-part-1-559d4e805cda
- https://www.coursera.org/articles/ui-design
- https://www.clickworker.com/customer-blog/accessibility-in-ui-design/