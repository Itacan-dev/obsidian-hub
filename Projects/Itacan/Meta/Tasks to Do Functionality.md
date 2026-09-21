
| **Necessity**             | To do                                                                                                                                                  | Should do                                                   | Must do                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------ |
| **Text next to task**     | "To do"                                                                                                                                                | "Should"                                                    | "Must"                               |
| **Color**                 | Gray or Blue                                                                                                                                           | Yellow                                                      | Red                                  |
| **Interpretation**        | The basic idea of a "task" is that it is something the user intends "to do." It is intentionally broad to serve as the default state of created tasks. |                                                             |                                      |
| **Explanation for users** | "Default state of tasks"                                                                                                                               | "This task is important but neither required nor mandatory" | "This task is required or mandatory" |


# Tasks to Do

The **Tasks to Do** system provides a global view of actionable tasks across Itacan while keeping each task connected to the note in which it was created.

Tasks should not merely be interpreted as Markdown checkbox syntax. They should behave as structured task objects that can carry scheduling information, necessity information, completion state, and other metadata while still living naturally inside notes.

---

## Task structure

A task belongs to a source note but may be surfaced elsewhere throughout Itacan, including:

- the Homepage **Tasks to Do** panel,
- Workspace task views,
- scheduled views,
- future-task views,
- and The Oath.

These are different views of the same underlying task rather than duplicated copies.

Completing or editing a task in one location therefore updates it everywhere.

A task may contain:

- task text,
- completion state,
- source note,
- source position,
- optional Steps,
- Necessity state,
- `From`,
- `Until`,
- `Due`,
- `Planned`,
- and, where applicable, Oathbound state.

---

## Steps

A task may optionally contain **Steps** that break the work into smaller actions.

Steps are supporting structure within a task rather than independent tasks. The parent task remains the primary unit of work, scheduling, Necessity, and Oath commitment.

For example:

```text
Write literature review

Steps
✓ Find remaining sources
✓ Read key papers
☐ Draft section
☐ Revise references
```

Steps are intended to help when breaking a task down makes it easier to understand, begin, or track. They are not required, and Itacan should not imply that every task ought to contain them.

The task-creation interface should therefore make Steps easy to access but visually secondary to the task itself.

A simple control such as:

```text
Steps (optional)
+ Add step
```

is sufficient.

Once one Step has been added, the section can expand naturally to allow additional Steps.

The parent task should remain visually dominant wherever the task is shown. When useful, Itacan may display restrained progress such as:

```text
3 / 5 steps
```

Steps should not receive prominent completion celebrations or be treated as equivalent to completing separate tasks.

![[Pasted image 20260918094155.png|1341]]

---
# Creating tasks

Creating a task should require as little friction as possible.

The user should not normally have to manually type:
- [ ]


This is particularly cumbersome in a Markdown editor because typing `-` immediately creates a normal bullet before the user has finished entering the checkbox syntax.

Itacan should instead provide native ways of creating a task.

Possible entry mechanisms include:

- a Task command or block,
    
- a slash command,
    
- a keyboard shortcut,
    
- a block/context-menu action,
    
- converting an existing line into a task,
    
- and optionally continuing to recognize Markdown task syntax for users who prefer it.
    

The exact combination of creation methods remains to be decided.

---

## New task interaction

Creating an ordinary task should not require the user to make decisions about metadata.

When the **New task** interface opens:

1. the cursor should immediately be placed in the task-text field;
    
2. the default task state should already be selected;
    
3. scheduling should be optional;
    
4. **Steps** should be available as an optional, visually secondary section;
    
5. the user should be able to type the task and press Enter immediately without interacting with Steps or any other metadata.
    

The user should therefore be able to create:

> Read chapter 4

without being asked whether it is important, necessary, urgent, future, or anything else.

Additional task properties are available only if the user wants to specify them.

---

# Necessity

Itacan uses **Necessity** rather than a conventional `Low / Medium / High` priority scale.

Conventional priority scales are vague because they do not clearly define what makes one task "higher" than another. They can mix together urgency, importance, deadlines, and personal commitment.

Necessity instead addresses a more specific question:

> **How strongly does this task need to be completed?**

However, **To do is not itself a genuine necessity judgment**.

The system has one neutral default state and two explicit escalations:

|Display|Meaning|
|---|---|
|**To do**|Default neutral task state. No explicit necessity judgment has been made.|
|**Should do**|The user explicitly considers the task important to complete, although it is not required.|
|**Must do**|The user explicitly considers completion required.|

A task displayed as **To do** could in reality be something the user should or must do. It simply means that the user has **not chosen to classify or escalate its necessity**.

This distinction is intentional.

The user should not have to stop and evaluate the necessity of every task while capturing it.

---

## Necessity control

The task-creation interface exposes a **Necessity** control:

- `TO DO`
    
- `SHOULD`
    
