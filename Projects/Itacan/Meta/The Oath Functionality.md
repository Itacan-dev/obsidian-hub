
**The Oath** is Itacan’s high-commitment concentration system. It is more than a timer or visual focus mode: the user deliberately commits to work, and Itacan enforces a protected environment around that commitment.

Core explanatory copy:

> **Commit to uninterrupted work. Itacan will hold the boundary for you.**

Ceremonial oath shown near the bottom of the setup window, immediately before committing:

> _“I solemnly swear that I will do the work, the whole work, and nothing but the work.”_

The normal action is **Take Oath**. Abandoning an unfulfilled Oath is **Break Oath**. Successfully satisfying it is **Oath fulfilled**.

## Agreed functionality

- **Persistent access:** A labelled **The Oath** control sits in the **bottom-left corner of every primary Itacan view**—Homepage, Workspace Full-view, and Workspace Note-view. It belongs to the application shell, not the sidebar or current pane, so its position remains stable. It should be visually important enough to be discoverable, not an icon-only utility. During an active Oath it can use a strong purple active state and potentially show remaining time, e.g. `◆ The Oath · 42m`.
	
- **Commitment principle:** The Oath does not attempt to make abandoning work impossible. Its purpose is to make the user's earlier, deliberate commitment stronger than a later impulse to abandon it. Itacan does this through precommitment, a protected whitelisted environment, visible progress, deliberate exit friction, and durable accountability while preserving the user's ability to **Break Oath**.
	
- **Oath setup window:** Clicking the control opens a compact modal. It asks **“When should the Oath begin?”** with `Now` or `Select date and time`, followed by **“What will you work on?”** and **“How should the Oath be fulfilled?”**.

  **What will you work on?** lets the user select one or more existing Itacan tasks or create new tasks directly from the setup window. Every Oath therefore has one or more selected tasks associated with it.

  **How should the Oath be fulfilled?** determines the condition that ends the Oath successfully.

  The bottom of the window contains the ceremonial oath sentence and a **Take Oath** button.
    
- **Scheduling:** Scheduling is not a separate mode; it is simply a future start date/time. The commitment is taken now and enforced later. Once the **scheduled date begins**, cancelling the scheduled Oath counts as **breaking the Oath**. Before that date it may be cancelled normally.
    
- **Fulfilment conditions:** Every Oath has exactly one fulfilment condition. The available conditions are:

  - a fixed duration, using common presets such as `25 minutes`, `50 minutes`, `90 minutes`, and `2 hours`;
  - `Custom…`, allowing a user-entered whole duration;
  - `Until ended`;
  - `Until selected tasks are complete`.

  The selected tasks and the fulfilment condition are independent properties of the Oath.

  For timed and `Until ended` Oaths, the selected tasks specify what the user intends to work on but do not individually determine whether the Oath is fulfilled.

  For `Until selected tasks are complete`, the selected tasks themselves are the fulfilment criteria.
	
- **Selected Oath tasks:** Every Oath contains one or more selected tasks representing the work included in that Oath. Selected tasks are real Itacan tasks and remain connected to their normal source notes, scheduling information, Necessity state, Steps, and other task metadata.

  During an active Oath, selected tasks are pinned above the normal **Tasks to Do** ordering under a dedicated Oath section.

  The role of these tasks depends on the fulfilment condition:

  - in a timed Oath, they specify the work intended for the timed session;
  - in an `Until ended` Oath, they specify the work whose completion is judged by the user when ending the Oath;
  - in an `Until selected tasks are complete` Oath, they are required for fulfilment and become **Oathbound tasks**.
	
- **Whitelisted-based protection:** The Oath operates on a **default-deny whitelist model**. Before becoming Oathbound, the user determines which applications and websites belong to their legitimate work environment. During an Oath, those permitted tools remain available and other applications and websites are unavailable.

  The purpose is not to predict and individually block possible distractions. Instead, the user decides in advance **what the work requires**, and Itacan holds that boundary during the commitment.
	
- **Delayed additions to the whitelist:** New applications and websites cannot become permitted immediately after being added. A substantial waiting period separates the decision to permit a tool from the moment of temptation that may have motivated the request.

  Normal non-Oathbound Itacan remains unrestricted during this waiting period. The user may therefore continue working normally while waiting for a new application or website to become available for future Oaths.
    
