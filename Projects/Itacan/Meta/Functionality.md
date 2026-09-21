
## Structure

At its core, Itacan is a structured collection of folders and files. 

Itacan organizes these folders and files into **Workspaces**.

A **Workspace** is a collection of **Workspace Folders**, which contain the files and subfolders.

There are two types of Workspace: **Projects** and **Resources**.

```text
Homepage
├── Projects
│   └── Workspace Folder
│       └── ...
│
└── Resources
    └── Workspace Folder
        └── ...
```

Itacan can contain any number of Projects, while Resources consist of four fixed Workspaces: **Knowledge**, **Literature**, **Explorations**, and **Inspiration**.

- **Projects** — Workspace Folders created within a Project are local to that Project.
- **Resources** — Workspace Folders created within a Resource are global and can be shared with any Project.

```text 
Homepage
├── Projects
│   ├── Project 1
│   │   ├── Workspace Folder 1
│   │   │   ├── Subfolder 1
│   │   │   │   └── ...
│   │   │   └── File 1
│   │   │
│   │   └── ↪ Workspace Folder A [Knowledge]
│   │       ├── Subfolder A
│   │       │   └── ...
│   │       └── File A
│   │
│   ├── Project 2
│   │   └── ...
│   │
│   └── ...
│
└── Resources
    ├── Knowledge
    │   ├── Workspace Folder A
    │   │   ├── Subfolder A
    │   │   │   └── ...
    │   │   └── File A
    │   └── ...
    │
    ├── Literature
    │   └── ...
    ├── Explorations
    │   └── ...
    └── Inspiration
        └── ...
```

**Legend:** `↪` indicates a shared Resource folder. The folder and its contents refer to the same underlying data in the Resource Workspace, not a duplicated copy.


## Navigation

Itacan's principal navigation hierarchy consists of three levels:

**Homepage → Workspace Full-view → Workspace Note-view**

The **Homepage** provides access to the user's Workspaces. Selecting a Project or Resource navigates to its Workspace Full-view. From there, the user can browse its Workspace Folders and open files in its Workspace Note-view.

Itacan displays one primary view at a time: the Homepage, a Workspace Full-view, or a Workspace Note-view. Navigating to another primary view replaces the one currently displayed.

A persistent navigation bar is available throughout the application.
![[Pasted image 20260915102453.png]]

| Button        | Behaviour                                                                                                                                                                                                                                                            |
| :------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**      | Navigates to the Homepage.                                                                                                                                                                                                                                           |
| **Workspace** | Navigates to the Workspace Full-view of the most recently accessed Workspace                                                                                                                                                                                         |
| **Last File** | Restores the most recent Workspace Note-view configuration based on the current context.<br><br>From the Homepage, it restores the most recent configuration across Itacan. From a Workspace Full-view, it restores the most recent configuration of that Workspace. |
| **Presets**   | Opens a menu of saved Workspace Note-view configurations. Selecting a preset restores that configuration.                                                                                                                                                            |

## Primary views

### Homepage

The **Homepage** is the central overview of Itacan. It provides access to Workspaces and surfaces information relevant to the user's current work.

It contains:
- **App Shortcuts**
- **Calendar**
- **Today's Focus**
- **Tasks to Do**
- **Projects**
- **Resources**
- **Progress**
- **History**

Projects and Resources provide access to their respective Workspace Full-views.

[Image of Homepage]

### Workspace Full-view

The **Workspace Full-view** provides an overview of a single Workspace and access to its contents.

It displays:
- **App Shortcuts**
- **Workspace Folders**
- **Tasks to Do**
- **Progress**
- **History**

Workspace Folders are displayed in the main area. Their files and subfolders can be browsed without entering the Workspace Note-view.

Opening a file enters the Workspace Note-view.

[Image of Workspace Full-view]

### Workspace Note-view

The **Workspace Note-view** is the working view of a Workspace.

It consists of a Workspace navigation area and a configurable working area containing open files and webpages.