- `MUST`
    

`TO DO` is preselected automatically.

`SHOULD` and `MUST` exist primarily to make selected tasks stand out from the ordinary task population.

![[Pasted image 20260917094842.png|1341]]

The user therefore does **not** encounter a question such as:

> "Which necessity level does this task have?"

Instead, the default has already been chosen and the control is available if the user wants to increase the task's Necessity.

Conceptually:

> **Necessity is available as explicit user input, but ordinary task creation does not require interacting with it.**

---

## Necessity appearance

Every task row reserves a fixed-width position immediately before the task description for its Necessity state.

The visual styles are:

- **TO DO** — neutral gray
    
- **SHOULD** — yellow/amber
    
- **MUST** — red
    

All three badges have the same width so that task descriptions remain vertically aligned.

The neutral `TO DO` badge should remain visually subdued. It represents an ordinary task rather than a low-value task.

`SHOULD` and `MUST` provide increasingly strong visual emphasis.

---

# Scheduling

Scheduling is completely independent of Necessity.

A task scheduled for the future may still be:

- To do,
    
- Should,
    
- or Must.
    

For example:

> `MUST — Renew passport — From Jan 10`

is entirely valid.

Future scheduling must therefore **not replace the Necessity badge with a FUTURE badge**.

---

## Scheduling properties

A task may optionally contain four distinct temporal properties.

### From

`From` specifies the earliest date on which the task becomes actionable.

Example:

> `From Oct 1`

Before October 1, the task belongs to the future rather than the active task set.

The user is not required to specify any corresponding end date.

---

### Until

`Until` specifies the end of the period during which the task remains relevant or possible.

Example:

> `From Sep 20 · Until Oct 15`

This is useful for tasks such as:

- visiting an exhibition,
    
- applying during an application window,
    
- completing an opportunity available only during a certain period.
    

`Until` is **not a deadline**.

If an unfinished task passes its `Until` date, Itacan should not silently delete or hide it permanently. It should instead indicate that its availability/relevance window has ended and allow the user to:

- complete it,
    
- dismiss it,
    
- reschedule it,
    
- or delete it.
    

---

### Due

`Due` specifies the actual completion deadline.

Example:

> `Due Sep 23`

It represents the latest acceptable time at which the task should be completed.

Due information should always be explicitly labelled. A task should therefore display:

> `Due Sep 23`

rather than simply:

> `Sep 23`

so that the meaning of the date remains unambiguous.

Overdue deadlines may be highlighted in red and accompanied by an indication such as:

> `(overdue)`

---

### Planned

`Planned` specifies when the user intends to work on the task.

Example:

> `Planned today at 14:00`

This is distinct from the deadline.

A task may therefore have both:

> `Planned Sep 20 · Due Sep 23`

The user intends to work on it on September 20, but completion is not required until September 23.

---

## Scheduling combinations

These properties can be combined where useful.

For example:

```text
MUST
Submit assignment
Due Sep 23
```

```text
SHOULD
Begin thesis literature review
From Oct 1
```

```text
TO DO
Visit exhibition
From Sep 20 · Until Oct 15
```

```text
MUST
Renew passport
From Jan 10 · Due Feb 1
```

```text
SHOULD
Work on chapter
From Sep 20 · Until Sep 30 · Due Oct 3
```

The properties should remain explicitly named rather than being collapsed into an ambiguous generic range such as:

> `Sep 20–Oct 3`

---

# Future tasks

**Future** is not a Necessity state.

A task is future-scheduled when its `From` date lies in the future.

Therefore:

```text
MUST    Renew passport            From Jan 10
SHOULD  Plan literature review    From Oct 1
TO DO   Investigate provider      From Nov 1
```

are all future tasks while retaining their normal Necessity states.

A future task without a `From` date may eventually also be supported as an indefinite **Someday/Future** task, but the exact behavior of such tasks has not yet been finalized.

---

# Tasks to Do panel

The normal task row follows this visual structure:

```text
checkbox → Necessity → task description → scheduling
                    ↳ source breadcrumb
```

For example:

```text
☐  MUST      Submit topology problem set        Due Sep 16
             Knowledge › Mathematics › ...       (overdue)

☐  SHOULD    Review lecture 2 again             Due Sep 23
             Knowledge › Mathematics › ...

☐  TO DO     Clean up browser notes
             Itacan › Atlas › Tasks

☐  MUST      Renew passport                     From Jan 10
             Personal › Administration › Tasks

☐  SHOULD    Work on thesis literature review   From Sep 20 · Due Oct 3
             Projects › Master's Thesis › Tasks

☐  TO DO     Visit temporary exhibition         From Sep 20 · Until Oct 15
             Personal › Culture › Tasks
```

The source breadcrumb remains visually secondary but tells the user exactly where the task originates.

[image of the normal Tasks to Do panel with MUST, SHOULD, and TO DO badges and Due, From, and Until scheduling metadata]