- **Fullscreen enforcement:** When an Oath begins, **Itacan enters and remains fullscreen**. Other permitted applications/windows may appear above Itacan when used, but they should not cause Itacan itself to leave its protected fullscreen state.
    
- **Notification protection:** During every Oath, notifications from **non-permitted applications and websites are blocked and silenced**. This is intrinsic to the Oath and is **not optional**.
    
- **Cross-device extension:** **Extend to my devices** is optional. When enabled, the Oath extends to other devices on which Itacan is installed and the user is signed in. The exact cross-device enforcement should follow the same Oath state where technically possible.
    
- **Timed Oaths:** A timed Oath is fulfilled automatically when its timer reaches zero.

  Its selected tasks remain pinned for the duration of the Oath but are not individually required for fulfilment. Completing all selected tasks before the timer expires does not automatically fulfil the Oath.

  Additional selected tasks may be added during the Oath if the user wishes to continue with other work.

  Attempting to leave before the timer reaches zero invokes the break flow. Itacan states that leaving will record the Oath as broken and presents **Keep Oath** as the emphasized action while keeping **Break Oath** available.
    
- **Until ended:** An `Until ended` Oath has no predetermined time limit and does not require every selected task to be completed automatically.

  The selected tasks identify the work included in the Oath.

  When the user chooses to end the Oath, Itacan asks:

  **“Did you complete the work you swore to do?”**

  - `Yes` fulfills the Oath.
  - `No` leads to **Keep Oath** or **Break Oath**.
  - **Keep Oath** returns immediately to the active Oath.
  - **Break Oath** ends the Oath and records it as broken.

  Selected tasks may therefore remain incomplete when an `Until ended` Oath is fulfilled if the user judges that the work intended for that Oath has nevertheless been completed.
    
- **Task-based Oaths:** `Until selected tasks are complete` uses the selected tasks themselves as the objective fulfilment condition.

  When this condition is selected, every task selected for the Oath becomes an **Oathbound task** and is required for fulfilment.

  Completing the final incomplete Oathbound task automatically fulfils the Oath. Itacan does not ask the user whether the work was completed because the fulfilment condition is determined directly from task completion state.
    
- **Oathbound tasks:** **Oathbound** is the state assigned to selected tasks when the fulfilment condition is `Until selected tasks are complete`.

  Oathbound tasks are required for fulfilment. They are normal Itacan tasks rather than a separate Oath checklist.

  During the active Oath they are pinned above normal **Tasks to Do** ordering and visually distinguished. The Oath section should explicitly indicate that they are required, for example:

  `◆ Oathbound · Until selected tasks completed`

  and:

  `Pinned for Oath · Complete these 3 tasks to fulfill the Oath`

  Oathbound tasks retain their normal checkbox, Necessity state, task description, source breadcrumb, scheduling information, and Steps.

  Oathbound status is additional to these normal task properties.
	
- **Pinned tasks in non-task-based Oaths:** In timed and `Until ended` Oaths, selected tasks are pinned in the Oath section of **Tasks to Do**, but they are not marked as required for fulfilment.

  The section should therefore distinguish them from Oathbound tasks. For example:

  `Oath · 42m remaining`

  `Pinned for Oath · Selected work`

  or, for an indefinite Oath:

  `Oath · Until ended`

  `Pinned for Oath · Selected work`

  Their completion state may be shown normally, but completion of these tasks does not itself fulfill the Oath.
    
- **Adding tasks during an Oath:** Tasks may be added to an active Oath.

  In a timed or `Until ended` Oath, adding a task adds it to the selected work for that Oath and pins it with the other selected tasks. It does not change the fulfilment condition.

  In an `Until selected tasks are complete` Oath, adding a task makes it a new **Oathbound task** and therefore adds another requirement for fulfilment.

  Context menus may provide actions such as **Add to current Oath** for ordinary Oaths and **Bind to current Oath** for task-based Oaths.
    
- **Removing selected tasks from timed and Until-ended Oaths:** The exact behaviour for removing a selected task from an active timed or `Until ended` Oath remains to be specified. Because these tasks do not determine fulfilment, removing one does not directly satisfy or weaken an objective fulfilment condition.

- **Removing Oathbound tasks:** An incomplete Oathbound task should not have an ordinary `Remove from Oath` action because it is part of the fulfilment condition. Deleting, removing, or otherwise excluding an incomplete Oathbound task requires special commitment logic rather than silently weakening the active Oath.
    