Multiple items can remain open simultaneously. Their arrangement constitutes the current Note-view configuration.

Workspace tasks remain accessible from the Note-view.

[Image of Workspace Note-view]

## Workspaces

### Projects

Projects are user-created Workspaces.

Each Project contains its own Workspace Folders and may additionally contain shared Workspace Folders from Resources.

Projects have three states:
- **Active**
- **Future**
- **Shelved**

Changing the state of a project does not affect the content of the project.

The Homepage displays Projects by state.

[Image of Projects panel]

### Resources

Resources are four fixed Workspaces:

- **Knowledge**
- **Literature**
- **Explorations**
- **Inspiration**

Unlike Projects, Resources are persistent categories rather than user-created Workspaces.

Their Workspace Folders can be shared with Projects.

[Image of Resources panel]

### Shared Resource folders

A Resource Workspace Folder can be added to a Project.

The Project then displays the Resource folder as part of its own Workspace structure.

The shared folder remains the same underlying folder. Changes made from either Workspace affect the same files and subfolders.

## Workspace content

### Folders and subfolders

Workspace Folders form the top level of a Workspace's file hierarchy.

They may contain files and nested subfolders.

In a Workspace Full-view, each Workspace Folder is represented by its own panel.

[Image of Workspace Folder panels]

### Files

Files are opened from a Workspace Folder into the Workspace Note-view.

Multiple files can remain open as part of the same Note-view configuration.

## Note-view environment

### Layout

The Workspace Note-view can display multiple working items simultaneously.

The arrangement and active item form part of the Note-view configuration.

[Image of Workspace Note-view layout]

### Tabs

Open files and webpages are represented by tabs.

Tabs may coexist within the same Note-view configuration.

The active tab and tab arrangement are preserved when the configuration is stored by supported restoration features.

### File views

Files open in a view appropriate to their type.

Markdown files are displayed as editable notes.

[Image of Markdown file in Note-view]

### PDF viewer

PDF files open inside Itacan.

The PDF remains available alongside other files in the same Note-view.

[Image of PDF in Note-view]

### Atlas browser

Itacan includes an integrated browser called Atlas.

Webpages opened in Atlas can coexist with local files in the Workspace Note-view.

Atlas tabs participate in Note-view configurations and can therefore be restored by **Last File** and **Presets**.

[Image of webpage open in Workspace Note-view]

## Tasks

Tasks belong to the Workspace content in which they are created.

The **Tasks to Do** panel surfaces incomplete tasks relevant to its current context.

On the Homepage, it aggregates tasks across Workspaces.

In a Workspace, it displays tasks belonging to that Workspace.

[Image of Tasks to Do panel]

### Workspace tasks

Workspace tasks remain associated with their originating Workspace and file.

Their source is displayed beneath the task where relevant.

### Tasks to Do

**Tasks to Do** displays incomplete tasks relevant to the current context.

Tasks with a due date or time are ordered chronologically, from the earliest due to the furthest ahead. Overdue tasks remain in the list until completed and therefore appear before later tasks.

Untimed tasks appear below all dated tasks.

Tasks may be assigned an **importance level** from 1–3, with 1 representing the highest importance. Tasks without an importance level are unmarked.

Among tasks with the same due date or time, tasks are ordered by importance, from highest to lowest, followed by unmarked tasks. The same ordering applies among untimed tasks.

### Task completion

Completing a task updates its state throughout Itacan.

Completed tasks are retained in task history.

## Today's Focus

**Today's Focus** contains the user's focus for the current day.

It is displayed on the Homepage and can be edited from there.