---

# Ordering tasks

The present implementation largely follows the location of tasks inside their source documents.

Itacan should instead use task metadata to produce a useful global ordering.

The intended primary ordering is:

1. overdue active tasks;
    
2. active tasks with the earliest upcoming due dates;
    
3. tasks with progressively later due dates;
    
4. active tasks without due dates.
    

Within the same time category, Necessity provides the secondary ordering:

1. `MUST`
    
2. `SHOULD`
    
3. `TO DO`
    

For example, if two tasks are both due on September 23, a `MUST` task appears above a `SHOULD` task.

If two tasks also have the same date and the same Necessity state, their source-document position can act as the final stable tie-breaker.

This retains predictable ordering without allowing source position to dominate the global task system.

---

# Oathbound tasks

The Oath can use Tasks to Do when the user chooses the mode:

> **Until selected tasks completed**

In this mode, the selected tasks are pinned above the rest of the task list.

The Oathbound section contains:

- an Oathbound status header,
    
- the mode description,
    
- completion progress such as `0 / 3 completed`,
    
- and a pinned block containing the selected tasks.
    

Example structure:

```text
Oathbound | Until selected tasks completed | 0 / 3 completed

Pinned for Oath
Complete these 3 tasks to end Oathbound

☐ MUST      Finish Complex Analysis assignment    Due Sep 18
☐ SHOULD    Write the primary views section       Due Sep 20
☐ TO DO     Prepare supervisor questions          Due Sep 25
```

Pinned tasks retain all their normal properties:

- checkbox,
    
- Necessity,
    
- task description,
    
- source breadcrumb,
    
- scheduling information.
    

Oathbound therefore does not replace Necessity or scheduling.

It is an additional commitment layer.

![[Pasted image 20260917094624.png|1341]]

![[Pasted image 20260918094329.png|700]]

---

# Separation of task concepts

The task model deliberately keeps several concepts independent.

|Property|Question answered|
|---|---|
|**To do / Should / Must**|Has the user explicitly escalated how necessary completion is?|
|**From**|When does this become actionable?|
|**Until**|Until when does this remain relevant/available?|
|**Due**|When must this be completed by?|
|**Planned**|When does the user intend to work on it?|
|**Future**|Is the task not yet actionable?|
|**Oathbound**|Has the user explicitly bound themselves to completing it within an Oath?|

This separation prevents conventional "priority" from becoming an ambiguous mixture of importance, urgency, scheduling, and commitment.

---

# Design rationale for the default state

The basic concept of a task is already:

> something the user intends to do.

For that reason, **To do** is an intentionally broad neutral label.

It does not mean:

- low importance,
    
- low urgency,
    
- optional,
    
- unimportant,
    
- or unnecessary.
    

It simply means:

> **This is a task, and no stronger Necessity classification has been assigned.**

This makes it suitable as the automatic default.

The user should be able to capture thoughts quickly and only use `SHOULD` or `MUST` when a task deserves additional prominence.

---

# Remaining questions

Several implementation details remain open.

## Task creation mechanism

The exact native methods for creating a task still need to be chosen.

Possible options include:

- `/task`,
    
- keyboard shortcut,
    
- block menu,
    
- toolbar control,
    
- context-menu conversion,
    
- automatic syntax recognition,
    
- or some combination.
    

---

## New Task interface

The behavior is established:

- task text receives focus immediately,
    
- `TO DO` is preselected,
    
- `SHOULD` and `MUST` are optional,
    
- scheduling is optional,

- Steps are optional and visually secondary**,
    
- the user may immediately press Enter to create the task.
    

The exact visual layout of this window remains to be designed.

---

## Future-task visibility

It remains to be decided how tasks with future `From` dates appear in the normal Tasks to Do panel.

Possible approaches include:

- hiding them until their `From` date,
    
- exposing them through a collapsed **Future tasks** section,
    
- displaying a count such as `3 future tasks`,
    
- allowing the user to reveal them,
    
- or showing selected future tasks directly.
    

What is already settled is that they retain their normal `TO DO / SHOULD / MUST` state rather than using a `FUTURE` badge.

---

## Planned-time ordering

Due-date ordering is defined.

The effect of `Planned` on the main Tasks to Do ordering still needs to be decided.

A planned task may instead primarily affect:

- Today's tasks,
    
- calendar views,
    
- daily planning,
    
- or another dedicated planning surface.
    

---

## Until in the initial implementation

The semantics of `Until` are established, but it has not yet been decided whether it should ship in the first version of the expanded task system or be added later.

---

## Advanced task functionality

Possible later extensions include:

- recurring tasks,
    
- reminders,
    
- dependencies,
    
- filtering,
    
- grouping,
    
- saved task views,
    
- calendar drag-and-drop,
    
- and other planning functionality.
    

These have not yet been specified in detail.