- **Trying to end a task-based Oath early:** If one or more Oathbound tasks remain incomplete, Itacan does not ask whether the user completed the work. It directly states that required tasks remain incomplete and offers **Keep Oath** or **Break Oath**.

  If no Oathbound tasks remain incomplete, the Oath has already been fulfilled automatically.
	
- **Steps and fulfilment:** Steps remain internal components of their parent task.

  In timed and `Until ended` Oaths, Step completion is informational only.

  In an `Until selected tasks are complete` Oath, the parent Oathbound task is the fulfilment unit. Completing individual Steps does not count as completing additional Oathbound tasks.

  The exact rule governing manual completion of a parent task while one or more of its Steps remain incomplete must be consistent with the general Tasks to Do behaviour.
    
- **Breaks for indefinite Oaths:** `Until ended` and task-based Oaths must support legitimate rest. When trying to leave one of these long-running Oaths, **Take a break** is available alongside continuing/ending. A break can be any whole number from **1 to 60 minutes**, with several suggested durations to be chosen later. Break time does **not** count toward Time Oathbound. The Oath remains intact, can resume automatically when the break expires, and should offer **Resume now**.
	
- **Active progress:** During an Oath, Itacan should quietly make meaningful progress visible without turning the work session into a gamified dashboard.

  Depending on the Oath type, this may include:

  - remaining or elapsed Oathbound time;
  - `2 / 3 Oathbound tasks completed`;
  - restrained Step progress within an individual Oathbound task.

  Progress should remain visually secondary to the work itself.
    
- **Presence/inactivity protection:** The purpose is to keep `Time Oathbound` meaningful without punishing legitimate deep thinking, handwritten mathematics, reading, etc. Presence detection is one system with an ordinary inactivity timer and an optional stricter camera signal.
    
- **Non-Note-view inactivity:** In primary views other than Workspace Note-view, a **5-minute inactivity threshold** is the intended strict default because real work is expected to happen primarily in notes, PDFs, browser material, etc.
    
- **Note-view inactivity:** Workspace Note-view is intentionally more tolerant. The user can choose approximately **10 minutes or 30 minutes**, with **30 minutes currently favored as the standard/default** for serious study/research and 10 minutes as a stricter option.
    
- **Optional camera assistance:** Camera access is voluntary. Crucially, enabling it does **not** make the inactivity timer more forgiving. The same 5/10/30-minute timer applies in both cases. Camera assistance only makes the system **stricter/more responsive** by allowing Itacan to detect that the person has actually left before the inactivity timer expires. Refusing camera permission therefore does not disadvantage the user; Itacan simply relies on the timer.
    
- **Camera false positives:** Camera detection is evidence, not unquestionable truth. If it believes the user left while they were actually working outside the camera frame, the same presence confirmation lets the user correct that.
    
- **Quiet inactivity prompt:** The prompt must be deliberately unobtrusive—no aggressive sound, flashing interruption, or forced attention that could break concentration. It should remain waiting until the user naturally notices it.
    
- **Inactivity does not immediately remove work time:** When the inactivity threshold is reached, the elapsed time becomes effectively **provisional** rather than automatically being discarded. The prompt asks **“Are you still there?”** with two responses:
    
    - **I was still working** → all inactive/provisional time remains counted as Oathbound.
        
    - **I’m back now** → Itacan concludes that some of the inactivity was genuine AFK time and retrospectively deducts an estimated portion from Time Oathbound.
        
- **Why two inactivity answers matter:** A user may spend 30–60 minutes doing calculations on paper without touching the computer, then only later notice the quiet prompt. `I was still working` prevents legitimate work from being erased. `I’m back now` lets the user honestly indicate they actually left.
    
- **AFK deduction:** We discussed deducting approximately **half of the continuous idle period** when `I’m back now` is selected, because all real work naturally contains some periods without device interaction. A safeguard was proposed so extremely long idle periods do not automatically credit hours of fake work. **The exact deduction formula remains undecided.**
    
- **Time accounting:** Explicit breaks do not count toward Time Oathbound. Genuine AFK time identified through the inactivity flow is deducted. Time confirmed with `I was still working` remains counted. The statistics should represent meaningful committed work rather than simply elapsed wall-clock time.
    