[Image of Today's Focus]

## Calendar

The **Calendar** panel displays the user's calendar agenda within the Homepage.

Events are displayed chronologically with their time and title.

[Image of Calendar panel]

## Progress

Progress records the significance of work performed in Workspaces over time.

It is represented through progress reports and heatmaps.

[Image of Progress panel]

### Progress ratings

Workspace progress is rated from **0–4**.

The rating represents the significance of the day's work in that Workspace.

Rating guidance depends on whether the Workspace is a Project or Resource.

### Progress reports

A progress report records the user's work for a date.

Reports can contain entries for multiple Workspaces, each with a progress rating and written description.

[Image of progress report]

### Heatmaps

Progress ratings are visualized over time using heatmaps.

Higher progress produces greater intensity.

The Homepage can display progress for either **Projects** or **Resources**.

A Workspace Full-view displays progress only for that Workspace.

The year is displayed in compact form beside the months and can be changed where other years contain data.

[Image of Homepage Progress heatmap]

[Image of Workspace Progress heatmap]

## History

**History** provides chronological records of previous work.

It has three views:

- **Reports**
    
- **Activity**
    
- **Tasks**
    

[Image of History panel]

### Reports

**Reports** displays previous progress-report entries.

Each entry identifies its Workspace, progress rating, date, time, and written report content.

### Activity

**Activity** displays recorded Workspace activity chronologically.

### Tasks

**Tasks** displays completed tasks chronologically.

## Presets and restoration

Note-view configurations can be restored without reconstructing the working environment manually.

A configuration may include open files, browser tabs, their arrangement, and the active tab.

### Last File

**Last File** restores the most recently used Note-view configuration.

Its scope depends on the current primary view:

- From the Homepage, it restores the most recent configuration across Itacan.
    
- From a Workspace Full-view, it restores the most recent configuration belonging to that Workspace.
    

### Presets

A **Preset** is a named, saved Note-view configuration.

Presets can be:

- created;
    
- opened;
    
- updated;
    
- renamed;
    
- deleted;
    
- reordered.
    

Presets persist across application sessions.

If a saved item has been moved or no longer exists, the preset should handle the missing reference without preventing the remaining configuration from opening.

[Image of Presets menu]

## The Oath

An **Oath** is a temporary commitment to a restricted working environment.

While an Oath is active, Itacan enforces the selected work boundary until the Oath ends or is broken.

[Image of Oath setup window]

### Starting an Oath

Starting an Oath presents the user with its duration and applicable restrictions.

The setup communicates:

> Commit to uninterrupted work. Itacan will hold the boundary for you.

### Duration

An Oath can use:

- a predefined duration;
    
- a custom duration;
    
- **Until ended**.
    

A timed Oath ends when its duration expires.

An indefinite Oath continues until the user ends it.

### Application and website restrictions

During an Oath, Itacan opens in fullscreen.

Only permitted applications and websites remain accessible.

Permitted external applications may open above Itacan without leaving the restricted environment.

Non-permitted applications and websites are blocked for the duration of the Oath.

### Notifications

Notifications from non-permitted applications and websites are blocked and silenced while the Oath is active.

This behaviour is part of the Oath and is not optional.

### Permitted applications

Applications required for the current work can be permitted before or during the Oath where supported.

Permitted applications may be used without ending the Oath.

### Breaking the Oath

Leaving a timed Oath before it expires constitutes breaking the Oath.

Ending an indefinite Oath also requires the same confirmation.

Itacan asks:

> **Are you sure you wish to break the Oath?**

[Image of Break Oath confirmation]

### Other devices

An Oath can optionally be extended to other devices with Itacan installed and signed in to the same account.

This option is not required to begin an Oath.

## Search

Workspace Folder panels provide search for locating their files and subfolders.

Search results remain scoped to the folder being searched.

[Image of Workspace Folder search]

## Shortcuts

**App Shortcuts** provide quick access to configured applications and websites.

They are available from the Homepage and Workspace Full-view.

[Image of App Shortcuts]

## Settings and customization

The Homepage cover changes according to four periods of the day:

- **Morning**
    
- **Afternoon**
    
- **Evening**
    
- **Night**
    

Each period can use its own image and image placement.

[Image of cover image editor]