- **Oath history:** Add **Oaths** to the existing History segmented control: `Reports | Activity | Tasks | Oaths`.

  Each recorded Oath may include:

  - start date/time;
  - fulfillment condition;
  - selected tasks;
  - which tasks, if any, were Oathbound;
  - intended duration where applicable;
  - actual Oathbound time;
  - break/paused time;
  - fulfilled or broken status;
  - scheduling information;
  - and cross-device use.

  This is the main everyday location for Oath records and annual statistics rather than adding another permanent Homepage panel.
    
- **Annual statistics:** The principal metrics are `Oaths taken`, `Fulfilled`, `Broken`, and `Time in Oath/Time Oathbound`. Detailed History can record each Oath’s date/time, intended condition/duration, actual active time, paused/break time, fulfilment/break status, task objective where applicable, scheduling, and cross-device use.
	
- **No universal productivity score:** Itacan should not collapse Oath statistics into a single opaque productivity score. `Time Oathbound`, `Oaths taken`, `Fulfilled`, `Broken`, and related measures should remain individually interpretable.
    
- **Statistics elsewhere:** A Settings statistics page may later provide deeper analysis, but **History → Oaths** is the normal user-facing record. The bottom-left Oath button should primarily remain operational rather than becoming a dense statistics dashboard.
    
- **Annual redemption/reset:** At the beginning of each calendar year, the visible Oath tally starts fresh: taken `0`, fulfilled `0`, broken `0`, time `0h`, etc. Old Oaths are **not deleted**; previous years remain accessible in History. Philosophy: **the history remains, the tally starts anew.**
    
- **Year assignment:** An Oath belongs to the **year in which it begins**, even if it crosses midnight into January 1. A future Oath belongs to the year in which its scheduled start occurs.
	
- **Social accountability:** Optional social features may allow friends or colleagues to see Oath activity and outcomes. The system should emphasize **performed behaviour and completed commitments** rather than rewarding declarations of intention.

  Suitable forms may include:

  - `Oathbound now`;
  - `Oath fulfilled · 2h 03m`;
  - weekly or yearly `Time Oathbound`;
  - number of Fulfilled Oaths;
  - an optional **Oath Witness** who can see whether a particular Oath was fulfilled or broken.

  Itacan should avoid heavily rewarding users socially merely for announcing that they intend to work.
    
- **Completion feedback:** After fulfilment, Itacan may quietly show something such as `Oath fulfilled · 50 minutes · Your 15th fulfilled Oath of 2026`. It should **not** immediately remind the user how many Oaths have been broken; the feature is intended to be consequential but redeeming.
    
## Remaining design questions

**Scheduled task-based Oaths:** Decide what happens if all Oathbound tasks are completed before the scheduled Oath begins. The likely behaviour is that the scheduled Oath is already fulfilled and therefore does not begin.

**Removing selected work:** Decide whether selected tasks may be removed freely from active timed and `Until ended` Oaths, whether removal requires confirmation, or whether selected work becomes fixed once the Oath begins.

**Break behaviour:** Decide which restrictions remain during an intentional break. Current preference is that the Oath stays structurally active and its timer pauses, but whether fullscreen and notification blocking should remain fully enforced during the break is not finalized.

**Break presets:** Choose the suggested break durations within the allowed **1–60 minute** range.

**Idle-time deduction:** Finalize exactly how much time `I’m back now` removes. Half of the continuous idle interval was proposed, probably with a cap tied to the selected inactivity threshold, but this is not yet fixed.

**Presence UI/privacy:** Finalize camera-permission copy and implementation guarantees. Ideally camera presence detection is processed locally and video is never recorded/stored, but that must only be promised if the implementation actually guarantees it.

**Permitted applications/websites:** The concept assumes some applications/sites may be allowed during an Oath, but the UI and rules for creating/managing that permission list have not yet been designed.

**Modifying an active Oath:** Adding Oathbound tasks is allowed; weakening its terms is deliberately difficult. The exact behaviour for deleting an Oathbound task, altering required tasks, or otherwise modifying active terms still needs specification.

**Visual design:** The general direction is a persistent bottom-left labelled control, purple active Oath state, and restrained amber/gold Oathbound-task treatment. Exact icons, dimensions, active-state wording, and the final Oath modal design remain to be finalized.


## Design ideas

![[Pasted image 20260918104733.png]]
![[Pasted image 20260918111431.png|700]]




![[Pasted image 20260918110123.png|1173]]


![[Pasted image 20260918112023.png|988]]